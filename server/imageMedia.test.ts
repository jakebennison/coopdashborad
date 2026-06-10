import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { normalizeImageMediaType } from './imageMedia.ts'

describe('normalizeImageMediaType', () => {
  it('accepts Xbox CDN octet-stream payloads when bytes look like PNG', () => {
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

    assert.equal(
      normalizeImageMediaType('application/octet-stream', 'https://screenshotscontent-d3001.media.xboxlive.com/file.bin', pngHeader),
      'image/png',
    )
  })

  it('falls back to the URL extension when content-type is missing', () => {
    const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])

    assert.equal(
      normalizeImageMediaType(null, 'https://screenshotscontent-d3001.media.xboxlive.com/file.jpg', jpegHeader),
      'image/jpeg',
    )
  })
})
