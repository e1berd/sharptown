<script setup>
import { computed, reactive, ref, shallowRef } from 'vue'
import { sharptown, SharptownError, SUPPORTED_FORMATS } from '@sharptown/client'
import { ImageDelivery, provideSharptownClient } from '@sharptown/vue'

const baseUrl = ref('http://localhost:3001')

provideSharptownClient(sharptown(baseUrl.value, { proxySecret: 'dev-secret-change-me' }))

const delivery = reactive({
  source: 'https://picsum.photos/800/600',
  width: 320,
  blur: 0,
})
const deliveryStatus = ref('idle')

function onDeliveryLoad() {
  deliveryStatus.value = 'loaded'
}

function onDeliveryError() {
  deliveryStatus.value = 'error'
}

const file = shallowRef(null)
const originalUrl = ref('')
const resultUrl = ref('')
const resultSize = ref(0)
const status = ref('idle')
const errorMessage = ref('')

const ops = reactive({
  width: 800,
  height: null,
  rotate: 0,
  flip: false,
  blur: 0,
  grayscale: false,
  removeAlpha: false,
  ensureAlpha: false,
  tintR: null,
  tintG: null,
  tintB: null,
  convertTo: 'webp',
})

const isBusy = computed(() => status.value === 'loading')
const canRun = computed(() => Boolean(file.value) && !isBusy.value)

function revoke(url) {
  if (url) URL.revokeObjectURL(url)
}

function onFileChange(event) {
  const picked = event.target.files?.[0] ?? null
  revoke(originalUrl.value)
  revoke(resultUrl.value)
  file.value = picked
  originalUrl.value = picked ? URL.createObjectURL(picked) : ''
  resultUrl.value = ''
  resultSize.value = 0
  errorMessage.value = ''
}

function applyOperations(builder) {
  if (ops.width || ops.height) builder.resize({ width: numberOrUndefined(ops.width), height: numberOrUndefined(ops.height) })
  if (ops.rotate) builder.rotate(Number(ops.rotate))
  if (ops.flip) builder.flip()
  if (ops.blur) builder.blur(Number(ops.blur))
  if (hasTint.value) builder.tint(numberOrUndefined(ops.tintR), numberOrUndefined(ops.tintG), numberOrUndefined(ops.tintB))
  if (ops.grayscale) builder.grayscale()
  if (ops.removeAlpha) builder.removeAlpha()
  if (ops.ensureAlpha) builder.ensureAlpha()
  if (ops.convertTo) builder.convert(ops.convertTo)
  return builder
}

const hasTint = computed(() => ops.tintR != null || ops.tintG != null || ops.tintB != null)

function numberOrUndefined(value) {
  return value === '' || value == null ? undefined : Number(value)
}

async function run() {
  if (!file.value) return
  status.value = 'loading'
  errorMessage.value = ''
  revoke(resultUrl.value)
  resultUrl.value = ''
  try {
    const st = sharptown(baseUrl.value)
    const blob = await applyOperations(st.transform(file.value, { filename: file.value.name }))
    resultUrl.value = URL.createObjectURL(blob)
    resultSize.value = blob.size
    status.value = 'done'
  } catch (error) {
    status.value = 'error'
    errorMessage.value = error instanceof SharptownError
      ? `${error.status ?? ''} ${error.message}`.trim()
      : String(error?.message ?? error)
  }
}

const downloadName = computed(() => {
  const base = file.value?.name?.replace(/\.[^.]+$/, '') ?? 'image'
  return `${base}.${ops.convertTo || 'out'}`
})

const codePreview = computed(() => {
  const lines = ['const st = sharptown(' + JSON.stringify(baseUrl.value) + ')', '', 'const out = await st']
  lines.push('  .transform(file)')
  if (ops.width || ops.height) lines.push(`  .resize(${formatArgs([numberOrUndefined(ops.width), numberOrUndefined(ops.height)])})`)
  if (ops.rotate) lines.push(`  .rotate(${Number(ops.rotate)})`)
  if (ops.flip) lines.push('  .flip()')
  if (ops.blur) lines.push(`  .blur(${Number(ops.blur)})`)
  if (hasTint.value) lines.push(`  .tint(${formatArgs([numberOrUndefined(ops.tintR), numberOrUndefined(ops.tintG), numberOrUndefined(ops.tintB)])})`)
  if (ops.grayscale) lines.push('  .grayscale()')
  if (ops.removeAlpha) lines.push('  .removeAlpha()')
  if (ops.ensureAlpha) lines.push('  .ensureAlpha()')
  if (ops.convertTo) lines.push(`  .convert(${JSON.stringify(ops.convertTo)})`)
  return lines.join('\n')
})

