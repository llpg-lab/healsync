import { createReadStream, existsSync, statSync } from 'fs'
import { join, resolve } from 'path'
import { NextRequest } from 'next/server'

const VIDEO_DIR = resolve(process.cwd(), '..', 'video')
const ALLOWED_FILES = new Set(['20.mp4', '40.mp4', '60.mp4', '80.mp4', '100.mp4'])

export async function GET(request: NextRequest, { params }: { params: { name: string } }) {
  const fileName = params.name.toLowerCase()

  if (!ALLOWED_FILES.has(fileName)) {
    return new Response('Not found', { status: 404 })
  }

  const filePath = join(VIDEO_DIR, fileName)
  if (!existsSync(filePath)) {
    return new Response('Not found', { status: 404 })
  }

  const fileSize = statSync(filePath).size
  const range = request.headers.get('range')

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-')
    const start = Number.parseInt(parts[0], 10)
    const end = parts[1] ? Number.parseInt(parts[1], 10) : fileSize - 1
    const chunkSize = end - start + 1
    const stream = createReadStream(filePath, { start, end })

    return new Response(stream as unknown as ReadableStream, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(chunkSize),
        'Content-Type': 'video/mp4',
      },
    })
  }

  const stream = createReadStream(filePath)
  return new Response(stream as unknown as ReadableStream, {
    headers: {
      'Content-Length': String(fileSize),
      'Content-Type': 'video/mp4',
      'Accept-Ranges': 'bytes',
    },
  })
}
