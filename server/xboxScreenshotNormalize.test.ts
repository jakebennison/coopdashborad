import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { normalizeScreenshotPage } from './xboxScreenshotNormalize.ts'
import { mergeScreenshotLibraries } from './xboxScreenshotCache.ts'

describe('normalizeScreenshotPage', () => {
  it('parses the modern OpenXBL screenshots payload', () => {
    const page = normalizeScreenshotPage({
      content: {
        screenshots: [
          {
            screenshotId: '9ef60433-f971-43b5-a4c8-accda7827278',
            titleName: 'EA SPORTS FC™ 26 Xbox Series X|S',
            titleId: 1909324253,
            dateTaken: '2026-06-04T08:01:56Z',
            resolutionWidth: 1920,
            resolutionHeight: 1080,
            thumbnails: [
              {
                uri: 'https://screenshotscontent-t3001.media.xboxlive.com/thumb.png',
                thumbnailType: 2,
              },
            ],
            screenshotUris: [
              {
                uri: 'https://screenshotscontent-d3001.media.xboxlive.com/full.png',
              },
            ],
          },
        ],
      },
    })

    assert.equal(page.length, 1)
    assert.equal(page[0]?.contentId, '9ef60433-f971-43b5-a4c8-accda7827278')
    assert.match(page[0]?.downloadUrl ?? '', /media\.xboxlive\.com/)
    assert.equal(page[0]?.titleName, 'EA SPORTS FC™ 26 Xbox Series X|S')
  })

  it('parses the legacy OpenXBL screenshots payload', () => {
    const page = normalizeScreenshotPage({
      values: [
        {
          contentId: 'legacy-id',
          titleName: 'Legacy Game',
          captureDate: '2026-01-01T12:00:00Z',
          contentLocators: [
            { locatorType: 'Download', uri: 'https://screenshotscontent-d3001.media.xboxlive.com/legacy.png' },
            { locatorType: 'Thumbnail_Large', uri: 'https://screenshotscontent-t3001.media.xboxlive.com/legacy-thumb.png' },
          ],
        },
      ],
    })

    assert.equal(page.length, 1)
    assert.equal(page[0]?.contentId, 'legacy-id')
    assert.match(page[0]?.downloadUrl ?? '', /legacy\.png/)
  })
})

describe('mergeScreenshotLibraries', () => {
  it('prefers live entries over cached entries with the same content ID', () => {
    const merged = mergeScreenshotLibraries(
      [
        {
          contentId: 'abc',
          titleName: 'Live title',
          titleId: '1',
          captureDate: '2026-06-04T08:01:56Z',
          thumbnailUrl: null,
          downloadUrl: 'https://screenshotscontent-d3001.media.xboxlive.com/live.png',
          width: null,
          height: null,
        },
      ],
      [
        {
          contentId: 'abc',
          titleName: 'Cached title',
          titleId: '1',
          captureDate: '2026-06-01T08:01:56Z',
          thumbnailUrl: null,
          downloadUrl: 'https://screenshotscontent-d3001.media.xboxlive.com/cached.png',
          width: null,
          height: null,
        },
        {
          contentId: 'old',
          titleName: 'Older capture',
          titleId: '2',
          captureDate: '2026-05-01T08:01:56Z',
          thumbnailUrl: null,
          downloadUrl: 'https://screenshotscontent-d3001.media.xboxlive.com/old.png',
          width: null,
          height: null,
        },
      ],
    )

    assert.equal(merged.length, 2)
    assert.equal(merged.find((item) => item.contentId === 'abc')?.titleName, 'Live title')
    assert.equal(merged.find((item) => item.contentId === 'old')?.titleName, 'Older capture')
  })
})
