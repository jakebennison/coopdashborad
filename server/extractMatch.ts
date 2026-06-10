import type { IncomingMessage, ServerResponse } from 'node:http'
import { normalizeVisionExtraction } from '../src/statParsing'
import type { VisionExtraction } from '../src/types'
import { normalizeImageMediaType } from './imageMedia'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const MODEL = 'claude-opus-4-5'

const visionPrompt = `This is a post-match stats screenshot from EA Sports FC on Xbox.

Valid screenshots look like the EA FC post-match Summary screen:
- Horizontal tabs near the top: Summary, Possession, Shooting, Passing, Defending, Events (Summary is usually selected)
- Team names and crests at the top with the final score between them (example: BRAZIL 1 : 2 PARIS SG)
- A central two-column stats table comparing both teams
- Circular percentage gauges on the sides for Dribble Success Rate, Shot Accuracy, and Pass Accuracy
- If this is NOT that post-match stats Summary screen, still return JSON but set psgSide to "invalid"

The team name for PSG appears as "PARIS SG" in this game.
Identify which side PARIS SG is on (left or right). If PARIS SG appears on both sides, return psgSide as "both".
If PARIS SG is not visible anywhere, return psgSide as "invalid".
PSG on left = home, PSG on right = away.

When psgSide is "both" (same club on both sides, e.g. co-op PSG vs PSG):
- Extract stats for BOTH screen columns separately.
- Put the LEFT column team in leftTeam AND in psg.
- Put the RIGHT column team in rightTeam AND in opponent.
- leftTeam/rightTeam must include name, score, and all visible stats for that column.

The screenshot capture date is when the match was played. If a calendar match date is visible anywhere on screen, extract it as matchDate in YYYY-MM-DD format. If no calendar date is visible, set matchDate to null.

Extract all visible stats for BOTH teams from the Summary table and side gauges.
The Summary tab shows Passes, Tackles, and Saves in both columns — always extract the opponent's passes, tackles, and saves from the opposite column, never leave them null when visible.
Expected Goals may appear as "Expected Goals" or "xG".
Ball Recovery Time is in seconds.

Return ONLY valid JSON, no markdown, no preamble:
{
  "psgSide": "left" | "right" | "both" | "invalid",
  "venue": "home" | "away",
  "matchDate": "YYYY-MM-DD" | null,
  "leftTeam": { same shape as opponent, include when psgSide is "both" } | null,
  "rightTeam": { same shape as opponent, include when psgSide is "both" } | null,
  "psg": {
    "score": integer,
    "possession": integer,
    "shots": integer,
    "shotsOnTarget": integer,
    "xG": float,
    "passes": integer,
    "passAccuracy": integer,
    "tackles": integer,
    "tacklesWon": integer,
    "interceptions": integer,
    "saves": integer,
    "foulsCommitted": integer,
    "offsides": integer,
    "corners": integer,
    "freeKicks": integer,
    "yellowCards": integer,
    "dribbleSuccessRate": integer,
    "shotAccuracy": integer,
    "ballRecoveryTime": integer,
    "penaltyKicks": integer
  },
  "opponent": {
    "name": string,
    "score": integer,
    "possession": integer,
    "shots": integer,
    "shotsOnTarget": integer,
    "xG": float,
    "passes": integer,
    "passAccuracy": integer,
    "tackles": integer,
    "tacklesWon": integer,
    "interceptions": integer,
    "saves": integer,
    "foulsCommitted": integer,
    "offsides": integer,
    "corners": integer,
    "freeKicks": integer,
    "yellowCards": integer,
    "dribbleSuccessRate": integer,
    "shotAccuracy": integer,
    "ballRecoveryTime": integer,
    "penaltyKicks": integer
  }
}
Use null for any field not visible. Return only the JSON object.`

type AnthropicTextBlock = {
  type: 'text'
  text: string
}

type AnthropicResponse = {
  content: AnthropicTextBlock[]
}

type ExtractRequestBody = {
  image?: string
  mediaType?: string
}

const extractJson = (text: string): VisionExtraction => {
  const trimmed = text.trim()
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')

  if (start === -1 || end === -1) {
    throw new Error('Claude did not return a JSON object.')
  }

  return JSON.parse(trimmed.slice(start, end + 1)) as VisionExtraction
}

export async function extractMatchFromImage(
  image: string,
  mediaType: string,
  apiKey: string,
): Promise<VisionExtraction> {
  if (!apiKey) {
    throw new Error('Missing ANTHROPIC_API_KEY. Add it to your .env file and restart the dev server.')
  }

  if (!image) {
    throw new Error('Screenshot image data is required.')
  }

  const imageBuffer = Buffer.from(image, 'base64')
  const safeMediaType = normalizeImageMediaType(mediaType, '', imageBuffer)

  const response = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1600,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: safeMediaType,
                data: image,
              },
            },
            {
              type: 'text',
              text: visionPrompt,
            },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Claude Vision extraction failed (${response.status}): ${details}`)
  }

  const data = (await response.json()) as AnthropicResponse
  const text = data.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')

  const extraction = normalizeVisionExtraction(extractJson(text))
  if (extraction.psgSide === 'invalid' || !['left', 'right', 'both'].includes(extraction.psgSide)) {
    throw new Error(
      'This does not look like an EA FC post-match Summary stats screen with PARIS SG.',
    )
  }

  return extraction
}

export async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = []

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  if (!chunks.length) {
    throw new Error('Request body is empty.')
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T
}

export async function handleExtractMatchRequest(
  req: IncomingMessage,
  res: ServerResponse,
  apiKey: string,
) {
  try {
    const body = await readJsonBody<ExtractRequestBody>(req)
    const extraction = await extractMatchFromImage(
      body.image ?? '',
      body.mediaType ?? 'image/png',
      apiKey,
    )

    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(extraction))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not extract match data.'
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: message }))
  }
}
