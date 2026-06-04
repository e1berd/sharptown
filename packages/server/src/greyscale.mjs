
import sharp from 'sharp'
import { extractFilesFromRequest } from './extractFilesFromRequest.mjs'


export async function greyscale(request, reply) {
  const [file] = await extractFilesFromRequest(request)
  return sharp(file).greyscale().toBuffer()
}
