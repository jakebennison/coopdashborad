const ALLOWED_IMAGE_MEDIA_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
])

const MEDIA_TYPE_ALIASES: Record<string, string> = {
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'image/x-png': 'image/png',
  'application/x-png': 'image/png',
}

const mediaTypeFromUrl = (url: string) => {
  if (!url) return null

  try {
    const pathname = new URL(url).pathname.toLowerCase()

    if (pathname.endsWith('.png')) return 'image/png'
    if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'image/jpeg'
    if (pathname.endsWith('.gif')) return 'image/gif'
    if (pathname.endsWith('.webp')) return 'image/webp'
  } catch {
    return null
  }

  return null
}

export const sniffImageMediaType = (buffer: Buffer) => {
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png'
  }

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg'
  }

  if (buffer.length >= 6) {
    const signature = buffer.subarray(0, 6).toString('ascii')
    if (signature === 'GIF87a' || signature === 'GIF89a') {
      return 'image/gif'
    }
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp'
  }

  return null
}

export const normalizeImageMediaType = (
  rawContentType: string | null | undefined,
  url: string,
  buffer: Buffer,
) => {
  const normalized = rawContentType?.split(';')[0]?.trim().toLowerCase() ?? ''

  if (MEDIA_TYPE_ALIASES[normalized]) return MEDIA_TYPE_ALIASES[normalized]
  if (ALLOWED_IMAGE_MEDIA_TYPES.has(normalized)) return normalized

  const fromUrl = mediaTypeFromUrl(url)
  if (fromUrl) return fromUrl

  const sniffed = sniffImageMediaType(buffer)
  if (sniffed) return sniffed

  return 'image/png'
}
