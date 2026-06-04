import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, SharptownError } from '../src/index.mjs'

/** Создаёт клиент с перехватом fetch; возвращает { st, calls }. */
function stubClient(response = () => new Response(new Uint8Array([1, 2, 3]), { status: 200 })) {
  const calls = []
  const fetchImpl = async (url, init) => {
    calls.push({ url, init })
    return response()
  }
  const st = createClient('http://localhost:3001/', { fetch: fetchImpl })
  return { st, calls }
}

test('builds the correct URL, query and multipart body', async () => {
  const { st, calls } = stubClient()

  const bytes = await st
    .transform(new Uint8Array([0]))
    .resize(500, 300)
    .rotate(90)
    .flip()
    .blur(3)
    .tint(255, 0, 0)
    .grayscale()
    .removeAlpha()
    .ensureAlpha()
    .convert('webp')
    .bytes()

  assert.equal(calls.length, 1)
  const { url, init } = calls[0]
  const u = new URL(url)

  assert.equal(u.origin + u.pathname, 'http://localhost:3001/api/v1/transform')
  assert.equal(u.searchParams.get('width'), '500')
  assert.equal(u.searchParams.get('height'), '300')
  assert.equal(u.searchParams.get('rotate'), '90')
  assert.equal(u.searchParams.get('flip'), 'true')
  assert.equal(u.searchParams.get('blur'), '3')
  assert.equal(u.searchParams.get('r'), '255')
  assert.equal(u.searchParams.get('grayscale'), 'true')
  assert.equal(u.searchParams.get('removeAlpha'), 'true')
  assert.equal(u.searchParams.get('ensureAlpha'), 'true')
  assert.equal(u.searchParams.get('convertTo'), 'webp')

  assert.equal(init.method, 'POST')
  assert.ok(init.body instanceof FormData)
  assert.ok(init.body.get('image'))
  assert.deepEqual([...bytes], [1, 2, 3])
})

test('await on the builder resolves to a Blob (default terminal)', async () => {
  const { st } = stubClient()
  const result = await st.transform(new Uint8Array([0])).convert('png')
  assert.ok(result instanceof Blob)
})

test('greyscale is an alias of grayscale', async () => {
  const { st, calls } = stubClient()
  await st.transform(new Uint8Array([0])).greyscale().blob()
  assert.equal(new URL(calls[0].url).searchParams.get('grayscale'), 'true')
})

test('tint accepts an object form', async () => {
  const { st, calls } = stubClient()
  await st.transform(new Uint8Array([0])).tint({ r: 10, b: 20 }).blob()
  const sp = new URL(calls[0].url).searchParams
  assert.equal(sp.get('r'), '10')
  assert.equal(sp.get('b'), '20')
  assert.equal(sp.get('g'), null)
})

test('throws SharptownError on a non-ok response with JSON error body', async () => {
  const { st } = stubClient(
    () => new Response(JSON.stringify({ error: 'Invalid format' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    }),
  )
  await assert.rejects(
    () => st.transform(new Uint8Array([0])).blob(),
    (err) => {
      assert.ok(err instanceof SharptownError)
      assert.equal(err.status, 400)
      assert.equal(err.message, 'Invalid format')
      return true
    },
  )
})

test('validates the convert format on the client before any request', async () => {
  const { st, calls } = stubClient()
  assert.throws(
    () => st.transform(new Uint8Array([0])).convert('bmp'),
    SharptownError,
  )
  assert.equal(calls.length, 0)
})

test('validates color range on the client', () => {
  const { st } = stubClient()
  assert.throws(() => st.transform(new Uint8Array([0])).tint(300, 0, 0), SharptownError)
})

test('supports a custom pluggable transport', async () => {
  const seen = {}
  const transport = {
    name: 'fake',
    async transform(req) {
      seen.req = req
      return new Response(new Uint8Array([9]), { status: 200 })
    },
  }
  const st = createClient('http://x', { transport, fetch: async () => new Response() })
  const bytes = await st.transform(new Uint8Array([0])).resize(42).bytes()
  assert.equal(seen.req.operations.width, 42)
  assert.deepEqual([...bytes], [9])
})

test('createClient rejects an empty baseUrl', () => {
  assert.throws(() => createClient('', { fetch: async () => new Response() }), SharptownError)
})
