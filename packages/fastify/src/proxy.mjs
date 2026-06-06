import net from 'node:net'
import { lookup } from 'node:dns/promises'
import { transformBuffer, InvalidOperationError } from '@sharptown/core'

const DEFAULT_TIMEOUT_MS = 5000
const DEFAULT_MAX_BYTES = 20 * 1024 * 1024
const DEFAULT_CACHE_CONTROL = 'public, max-age=31536000, immutable'

/**
 * Thrown when a proxy request is rejected before or during the upstream fetch. Carries
 * the HTTP status the adapter should respond with.
 */
export class ProxyError extends Error {
  /**
   * @param {number} statusCode
   * @param {string} message
   */
  constructor(statusCode, message) {
    super(message)
    this.name = 'ProxyError'
    this.statusCode = statusCode
  }
}

/**
 * @typedef {object} ProxyConfig
 * @property {string} key HMAC secret. When empty, the proxy route is disabled.
 * @property {string[]} allowedHosts Lower-cased host allowlist (ignored when `allowAllHosts`).
 * @property {boolean} allowAllHosts True when the allowlist is `*`; private/loopback addresses are still blocked.
 * @property {number} timeoutMs Upstream fetch timeout in milliseconds.
 * @property {number} maxBytes Maximum upstream response size in bytes.
 * @property {string} cacheControl `Cache-Control` value for successful responses; empty omits the header.
 */

/**
 * Resolves the proxy configuration from explicit plugin options first and environment
 * variables second, applying defaults last.
 *
 * @param {object} [options] Plugin-level proxy options.
 * @param {Record<string, string|undefined>} [env] Environment source, usually `process.env`.
 * @returns {ProxyConfig}
 */
export function resolveProxyConfig(options = {}, env = {}) {
  const rawHosts = options.allowedHosts ?? env.SHARPTOWN_PROXY_ALLOWED_HOSTS ?? '*'
  const hostList = String(rawHosts)
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean)
  const allowAllHosts = hostList.includes('*')

  return {
    key: options.key ?? env.SHARPTOWN_PROXY_KEY ?? '',
    allowedHosts: allowAllHosts ? [] : hostList,
    allowAllHosts,
    timeoutMs: Number(options.timeoutMs ?? env.SHARPTOWN_PROXY_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS),
    maxBytes: Number(options.maxBytes ?? env.SHARPTOWN_PROXY_MAX_BYTES ?? DEFAULT_MAX_BYTES),
    cacheControl: options.cacheControl ?? env.SHARPTOWN_PROXY_CACHE_CONTROL ?? DEFAULT_CACHE_CONTROL,
  }
}

const textEncoder = new TextEncoder()

/**
 * @param {ArrayBuffer} buffer
 * @returns {string}
 */
function toBase64Url(buffer) {
  let binary = ''
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * @param {string} value
 * @returns {Uint8Array}
 */
function fromBase64Url(value) {
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

/**
 * @param {string} secret
 * @returns {Promise<CryptoKey>}
 */
function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

/**
 * Builds the canonical signing string for a set of proxy parameters: every parameter
 * except `sig`, as decoded `key=value` pairs sorted by key (then value) and joined with
 * `&`. Values are not re-encoded, so the same string is trivially reproducible in any
 * language regardless of its URL-encoding rules — only the final URL is percent-encoded.
 *
 * @param {Record<string, unknown>} params
 * @returns {string}
 */
export function canonicalQuery(params) {
  const pairs = []
  for (const [key, value] of Object.entries(params)) {
    if (key === 'sig' || value == null) continue
    if (Array.isArray(value)) for (const item of value) pairs.push([key, String(item)])
    else pairs.push([key, String(value)])
  }
  pairs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0))
  return pairs.map(([key, value]) => `${key}=${value}`).join('&')
}

/**
 * Computes the HMAC-SHA256 signature (base64url) for a set of proxy parameters.
 *
 * @param {Record<string, unknown>} params
 * @param {string} secret
 * @returns {Promise<string>}
 */
export async function signProxyParams(params, secret) {
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), textEncoder.encode(canonicalQuery(params)))
  return toBase64Url(signature)
}

