
import sharp from 'sharp'
import { extractFilesFromRequest } from './extractFilesFromRequest.mjs'


export async function ensureAlpha(request, reply) {
  const [file] = await extractFilesFromRequest(request)
  return sharp(file).ensureAlpha().toBuffer()
}
