<script setup>
import { computed, reactive, ref } from 'vue'

/**
 * Interactive transform playground. A client-side Vue island: it builds a Sharptown
 * transform chain from the form, shows the generated request URL and client code, and
 * (optionally) runs it against a server URL the user provides. The docs site stays fully
 * static — all work happens in the browser.
 */

const props = defineProps({
  /** Localized UI strings (the `playground` subtree of the active locale's dictionary). */
  t: { type: Object, default: () => ({}) },
})

const DEFAULTS = {
  server_image: 'Server & image',
  server_url: 'Server URL',
  image_file: 'Image file',
  operations: 'Operations',
  flip: 'flip',
  grayscale: 'grayscale',
  remove_alpha: 'removeAlpha',
  ensure_alpha: 'ensureAlpha',
  keep: '(keep)',
  run: 'Run transform ▸',
  running: 'Transforming…',
  pick_first: 'Pick an image first.',
  request_url: 'Request URL',
  client_code: 'Client code',
  copy: 'copy',
  result: 'Result',
  source: 'Source',
  result_label: 'Result',
  hint_html: 'Tip: run a Sharptown REST server (<code>pnpm dev</code>) and point the URL at it. Everything here runs in your browser.',
}

const tr = computed(() => ({ ...DEFAULTS, ...props.t }))

const SUPPORTED_FORMATS = ['webp', 'png', 'jpg', 'jpeg', 'avif', 'gif', 'heif']

const serverUrl = ref('http://localhost:3001')
const file = ref(null)
const fileName = ref('')

const ops = reactive({
  width: null,
  height: null,
  rotate: null,
  blur: null,
  r: null,
  g: null,
  b: null,
  flip: false,
  grayscale: false,
  removeAlpha: false,
  ensureAlpha: false,
  convertTo: 'webp',
})

const state = reactive({ loading: false, error: '', resultUrl: '', resultSize: 0, sourceSize: 0 })

/** Active operations as a clean object (drops empty / falsy values). */
const activeOps = computed(() => {
  const out = {}
  for (const key of ['width', 'height', 'rotate', 'blur', 'r', 'g', 'b']) {
    if (ops[key] !== null && ops[key] !== '' && !Number.isNaN(Number(ops[key]))) {
      out[key] = Number(ops[key])
    }
  }
  for (const key of ['flip', 'grayscale', 'removeAlpha', 'ensureAlpha']) {
    if (ops[key]) out[key] = true
  }
  if (ops.convertTo) out.convertTo = ops.convertTo
  return out
})

const queryString = computed(() => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(activeOps.value)) {
    params.set(key, value === true ? 'true' : String(value))
  }
  return params.toString()
})

const requestUrl = computed(() => {
  const base = serverUrl.value.replace(/\/$/, '')
  const qs = queryString.value
  return `${base}/api/v1/transform${qs ? `?${qs}` : ''}`
})

const clientCode = computed(() => {
  const lines = ["import { sharptown } from '@sharptown/client'", '', `const st = sharptown('${serverUrl.value.replace(/\/$/, '')}')`, '', 'const result = await st']
  lines.push('  .transform(file)')
  if (activeOps.value.width != null || activeOps.value.height != null) {
    lines.push(`  .resize(${activeOps.value.width ?? 'undefined'}${activeOps.value.height != null ? `, ${activeOps.value.height}` : ''})`)
  }
  if (activeOps.value.rotate != null) lines.push(`  .rotate(${activeOps.value.rotate})`)
  if (activeOps.value.blur != null) lines.push(`  .blur(${activeOps.value.blur})`)
  if (activeOps.value.flip) lines.push('  .flip()')
  if (activeOps.value.r != null || activeOps.value.g != null || activeOps.value.b != null) {
    lines.push(`  .tint(${activeOps.value.r ?? 0}, ${activeOps.value.g ?? 0}, ${activeOps.value.b ?? 0})`)
  }
  if (activeOps.value.grayscale) lines.push('  .grayscale()')
  if (activeOps.value.removeAlpha) lines.push('  .removeAlpha()')
  if (activeOps.value.ensureAlpha) lines.push('  .ensureAlpha()')
  if (activeOps.value.convertTo) lines.push(`  .convert('${activeOps.value.convertTo}')`)
  return lines.join('\n')
})

const sourcePreview = ref('')

function onFile(event) {
  const picked = event.target.files?.[0]
  if (!picked) return
  file.value = picked
  fileName.value = picked.name
  state.sourceSize = picked.size
  if (sourcePreview.value) URL.revokeObjectURL(sourcePreview.value)
  sourcePreview.value = URL.createObjectURL(picked)
  state.resultUrl = ''
  state.error = ''
}

