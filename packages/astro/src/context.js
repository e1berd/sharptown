/** @type {import('@sharptown/client').SharptownClient | null} */
let current = null

/**
 * Registers the Sharptown client used by every `<ImageDelivery>`. Call once at startup, e.g.
 * from a shared module imported by your layout. The client only carries configuration
 * (base URL, proxy secret), not per-request state, so a module-level singleton is safe.
 *
 * @param {import('@sharptown/client').SharptownClient} client
 * @returns {void}
 *
 * @example
 * import { sharptown } from '@sharptown/client'
 * import { setSharptownClient } from '@sharptown/astro'
 *
 * setSharptownClient(sharptown('https://img.example.com', { proxySecret: import.meta.env.SHARPTOWN_PROXY_KEY }))
 */
export function setSharptownClient(client) {
  current = client
}

/**
 * Reads the Sharptown client registered via {@link setSharptownClient}.
 *
 * @returns {import('@sharptown/client').SharptownClient}
 * @throws {Error} When no client has been registered.
 */
export function getSharptownClient() {
  if (!current) {
    throw new Error('getSharptownClient: no Sharptown client registered. Call setSharptownClient(client) at startup.')
  }
  return current
}
