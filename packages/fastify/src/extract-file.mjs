/**
 * Returns the bytes of the first uploaded file in a multipart request, or `null`
 * when no file is present. Uses `request.file()` from `@fastify/multipart`.
 *
 * @param {import('fastify').FastifyRequest} request
 * @returns {Promise<Buffer | null>}
 *
 * @example
 * const buffer = await readFirstFile(request)
 * if (!buffer) return reply.code(400).send({ error: 'No file uploaded' })
 */
export async function readFirstFile(request) {
  const part = await request.file()
  if (!part) return null
  return part.toBuffer()
}

/**
 * Reads every uploaded file in a multipart request, separating the main image from the
 * watermark overlays. Watermark files (field `watermark`, repeatable) keep their upload
 * order so a `composite` spec can reference them by index via `ref`.
 *
 * @param {import('fastify').FastifyRequest} request
 * @param {{ imageField?: string, watermarkField?: string }} [fields]
 * @returns {Promise<{ image: Buffer | null, watermarks: Buffer[] }>}
 */
export async function readUploads(request, fields = {}) {
  const imageField = fields.imageField ?? 'image'
  const watermarkField = fields.watermarkField ?? 'watermark'

  let image = null
  const watermarks = []
  for await (const part of request.parts()) {
    if (part.type !== 'file') continue
    const buffer = await part.toBuffer()
    if (part.fieldname === watermarkField) {
      watermarks.push(buffer)
    } else if (part.fieldname === imageField && !image) {
      image = buffer
    } else if (!image) {
      image = buffer
    }
  }
  return { image, watermarks }
}
