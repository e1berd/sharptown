<script>
  import { pickOperations } from '@sharptown/client'
  import { getSharptownClient } from './context.js'

  let { src, ...rest } = $props()

  const client = getSharptownClient()

  let resolvedSrc = $state('')

  let split = $derived(pickOperations(rest))

  $effect(() => {
    const { operations } = pickOperations(rest)
    let cancelled = false
    Promise.resolve(client.signedUrl(src, operations)).then((url) => {
      if (!cancelled) resolvedSrc = url
    })
    return () => { cancelled = true }
  })
</script>

<!-- svelte-ignore a11y_missing_attribute -->
<img
  {...split.rest}
  width={split.operations.width}
  height={split.operations.height}
  src={resolvedSrc}
/>
