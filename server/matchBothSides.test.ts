import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeVisionExtraction } from '../src/statParsing.ts'
import type { VisionExtraction } from '../src/types.ts'

const legacyBothSidesExtraction: VisionExtraction = {
  psgSide: 'both',
  venue: 'home',
  matchDate: null,
  psg: {
    score: 2,
    possession: 55,
    shots: 10,
    shotsOnTarget: 4,
    xG: 1.8,
  },
  opponent: {
    name: 'PARIS SG',
    score: 1,
    possession: 45,
    shots: 6,
    shotsOnTarget: 2,
    xG: 0.9,
  },
}

test('legacy PSG vs PSG normalizes left and right columns separately', () => {
  const normalized = normalizeVisionExtraction(legacyBothSidesExtraction)

  assert.equal(normalized.leftTeam?.score, 1)
  assert.equal(normalized.rightTeam?.score, 2)
  assert.equal(normalized.leftTeam?.possession, 45)
  assert.equal(normalized.rightTeam?.possession, 55)
})

test('explicit leftTeam/rightTeam columns are preserved', () => {
  const normalized = normalizeVisionExtraction({
    psgSide: 'both',
    venue: 'home',
    matchDate: null,
    leftTeam: {
      name: 'PARIS SG',
      score: 3,
      possession: 40,
      shots: 5,
      shotsOnTarget: 2,
      xG: 1.1,
    },
    rightTeam: {
      name: 'PARIS SG',
      score: 2,
      possession: 60,
      shots: 8,
      shotsOnTarget: 5,
      xG: 2.2,
    },
    psg: { score: 3, possession: 40, shots: 5, shotsOnTarget: 2, xG: 1.1 },
    opponent: { name: 'PARIS SG', score: 2, possession: 60, shots: 8, shotsOnTarget: 5, xG: 2.2 },
  })

  assert.equal(normalized.leftTeam?.score, 3)
  assert.equal(normalized.rightTeam?.score, 2)
})
