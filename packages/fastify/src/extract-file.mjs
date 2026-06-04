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