async function run() {
  state.error = ''
  if (!file.value) {
    state.error = tr.value.pick_first
    return
  }
  state.loading = true
  try {
    const form = new FormData()
    form.append('image', file.value, fileName.value || 'image')
    const res = await fetch(requestUrl.value, { method: 'POST', body: form })
    if (!res.ok) {
      let message = `Request failed with status ${res.status}`
      try {
        const body = await res.json()
        if (body?.error) message = body.error
      } catch {}
      throw new Error(message)
    }
    const blob = await res.blob()
    if (state.resultUrl) URL.revokeObjectURL(state.resultUrl)
    state.resultUrl = URL.createObjectURL(blob)
    state.resultSize = blob.size
  } catch (error) {
    state.error = error.message ?? String(error)
  } finally {
    state.loading = false
  }
}

function formatBytes(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

const savings = computed(() => {
  if (!state.sourceSize || !state.resultSize) return null
  const pct = (1 - state.resultSize / state.sourceSize) * 100
  return pct
})

async function copyCode() {
  try { await navigator.clipboard.writeText(clientCode.value) } catch {}
}
</script>

<template>
  <div class="pg">
    <div class="pg__panel">
      <h3 class="pg__h">{{ tr.server_image }}</h3>
      <label class="pg__field">
        <span>{{ tr.server_url }}</span>
        <input v-model="serverUrl" type="url" spellcheck="false" placeholder="http://localhost:3001" />
      </label>
      <label class="pg__field">
        <span>{{ tr.image_file }}</span>
        <input type="file" accept="image/*" @change="onFile" />
      </label>
      <p v-if="fileName" class="pg__note">{{ fileName }} · {{ formatBytes(state.sourceSize) }}</p>

      <h3 class="pg__h">{{ tr.operations }}</h3>
      <div class="pg__grid">
        <label class="pg__field"><span>width</span><input v-model="ops.width" type="number" min="0" placeholder="—" /></label>
        <label class="pg__field"><span>height</span><input v-model="ops.height" type="number" min="0" placeholder="—" /></label>
        <label class="pg__field"><span>rotate °</span><input v-model="ops.rotate" type="number" placeholder="—" /></label>
        <label class="pg__field"><span>blur</span><input v-model="ops.blur" type="number" min="0" placeholder="—" /></label>
        <label class="pg__field"><span>tint r</span><input v-model="ops.r" type="number" min="0" max="255" placeholder="0–255" /></label>
        <label class="pg__field"><span>tint g</span><input v-model="ops.g" type="number" min="0" max="255" placeholder="0–255" /></label>
        <label class="pg__field"><span>tint b</span><input v-model="ops.b" type="number" min="0" max="255" placeholder="0–255" /></label>
        <label class="pg__field">
          <span>convertTo</span>
          <select v-model="ops.convertTo">
            <option value="">{{ tr.keep }}</option>
            <option v-for="format in SUPPORTED_FORMATS" :key="format" :value="format">{{ format }}</option>
          </select>
        </label>
      </div>

      <div class="pg__checks">
        <label><input v-model="ops.flip" type="checkbox" /> {{ tr.flip }}</label>
        <label><input v-model="ops.grayscale" type="checkbox" /> {{ tr.grayscale }}</label>
        <label><input v-model="ops.removeAlpha" type="checkbox" /> {{ tr.remove_alpha }}</label>
        <label><input v-model="ops.ensureAlpha" type="checkbox" /> {{ tr.ensure_alpha }}</label>
      </div>

      <button class="pg__run" :disabled="state.loading" @click="run">
        {{ state.loading ? tr.running : tr.run }}
      </button>
      <p v-if="state.error" class="pg__error">⚠ {{ state.error }}</p>
    </div>

    <div class="pg__panel">
      <h3 class="pg__h">{{ tr.request_url }}</h3>
      <pre class="pg__code">POST {{ requestUrl }}</pre>

      <div class="pg__codehead">
        <h3 class="pg__h">{{ tr.client_code }}</h3>
        <button class="pg__copy" @click="copyCode">{{ tr.copy }}</button>
      </div>
      <pre class="pg__code">{{ clientCode }}</pre>

      <h3 class="pg__h">{{ tr.result }}</h3>
      <div class="pg__preview">
        <figure>
          <div class="pg__imgbox">
            <img v-if="sourcePreview" :src="sourcePreview" alt="source" />
            <span v-else class="pg__empty">{{ tr.source }}</span>
          </div>
          <figcaption>{{ tr.source }} · {{ formatBytes(state.sourceSize) }}</figcaption>
        </figure>
        <figure>
          <div class="pg__imgbox">
            <img v-if="state.resultUrl" :src="state.resultUrl" alt="result" />
            <span v-else class="pg__empty">{{ tr.result_label }}</span>
          </div>
          <figcaption>
            {{ tr.result_label }} · {{ formatBytes(state.resultSize) }}
            <strong v-if="savings != null" :class="savings >= 0 ? 'pos' : 'neg'">
              {{ savings >= 0 ? '−' : '+' }}{{ Math.abs(savings).toFixed(0) }}%
            </strong>
          </figcaption>
        </figure>
      </div>
      <p class="pg__hint" v-html="tr.hint_html"></p>
    </div>
  </div>
</template>

<style scoped>
.pg {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  margin-top: 1.5rem;
}
.pg__panel {
  border: var(--st-border-w) solid var(--st-border-strong);
  background: var(--st-bg-2);
  padding: 1.4rem;
}
.pg__h {
  font-family: var(--st-font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--st-fg-muted);
  margin: 1.3rem 0 0.7rem;
}
.pg__h:first-child { margin-top: 0; }
.pg__field { display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 0.8rem; }
.pg__field span { font-family: var(--st-font-mono); font-size: 0.72rem; color: var(--st-fg-muted); }
.pg__field input, .pg__field select {
  font-family: var(--st-font-mono);
  font-size: 0.86rem;
  padding: 0.5em 0.6em;
  background: var(--st-bg);
  color: var(--st-fg);
  border: var(--st-border-w) solid var(--st-border);
}
.pg__field input:focus, .pg__field select:focus { outline: 2px dashed var(--st-accent); outline-offset: 2px; border-color: var(--st-accent); }
.pg__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 0.8rem; }
.pg__checks { display: flex; flex-wrap: wrap; gap: 0.4rem 1.1rem; margin: 0.6rem 0 1.2rem; font-family: var(--st-font-mono); font-size: 0.82rem; }
.pg__checks label { display: inline-flex; align-items: center; gap: 0.4em; cursor: pointer; }
.pg__note { font-family: var(--st-font-mono); font-size: 0.76rem; color: var(--st-fg-muted); margin: 0 0 0.4rem; }

