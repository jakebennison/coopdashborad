export type XboxScreenshotRecord = {
  contentId: string
  titleName: string
  titleId: string
  captureDate: string
  thumbnailUrl: string | null
  downloadUrl: string
  width: number | null
  height: number | null
}

type ContentLocator = {
  locatorType?: string
  uri?: string
}

type OpenXblLegacyScreenshot = {
  contentId?: string
  titleName?: string
  titleId?: string | number
  captureDate?: string
  resolutionWidth?: number
  resolutionHeight?: number
  contentLocators?: ContentLocator[]
}

type OpenXblModernThumbnail = {
  uri?: string
  thumbnailType?: number
}

type OpenXblModernUri = {
  uri?: string
  uriType?: number
}

type OpenXblModernScreenshot = {
  screenshotId?: string
  titleName?: string
  titleData?: string
  titleId?: string | number
  dateTaken?: string
  datePublished?: string
  resolutionWidth?: number
  resolutionHeight?: number
  thumbnails?: OpenXblModernThumbnail[]
  screenshotUris?: OpenXblModernUri[]
}

export type OpenXblScreenshotResponse = {
  values?: OpenXblLegacyScreenshot[]
  content?: {
    screenshots?: OpenXblModernScreenshot[]
    pagingInfo?: { continuationToken?: string | null }
  }
  pagingInfo?: { continuationToken?: string | null }
  continuationToken?: string
}

type NormalizedOpenXblScreenshot = {
  contentId: string
  titleName: string
  titleId: string | number | undefined
  captureDate: string
  resolutionWidth: number | null
  resolutionHeight: number | null
  downloadUrl: string
  thumbnailUrl: string | null
}

const locatorUri = (locators: ContentLocator[] | undefined, type: string) =>
  locators?.find((locator) => locator.locatorType === type)?.uri ?? null

const pickModernThumbnail = (screen: OpenXblModernScreenshot) =>
  screen.thumbnails?.find((thumbnail) => thumbnail.thumbnailType === 2)?.uri ??
  screen.thumbnails?.find((thumbnail) => thumbnail.thumbnailType === 1)?.uri ??
  screen.thumbnails?.[0]?.uri ??
  null

const pickModernDownloadUrl = (screen: OpenXblModernScreenshot, thumbnailUrl: string | null) =>
  screen.screenshotUris?.find((uri) => uri.uri)?.uri ?? thumbnailUrl

const normalizeLegacyScreenshot = (
  screen: OpenXblLegacyScreenshot,
): NormalizedOpenXblScreenshot | null => {
  if (!screen.contentId) return null

  const thumbnailUrl =
    locatorUri(screen.contentLocators, 'Thumbnail_Large') ??
    locatorUri(screen.contentLocators, 'Thumbnail_Small')
  const downloadUrl = locatorUri(screen.contentLocators, 'Download') ?? thumbnailUrl
  if (!downloadUrl) return null

  return {
    contentId: screen.contentId,
    titleName: screen.titleName ?? 'Unknown game',
    titleId: screen.titleId,
    captureDate: screen.captureDate ?? '',
    resolutionWidth: typeof screen.resolutionWidth === 'number' ? screen.resolutionWidth : null,
    resolutionHeight: typeof screen.resolutionHeight === 'number' ? screen.resolutionHeight : null,
    downloadUrl,
    thumbnailUrl,
  }
}

const normalizeModernScreenshot = (
  screen: OpenXblModernScreenshot,
): NormalizedOpenXblScreenshot | null => {
  if (!screen.screenshotId) return null

  const thumbnailUrl = pickModernThumbnail(screen)
  const downloadUrl = pickModernDownloadUrl(screen, thumbnailUrl)
  if (!downloadUrl) return null

  return {
    contentId: screen.screenshotId,
    titleName: screen.titleName?.trim() || screen.titleData?.trim() || 'Unknown game',
    titleId: screen.titleId,
    captureDate: screen.dateTaken ?? screen.datePublished ?? '',
    resolutionWidth: typeof screen.resolutionWidth === 'number' ? screen.resolutionWidth : null,
    resolutionHeight: typeof screen.resolutionHeight === 'number' ? screen.resolutionHeight : null,
    downloadUrl,
    thumbnailUrl,
  }
}

export const normalizeScreenshotPage = (data: OpenXblScreenshotResponse) => {
  const modern = data.content?.screenshots ?? []
  if (modern.length) {
    return modern
      .map(normalizeModernScreenshot)
      .filter((screen): screen is NormalizedOpenXblScreenshot => Boolean(screen))
  }

  return (data.values ?? [])
    .map(normalizeLegacyScreenshot)
    .filter((screen): screen is NormalizedOpenXblScreenshot => Boolean(screen))
}

export const toScreenshotRecord = (screen: NormalizedOpenXblScreenshot): XboxScreenshotRecord => ({
  contentId: screen.contentId,
  titleName: screen.titleName,
  titleId: `${screen.titleId ?? ''}`,
  captureDate: screen.captureDate,
  thumbnailUrl: screen.thumbnailUrl,
  downloadUrl: screen.downloadUrl,
  width: screen.resolutionWidth,
  height: screen.resolutionHeight,
})

export const getContinuationToken = (data: OpenXblScreenshotResponse) =>
  data.content?.pagingInfo?.continuationToken ??
  data.pagingInfo?.continuationToken ??
  data.continuationToken ??
  ''
