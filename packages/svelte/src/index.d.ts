import type { Component } from 'svelte'
import type { HTMLImgAttributes } from 'svelte/elements'
import type { Operations, SharptownClient } from '@sharptown/client'

/**
 * Provides a Sharptown client to descendant components. Call during a parent component's
 * initialization.
 */
export function setSharptownClient(client: SharptownClient): void

/**
 * Reads the Sharptown client set by an ancestor via `setSharptownClient`. Throws when none
 * was set in the component tree.
 */
export function getSharptownClient(): SharptownClient

/** Props for {@link ImageDelivery}: native `<img>` attributes plus Sharptown operations. */
export type ImageDeliveryProps = Omit<HTMLImgAttributes, 'src'> & Operations & { src: string }

/**
 * A single-`<img>` component that delivers a Sharptown-transformed image. Transform props are
 * turned into a signed proxy URL; every other attribute and event is forwarded to the `<img>`.
 */
export declare const ImageDelivery: Component<ImageDeliveryProps>