/**
 * Builds a fully signed proxy URL ready to drop into an `<img src>`. The signature
 * covers the source URL and every transform option, so any tampering is rejected.
 *
 * @param {object} args
 * @param {string} args.endpoint Absolute proxy endpoint, e.g. `https://img.example.com/api/v1/fetch`.
 * @param {string} args.source Source image URL to transform.
 * @param {Record<string, string|number|boolean>} [args.options] Transform options (`width`, `blur`, …).
 * @param {string} args.secret HMAC secret shared with the server.
 * @returns {Promise<string>}
 *
 * @example
 * const url = await buildSignedProxyUrl({
 *   endpoint: 'http://localhost:3001/api/v1/fetch',
 *   source: 'https://example.com/photo.jpg',
 *   options: { width: 800, blur: 3, convertTo: 'webp' },
 *   secret: process.env.SHARPTOWN_PROXY_KEY,
 * })
 */
export async function buildSignedProxyUrl({ endpoint, source, options = {}, secret }) {
  const params = { ...options, url: source }
  const url = new URL(endpoint)
  for (const [key, value] of Object.entries(params)) {
    if (value != null) url.searchParams.append(key, String(value))
  }
  url.searchParams.append('sig', await signProxyParams(params, secret))
  return url.toString()
}

/**
 * @param {Record<string, unknown>} query
 * @param {string} secret
 * @throws {ProxyError}
 */
async function verifySignature(query, secret) {
  if (!query.sig) throw new ProxyError(401, 'Missing signature')

  let signature
  try {
    signature = fromBase64Url(String(query.sig))
  } catch {
    throw new ProxyError(403, 'Invalid signature')
  }

  const valid = await crypto.subtle.verify('HMAC', await hmacKey(secret), signature, textEncoder.encode(canonicalQuery(query)))
  if (!valid) throw new ProxyError(403, 'Invalid signature')
}

/**
 * @param {string} ip
 * @returns {number}
 */
function ipv4ToLong(ip) {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0
}

/**
 * @param {string} ip
 * @param {string} base
 * @param {number} bits
 * @returns {boolean}
 */
function inV4Range(ip, base, bits) {
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
  return (ipv4ToLong(ip) & mask) === (ipv4ToLong(base) & mask)
}

/**
 * @param {string} ip
 * @returns {boolean}
 */
function isPrivateIPv4(ip) {
  return (
    inV4Range(ip, '0.0.0.0', 8) ||
    inV4Range(ip, '10.0.0.0', 8) ||
    inV4Range(ip, '100.64.0.0', 10) ||
    inV4Range(ip, '127.0.0.0', 8) ||
    inV4Range(ip, '169.254.0.0', 16) ||
    inV4Range(ip, '172.16.0.0', 12) ||
    inV4Range(ip, '192.0.0.0', 24) ||
    inV4Range(ip, '192.168.0.0', 16) ||
    inV4Range(ip, '198.18.0.0', 15) ||
    inV4Range(ip, '224.0.0.0', 4) ||
    inV4Range(ip, '240.0.0.0', 4)
  )
}

/**
 * Rejects loopback, link-local, unique-local and unspecified IPv6 addresses, and
 * unwraps IPv4-mapped addresses (`::ffff:a.b.c.d`) to reuse the IPv4 checks.
 *
 * @param {string} ip
 * @returns {boolean}
 */
function isPrivateIPv6(ip) {
  const value = ip.toLowerCase()
  if (value.startsWith('::ffff:')) {
    const mapped = value.slice(value.lastIndexOf(':') + 1)
    if (net.isIP(mapped) === 4) return isPrivateIPv4(mapped)
  }
  return (
    value === '::1' ||
    value === '::' ||
    value.startsWith('fc') ||
    value.startsWith('fd') ||
    value.startsWith('fe8') ||
    value.startsWith('fe9') ||
    value.startsWith('fea') ||
    value.startsWith('feb')
  )
}

/**
 * @param {string} ip
 * @returns {boolean}
 */
function isPrivateAddress(ip) {
  const family = net.isIP(ip)
  if (family === 4) return isPrivateIPv4(ip)
  if (family === 6) return isPrivateIPv6(ip)
  return true
}

/**
 * @param {string} host
 * @param {string[]} allowedHosts
 * @returns {boolean}
 */
function hostAllowed(host, allowedHosts) {
  const candidate = host.toLowerCase()
  return allowedHosts.some((entry) => {
    if (entry.startsWith('*.')) {
      const root = entry.slice(2)
      return candidate === root || candidate.endsWith(`.${root}`)
    }
    return candidate === entry
  })
}

