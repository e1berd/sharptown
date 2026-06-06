import type { SharptownClient } from '@sharptown/client'

/**
 * Registers the Sharptown client used by every `<ImageDelivery>`. Call once at startup. The
 * client only carries configuration, not per-request state, so a module-level singleton is safe.
 */
export function setSharptownClient(client: SharptownClient): void

/** Reads the client registered via `setSharptownClient`. Throws when none is registered. */
export function getSharptownClient(): SharptownClient
