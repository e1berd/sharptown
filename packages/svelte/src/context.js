import { getContext, setContext } from 'svelte'

const SHARPTOWN_KEY = Symbol('sharptown-client')

/**
 * Provides a Sharptown client to descendant components. Call during a parent component's
 * initialization. Every nested `<ImageDelivery>` reads this client to build its signed `src`.
 *
 * @param {import('@sharptown/client').SharptownClient} client
 * @returns {void}
 *
 * @example
 * import { sharptown } from '@sharptown/client'
 * import { setSharptownClient } from '@sharptown/svelte'
 *
 * setSharptownClient(sharptown('https://img.example.com', { proxySecret }))
 */
export function setSharptownClient(client) {
  setContext(SHARPTOWN_KEY, client)
}

/**
 * Reads the Sharptown client set by an ancestor via {@link setSharptownClient}.
 *
 * @returns {import('@sharptown/client').SharptownClient}
 * @throws {Error} When no client was set in the component tree.
 */
export function getSharptownClient() {
  const client = getContext(SHARPTOWN_KEY)
  if (!client) {
    throw new Error('getSharptownClient: no Sharptown client found. Call setSharptownClient(client) in a parent component.')
  }
  return client
}
