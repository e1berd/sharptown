import { createContext, createElement, useContext } from 'react'

/**
 * React context carrying the shared {@link import('@sharptown/client').SharptownClient}.
 * @type {import('react').Context<import('@sharptown/client').SharptownClient | null>}
 */
export const SharptownContext = createContext(null)

/**
 * @typedef {object} SharptownProviderProps
 * @property {import('@sharptown/client').SharptownClient} client The client to share.
 * @property {import('react').ReactNode} [children]
 */

/**
 * Provides a Sharptown client to descendant components. Wrap your tree once near the root.
 * Every nested {@link ImageDelivery} reads this client to build its signed `src`.
 *
 * @param {SharptownProviderProps} props
 * @returns {import('react').ReactElement}
 *
 * @example
 * import { sharptown } from '@sharptown/client'
 * import { SharptownProvider } from '@sharptown/react'
 *
 * <SharptownProvider client={sharptown('https://img.example.com', { proxySecret })}>
 *   <App />
 * </SharptownProvider>
 */
export function SharptownProvider({ client, children }) {
  return createElement(SharptownContext.Provider, { value: client }, children)
}

/**
 * Reads the Sharptown client provided by an ancestor {@link SharptownProvider}.
 *
 * @returns {import('@sharptown/client').SharptownClient}
 * @throws {Error} When no provider is present above the calling component.
 */
export function useSharptownClient() {
  const client = useContext(SharptownContext)
  if (!client) {
    throw new Error('useSharptownClient: no Sharptown client found. Wrap your tree in <SharptownProvider client={...}>.')
  }
  return client
}
