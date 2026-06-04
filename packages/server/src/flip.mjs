
import sharp from 'sharp'
import { extractFilesFromRequest } from './extractFilesFromRequest.mjs'


export async function flip(request, reply) {
  const [file] = await extractFilesFromRequest(request)
  return sharp(file).flip().toBuffer()
}
