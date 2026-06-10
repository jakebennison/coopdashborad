#!/usr/bin/env node

const apiKey = process.env.OPENXBL_API_KEY?.trim()

if (!apiKey) {
  console.error('Missing OPENXBL_API_KEY in environment.')
  process.exit(1)
}

const headers = {
  'X-Authorization': apiKey,
  Accept: 'application/json',
}

const request = async (path) => {
  const response = await fetch(`https://xbl.io${path}`, { headers })
  const text = await response.text()

  let body
  try {
    body = JSON.parse(text)
  } catch {
    body = text
  }

  return { response, body }
}

const modernCount = (body) => body.content?.screenshots?.length ?? 0
const legacyCount = (body) => body.values?.length ?? 0

try {
  const account = await request('/api/v2/account')
  const screenshots = await request('/api/v2/dvr/screenshots')

  const gamertag =
    account.body.content?.profileUsers?.[0]?.settings?.find((setting) => setting.id === 'Gamertag')
      ?.value ?? null

  const summary = {
    accountStatus: account.response.status,
    screenshotStatus: screenshots.response.status,
    gamertag,
    modernScreenshots: modernCount(screenshots.body),
    legacyScreenshots: legacyCount(screenshots.body),
  }

  console.log(JSON.stringify(summary, null, 2))

  if (!account.response.ok || !screenshots.response.ok) {
    process.exit(1)
  }

  if (summary.modernScreenshots + summary.legacyScreenshots === 0) {
    console.warn('OpenXBL returned zero screenshots. Cached library fallback may still show older captures.')
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