.pg__run {
  width: 100%;
  font-family: var(--st-font-mono);
  font-weight: 700;
  font-size: 0.9rem;
  padding: 0.8em 1em;
  border: var(--st-border-w) solid var(--st-accent);
  background: var(--st-accent);
  color: var(--st-accent-fg);
  cursor: pointer;
}
.pg__run:hover:not(:disabled) { box-shadow: 4px 4px 0 var(--st-fg); transform: translate(-2px, -2px); }
.pg__run:disabled { opacity: 0.6; cursor: progress; }
.pg__error { color: #ff6b6b; font-family: var(--st-font-mono); font-size: 0.82rem; margin-top: 0.8rem; }

.pg__code {
  background: var(--st-code-bg);
  border: var(--st-border-w) solid var(--st-border);
  padding: 0.9rem 1rem;
  font-family: var(--st-font-mono);
  font-size: 0.78rem;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0 0 0.4rem;
  color: var(--st-fg);
}
.pg__codehead { display: flex; align-items: center; justify-content: space-between; }
.pg__copy {
  font-family: var(--st-font-mono);
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 0.3em 0.7em;
  border: 1px solid var(--st-border-strong);
  background: var(--st-bg);
  color: var(--st-fg-muted);
  cursor: pointer;
}
.pg__copy:hover { color: var(--st-accent); border-color: var(--st-accent); }

.pg__preview { display: grid; grid-template-columns: 1fr 1fr; gap: 0.9rem; }
.pg__preview figure { margin: 0; }
.pg__imgbox {
  aspect-ratio: 1;
  border: var(--st-border-w) dashed var(--st-border-strong);
  display: grid;
  place-items: center;
  overflow: hidden;
  background: var(--st-bg);
}
.pg__imgbox img { width: 100%; height: 100%; object-fit: contain; }
.pg__empty { font-family: var(--st-font-mono); font-size: 0.75rem; color: var(--st-fg-muted); text-transform: uppercase; letter-spacing: 0.1em; }
.pg__preview figcaption { font-family: var(--st-font-mono); font-size: 0.74rem; color: var(--st-fg-muted); margin-top: 0.4rem; }
.pg__preview figcaption .pos { color: var(--st-accent); }
.pg__preview figcaption .neg { color: #ff6b6b; }
.pg__hint { font-size: 0.82rem; color: var(--st-fg-muted); margin-top: 1rem; }

@media (max-width: 900px) {
  .pg { grid-template-columns: 1fr; }
}
</style>
