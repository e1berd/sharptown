import { inject, provide } from 'vue'

/**
 * Injection key holding the shared {@link import('@sharptown/client').SharptownClient}.
 * @type {symbol}
 */
export const SHARPTOWN_INJECTION_KEY = Symbol('sharptown-client')

/**
 * Provides a Sharptown client to descendant components. Call once in a parent's `setup`.
 * Every nested {@link ImageDelivery} reads this client to build its signed `src`.
 *
 * @param {import('@sharptown/client').SharptownClient} client
 * @returns {void}
 *
 * @example
 * import { sharptown } from '@sharptown/client'
 * import { provideSharptownClient } from '@sharptown/vue'
 *
 * provideSharptownClient(sharptown('https://img.example.com', { proxySecret }))
 */
export function provideSharptownClient(client) {
  provide(SHARPTOWN_INJECTION_KEY, client)
}

/**
 * Reads the Sharptown client provided by an ancestor via {@link provideSharptownClient}.
 *
 * @returns {import('@sharptown/client').SharptownClient}
 * @throws {Error} When no client was provided in the component tree.
 */
export function useSharptownClient() {
  const client = inject(SHARPTOWN_INJECTION_KEY, null)
  if (!client) {
    throw new Error('useSharptownClient: no Sharptown client found. Call provideSharptownClient(client) in a parent component.')
  }
  return client
}
