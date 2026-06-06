/**
 * `@sharptown/vue` — Vue 3 bindings for Sharptown. Provide a client once with
 * {@link provideSharptownClient}, then render {@link ImageDelivery} anywhere below it.
 *
 * @module @sharptown/vue
 */

export { provideSharptownClient, useSharptownClient, SHARPTOWN_INJECTION_KEY } from './context.mjs'
export { ImageDelivery } from './image-delivery.mjs'
