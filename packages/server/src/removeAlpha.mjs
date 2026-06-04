
import sharp from 'sharp'
import { extractFilesFromRequest } from './extractFilesFromRequest.mjs'


export async function removeAlpha(request, reply) {
  const [file] = await extractFilesFromRequest(request)
  return sharp(file).removeAlpha().toBuffer()
}