/**
 * Validates a source URL against the allowlist and SSRF rules, resolving the hostname so
 * that names pointing at private ranges are blocked too.
 *
 * @param {string} rawUrl
 * @param {ProxyConfig} config
 * @returns {Promise<URL>}
 * @throws {ProxyError}
 */
export async function assertSafeUrl(rawUrl, config) {
  let url
  try {
    url = new URL(String(rawUrl))
  } catch {
    throw new ProxyError(400, 'Invalid url')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ProxyError(400, 'Only http and https sources are allowed')
  }

  const host = url.hostname.replace(/^\[|\]$/g, '')

  if (!config.allowAllHosts && !hostAllowed(host, config.allowedHosts)) {
    throw new ProxyError(403, 'Source host is not allowed')
  }

  if (net.isIP(host)) {
    if (isPrivateAddress(host)) throw new ProxyError(403, 'Source address is not allowed')
  } else {
    const { address } = await lookup(host)
    if (isPrivateAddress(address)) throw new ProxyError(403, 'Source address is not allowed')
  }

  return url
}

/**
 * Reads a response body into a `Uint8Array`, aborting as soon as it exceeds `maxBytes`.
 *
 * @param {Response} response
 * @param {number} maxBytes
 * @returns {Promise<Uint8Array>}
 * @throws {ProxyError}
 */
async function readLimited(response, maxBytes) {
  const reader = response.body.getReader()
  const chunks = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      throw new ProxyError(413, 'Source image is too large')
    }
    chunks.push(value)
  }

  const body = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return body
}

/**
 * Fetches the source image with a timeout and size cap. Redirects are not followed,
 * since a redirect target would bypass the SSRF checks performed on the original URL.
 *
 * @param {URL} url
 * @param {ProxyConfig} config
 * @returns {Promise<Uint8Array>}
 * @throws {ProxyError}
 */
async function fetchSource(url, config) {
  let response
  try {
    response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(config.timeoutMs) })
  } catch {
    throw new ProxyError(504, 'Source fetch timed out or failed')
  }

  if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
    throw new ProxyError(502, 'Source redirects are not followed')
  }
  if (!response.ok) {
    throw new ProxyError(502, `Source responded with ${response.status}`)
  }
  if ((response.headers.get('content-type') || '').startsWith('text/html')) {
    throw new ProxyError(415, 'Source is not an image')
  }

  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > config.maxBytes) {
    throw new ProxyError(413, 'Source image is too large')
  }

  return readLimited(response, config.maxBytes)
}

/**
 * Builds a SSRF-guarded image fetcher bound to the proxy config, suitable for resolving
 * watermark images referenced by URL on any route (the same guard and limits as the proxy).
 *
 * @param {ProxyConfig} config
 * @returns {(url: string) => Promise<Uint8Array>}
 */
export function createImageFetcher(config) {
  return async function fetchImage(url) {
    return fetchSource(await assertSafeUrl(url, config), config)
  }
}

/**
 * Registers `GET {prefix}/fetch`: a signed image proxy that downloads a remote image,
 * applies the same transform options as `POST {prefix}/transform`, and returns the
 * result with long-lived cache headers and an ETag.
 *
 * @param {import('fastify').FastifyInstance} app
 * @param {string} prefix
 * @param {ProxyConfig} config
 */
export function registerProxyRoute(app, prefix, config) {
  const fetchImage = createImageFetcher(config)

  app.get(`${prefix}/fetch`, async function fetchRoute(request, reply) {
    try {
      if (!config.key) throw new ProxyError(503, 'Image proxy is disabled')

      const { url, sig, ...options } = request.query
      if (!url) throw new ProxyError(400, 'Missing url parameter')

      await verifySignature(request.query, config.key)
      const safeUrl = await assertSafeUrl(url, config)
      const source = await fetchSource(safeUrl, config)

      const { data, contentType } = await transformBuffer(source, options, { fetchImage })
      const etag = `"${toBase64Url(await crypto.subtle.digest('SHA-1', data))}"`

      if (request.headers['if-none-match'] === etag) {
        return reply.code(304).send()
      }

      reply.header('content-type', contentType)
      reply.header('etag', etag)
      if (config.cacheControl) reply.header('cache-control', config.cacheControl)
      return data
    } catch (error) {
      if (error instanceof ProxyError) return reply.code(error.statusCode).send({ error: error.message })
      if (error instanceof InvalidOperationError) return reply.code(400).send({ error: error.message })
      request.log.error(error)
      return reply.code(415).send({ error: 'Unsupported or corrupt image' })
    }
  })
}
