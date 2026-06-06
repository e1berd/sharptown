import { defineComponent, h, shallowRef, watchEffect } from 'vue'
import { OPERATION_KEYS, pickOperations } from '@sharptown/client'
import { useSharptownClient } from './context.mjs'

/**
 * A single-`<img>` component that delivers a Sharptown-transformed image. Transform props
 * (`width`, `height`, `blur`, `aspectRatio`, and any other {@link import('@sharptown/client').Operations}
 * key) are turned into a signed proxy URL via the provided client; every other attribute and
 * listener (`alt`, `class`, `loading`, `decoding`, `sizes`, `onLoad`, `onError`, …) is
 * forwarded to the underlying `<img>`.
 *
 * @example
 * <ImageDelivery
 *   src="https://example.com/photo.png"
 *   :width="100"
 *   :height="100"
 *   :blur="1"
 *   :aspect-ratio="16 / 9"
 *   @load="onLoad"
 *   @error="onError"
 * />
 */
export const ImageDelivery = defineComponent({
  name: 'ImageDelivery',
  inheritAttrs: false,
  props: ['src', ...OPERATION_KEYS],
  setup(props, { attrs }) {
    const client = useSharptownClient()
    const resolvedSrc = shallowRef('')

    watchEffect((onCleanup) => {
      let cancelled = false
      onCleanup(() => { cancelled = true })
      const { operations } = pickOperations(props)
      Promise.resolve(client.signedUrl(props.src, operations)).then((url) => {
        if (!cancelled) resolvedSrc.value = url
      })
    })

    return () => h('img', {
      ...attrs,
      ...(props.width != null ? { width: props.width } : {}),
      ...(props.height != null ? { height: props.height } : {}),
      src: resolvedSrc.value,
    })
  },
})
