import { createElement, useEffect, useState } from 'react'
import { pickOperations } from '@sharptown/client'
import { useSharptownClient } from './context.mjs'

/**
 * @typedef {import('react').ImgHTMLAttributes<HTMLImageElement> & import('@sharptown/client').Operations & { src: string }} ImageDeliveryProps
 */

/**
 * A single-`<img>` component that delivers a Sharptown-transformed image. Transform props
 * (`width`, `height`, `blur`, `aspectRatio`, and any other {@link import('@sharptown/client').Operations}
 * key) are turned into a signed proxy URL via the provided client; every other prop
 * (`alt`, `className`, `loading`, `onLoad`, `onError`, …) is forwarded to the `<img>`.
 *
 * @param {ImageDeliveryProps} props
 * @returns {import('react').ReactElement}
 *
 * @example
 * <ImageDelivery
 *   src="https://example.com/photo.png"
 *   width={100}
 *   height={100}
 *   blur={1}
 *   aspectRatio={16 / 9}
 *   alt="A blurred photo"
 *   onLoad={handleLoad}
 *   onError={handleError}
 * />
 */
export function ImageDelivery(props) {
  const client = useSharptownClient()
  const { src, ...rest } = props
  const { operations, rest: imgProps } = pickOperations(rest)
  const [resolvedSrc, setResolvedSrc] = useState('')
  const operationsKey = JSON.stringify(operations)

  useEffect(() => {
    let cancelled = false
    Promise.resolve(client.signedUrl(src, operations)).then((url) => {
      if (!cancelled) setResolvedSrc(url)
    })
    return () => { cancelled = true }
  }, [client, src, operationsKey])

  return createElement('img', {
    ...imgProps,
    width: operations.width,
    height: operations.height,
    src: resolvedSrc,
  })
}
