import { SharptownError } from './errors.mjs'
import { toSearchParams } from './operations.mjs'

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
 * @param {string} secret
 * @returns {Promise<CryptoKey>}
 */
function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

/**
 * Produces the canonical signing string shared with the server: decoded `key=value`
 * pairs sorted by key (then value) and joined with `&`. Values are not re-encoded, so
 * the signature is reproducible across every Sharptown client language.
 *
 * @param {URLSearchParams} params
 * @returns {string}
 */
function canonical(params) {
  const pairs = [...params].filter(([key]) => key !== 'sig')
  pairs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0))
  return pairs.map(([key, value]) => `${key}=${value}`).join('&')
}

/**
 * Builds a signed image-proxy URL for the Sharptown `GET /fetch` endpoint. The HMAC-SHA256
 * signature (base64url) covers the source URL and every operation, so the server rejects
 * any tampering. The secret is the server's `SHARPTOWN_PROXY_KEY`; only sign on a trusted
 * server, never ship the secret to a browser bundle.
 *
 * @param {object} args
 * @param {URL} args.baseUrl Sharptown server base URL.
 * @param {string} args.source Source image URL to transform.
 * @param {import('./operations.mjs').Operations} [args.operations] Transform operations.
 * @param {string} args.secret Shared HMAC secret (`SHARPTOWN_PROXY_KEY`).
 * @param {string} [args.path] Proxy endpoint path. Defaults to `/api/v1/fetch`.
 * @returns {Promise<string>}
 *
 * @example
 * const url = await buildProxyUrl({
 *   baseUrl: new URL('https://img.example.com'),
 *   source: 'https://example.com/photo.jpg',
 *   operations: { width: 800, blur: 3, convertTo: 'webp' },
 *   secret: process.env.SHARPTOWN_PROXY_KEY,
 * })
 */
export async function buildProxyUrl({ baseUrl, source, operations = {}, secret, path = '/api/v1/fetch' }) {
  if (!source) throw new SharptownError('buildProxyUrl: source is required')
  if (!secret) throw new SharptownError('buildProxyUrl: secret is required')

  const params = toSearchParams(operations)
  params.set('url', source)

  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), textEncoder.encode(canonical(params)))
  params.set('sig', toBase64Url(signature))

  const endpoint = new URL(baseUrl.href)
  endpoint.pathname = endpoint.pathname.replace(/\/+$/, '') + path
  endpoint.search = params.toString()
  return endpoint.toString()
}