function formatArgs(values) {
  while (values.length && values[values.length - 1] === undefined) values.pop()
  return values.map((value) => (value === undefined ? 'undefined' : value)).join(', ')
}

const prettySize = computed(() => {
  const bytes = resultSize.value
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
})
</script>

<template>
  <main class="app">
    <header>
      <h1>Sharptown <span>×</span> Vue</h1>
      <p>An expressive image transformer powered by <code>@sharptown/client</code>.</p>
    </header>

    <section class="panel">
      <label class="field">
        <span>Server URL</span>
        <input v-model="baseUrl" type="url" placeholder="http://localhost:3001" />
      </label>

      <label class="field">
        <span>Image</span>
        <input type="file" accept="image/*" @change="onFileChange" />
      </label>
    </section>

    <section class="panel grid">
      <label class="field">
        <span>Width</span>
        <input v-model.number="ops.width" type="number" min="0" placeholder="auto" />
      </label>
      <label class="field">
        <span>Height</span>
        <input v-model.number="ops.height" type="number" min="0" placeholder="auto" />
      </label>
      <label class="field">
        <span>Rotate °</span>
        <input v-model.number="ops.rotate" type="number" />
      </label>
      <label class="field">
        <span>Blur</span>
        <input v-model.number="ops.blur" type="number" min="0" />
      </label>

      <label class="field">
        <span>Tint R</span>
        <input v-model.number="ops.tintR" type="number" min="0" max="255" placeholder="—" />
      </label>
      <label class="field">
        <span>Tint G</span>
        <input v-model.number="ops.tintG" type="number" min="0" max="255" placeholder="—" />
      </label>
      <label class="field">
        <span>Tint B</span>
        <input v-model.number="ops.tintB" type="number" min="0" max="255" placeholder="—" />
      </label>
      <label class="field">
        <span>Convert to</span>
        <select v-model="ops.convertTo">
          <option value="">(keep)</option>
          <option v-for="format in SUPPORTED_FORMATS" :key="format" :value="format">{{ format }}</option>
        </select>
      </label>

      <label class="toggle"><input v-model="ops.flip" type="checkbox" /> Flip</label>
      <label class="toggle"><input v-model="ops.grayscale" type="checkbox" /> Grayscale</label>
      <label class="toggle"><input v-model="ops.removeAlpha" type="checkbox" /> Remove alpha</label>
      <label class="toggle"><input v-model="ops.ensureAlpha" type="checkbox" /> Ensure alpha</label>
    </section>

    <section class="panel">
      <button class="run" :disabled="!canRun" @click="run">
        {{ isBusy ? 'Transforming…' : 'Transform' }}
      </button>
      <p v-if="errorMessage" class="error">⚠ {{ errorMessage }}</p>
    </section>

    <section class="previews">
      <figure>
        <figcaption>Original</figcaption>
        <img v-if="originalUrl" :src="originalUrl" alt="original" />
        <div v-else class="placeholder">Pick an image</div>
      </figure>
      <figure>
        <figcaption>Result <small v-if="prettySize">· {{ prettySize }}</small></figcaption>
        <img v-if="resultUrl" :src="resultUrl" alt="result" />
        <div v-else class="placeholder">Run a transform</div>
        <a v-if="resultUrl" class="download" :href="resultUrl" :download="downloadName">Download</a>
      </figure>
    </section>

    <section class="panel">
      <figcaption>Equivalent client code</figcaption>
      <pre class="code">{{ codePreview }}</pre>
    </section>

    <section class="panel">
      <figcaption>Signed delivery · &lt;ImageDelivery&gt; from <code>@sharptown/vue</code></figcaption>
      <div class="grid">
        <label class="field">
          <span>Source URL</span>
          <input v-model="delivery.source" type="url" placeholder="https://…" />
        </label>
        <label class="field">
          <span>Width</span>
          <input v-model.number="delivery.width" type="number" min="0" />
        </label>
        <label class="field">
          <span>Blur</span>
          <input v-model.number="delivery.blur" type="number" min="0" />
        </label>
      </div>
      <figure>
        <ImageDelivery
          :src="delivery.source"
          :width="delivery.width || undefined"
          :blur="delivery.blur || undefined"
          alt="Signed delivery preview"
          @load="onDeliveryLoad"
          @error="onDeliveryError"
        />
      </figure>
      <p>Status: <strong>{{ deliveryStatus }}</strong> · requires the server running with <code>SHARPTOWN_PROXY_KEY=dev-secret-change-me</code></p>
    </section>
  </main>
</template>
