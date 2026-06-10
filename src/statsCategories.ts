import type { MatchStats } from './types'

export type StatsCategoryId =
  | 'summary'
  | 'possession'
  | 'shooting'
  | 'passing'
  | 'defending'
  | 'events'

export type StatFieldConfig = {
  key: keyof MatchStats
  label: string
  suffix?: string
  decimals?: number
}

export type StatsCategory = {
  id: StatsCategoryId
  label: string
  description: string
  stats: StatFieldConfig[]
  gaugeStats?: StatFieldConfig[]
}

export const statsCategories: StatsCategory[] = [
  {
    id: 'summary',
    label: 'Summary',
    description: 'Headline numbers and efficiency rates from your logged matches.',
    stats: [
      { key: 'possession', label: 'Possession', suffix: '%' },
      { key: 'xG', label: 'Expected goals', decimals: 1 },
      { key: 'shots', label: 'Shots' },
      { key: 'passes', label: 'Passes' },
      { key: 'tackles', label: 'Tackles' },
      { key: 'saves', label: 'Saves' },
    ],
    gaugeStats: [
      { key: 'dribbleSuccessRate', label: 'Dribble success', suffix: '%' },
      { key: 'shotAccuracy', label: 'Shot accuracy', suffix: '%' },
      { key: 'passAccuracy', label: 'Pass accuracy', suffix: '%' },
    ],
  },
  {
    id: 'possession',
    label: 'Possession',
    description: 'How much of the ball you held and how quickly you recovered it.',
    stats: [
      { key: 'possession', label: 'Possession', suffix: '%' },
      { key: 'ballRecoveryTime', label: 'Ball recovery time', suffix: 's' },
    ],
  },
  {
    id: 'shooting',
    label: 'Shooting',
    description: 'Chance creation, finishing volume, and expected goals.',
    stats: [
      { key: 'shots', label: 'Shots' },
      { key: 'shotsOnTarget', label: 'Shots on target' },
      { key: 'xG', label: 'Expected goals', decimals: 1 },
      { key: 'shotAccuracy', label: 'Shot accuracy', suffix: '%' },
    ],
  },
  {
    id: 'passing',
    label: 'Passing',
    description: 'Build-up volume and passing efficiency.',
    stats: [
      { key: 'passes', label: 'Passes' },
      { key: 'passAccuracy', label: 'Pass accuracy', suffix: '%' },
    ],
  },
  {
    id: 'defending',
    label: 'Defending',
    description: 'Defensive actions and goalkeeper interventions.',
    stats: [
      { key: 'tackles', label: 'Tackles' },
      { key: 'tacklesWon', label: 'Tackles won' },
      { key: 'interceptions', label: 'Interceptions' },
      { key: 'saves', label: 'Saves' },
    ],
  },
  {
    id: 'events',
    label: 'Events',
    description: 'Set pieces, discipline, and stoppages.',
    stats: [
      { key: 'foulsCommitted', label: 'Fouls committed' },
      { key: 'offsides', label: 'Offsides' },
      { key: 'corners', label: 'Corners' },
      { key: 'freeKicks', label: 'Free kicks' },
      { key: 'penaltyKicks', label: 'Penalty kicks' },
      { key: 'yellowCards', label: 'Yellow cards' },
    ],
  },
]
