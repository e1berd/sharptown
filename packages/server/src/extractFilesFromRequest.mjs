/**
 * @param {import('fastify').FastifyRequest} request
*/
export async function extractFilesFromRequest(request) {
  const files = []
  for await (const { file, filename, mimetype } of request.files()) {
    const content = await new Promise((resolve, reject) => {
      const chunks = []
      file.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
      file.once('end', () => resolve(Buffer.concat(chunks)))
      file.once('error', reject)
    })

    files.push({
      filename,
      content,
      mimetype,
    })
  }
  return files
}
