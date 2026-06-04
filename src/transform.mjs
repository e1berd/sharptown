import sharp from 'sharp'
import { extractFilesFromRequest } from './extractFilesFromRequest.mjs'
import { applyOperations, InvalidOperationError } from './applyOperations.mjs'

export async function transform(request, reply) {
  const [file] = await extractFilesFromRequest(request)
  if (!file) {
    return reply.status(400).send({ error: 'No files found' })
  }

  try {
    const image = applyOperations(sharp(file.content), request.query)
    return image.toBuffer()
  } catch (error) {
    if (error instanceof InvalidOperationError) {
      return reply.status(400).send({ error: error.message })
    }
    throw error
  }
}
