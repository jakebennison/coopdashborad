export const DEFAULT_PLAYED_TEAMS = ['Real Madrid', 'Manchester United', 'PSG', 'France'] as const

export const DEFAULT_SELECTED_TEAM = 'France'

export const MAJOR_CLUBS = [
  'Arsenal',
  'AC Milan',
  'Ajax',
  'Atalanta',
  'Athletic Club',
  'Atletico Madrid',
  'Barcelona',
  'Bayern Munich',
  'Benfica',
  'Borussia Dortmund',
  'Brentford',
  'Brighton',
  'Celtic',
  'Chelsea',
  'Crystal Palace',
  'Eintracht Frankfurt',
  'Everton',
  'Fenerbahce',
  'Fiorentina',
  'Fulham',
  'Galatasaray',
  'Inter',
  'Ipswich Town',
  'Juventus',
  'Lazio',
  'Leicester City',
  'Lille',
  'Liverpool',
  'Lyon',
  'Manchester City',
  'Manchester United',
  'Marseille',
  'Monaco',
  'Napoli',
  'Newcastle United',
  'Nottingham Forest',
  'Porto',
  'PSG',
  'RB Leipzig',
  'Rangers',
  'Real Betis',
  'Real Madrid',
  'Real Sociedad',
  'Roma',
  'Sevilla',
  'Southampton',
  'Tottenham Hotspur',
  'Villarreal',
  'West Ham United',
  'Wolverhampton Wanderers',
] as const

export const NATIONAL_TEAMS = [
  'Algeria',
  'Argentina',
  'Australia',
  'Austria',
  'Belgium',
  'Brazil',
  'Cameroon',
  'Canada',
  'Chile',
  'Colombia',
  'Croatia',
  'Czech Republic',
  'Denmark',
  'Ecuador',
  'Egypt',
  'England',
  'Finland',
  'France',
  'Germany',
  'Ghana',
  'Greece',
  'Hungary',
  'Iceland',
  'Iran',
  'Ireland',
  'Italy',
  'Ivory Coast',
  'Japan',
  'Mexico',
  'Morocco',
  'Netherlands',
  'Nigeria',
  'Norway',
  'Poland',
  'Portugal',
  'Qatar',
  'Romania',
  'Saudi Arabia',
  'Scotland',
  'Senegal',
  'Serbia',
  'Slovakia',
  'Slovenia',
  'South Africa',
  'South Korea',
  'Spain',
  'Sweden',
  'Switzerland',
  'Tunisia',
  'Turkey',
  'Ukraine',
  'United States',
  'Uruguay',
  'Wales',
] as const

/** In-game EA FC display names for known teams (uppercase as shown on screen). */
const TEAM_GAME_NAMES: Record<string, string[]> = {
  PSG: ['PARIS SG', 'PSG'],
  'Paris Saint-Germain': ['PARIS SG', 'PSG'],
  'Real Madrid': ['REAL MADRID'],
  Barcelona: ['BARCELONA', 'FC BARCELONA'],
  'Manchester United': ['MAN UTD', 'MANCHESTER UTD', 'MANCHESTER UNITED'],
  'Manchester City': ['MAN CITY', 'MANCHESTER CITY'],
  Liverpool: ['LIVERPOOL'],
  Chelsea: ['CHELSEA'],
  Arsenal: ['ARSENAL'],
  'Bayern Munich': ['BAYERN MUNICH', 'FC BAYERN', 'BAYERN'],
  'Borussia Dortmund': ['DORTMUND', 'BORUSSIA DORTMUND'],
  Juventus: ['JUVENTUS'],
  Inter: ['INTER', 'INTER MILAN'],
  'AC Milan': ['AC MILAN', 'MILAN'],
  Napoli: ['NAPOLI'],
  France: ['FRANCE'],
  Brazil: ['BRAZIL'],
  England: ['ENGLAND'],
  Spain: ['SPAIN'],
  Germany: ['GERMANY'],
  Italy: ['ITALY'],
  Portugal: ['PORTUGAL'],
  Netherlands: ['NETHERLANDS'],
  Argentina: ['ARGENTINA'],
  Belgium: ['BELGIUM'],
  Croatia: ['CROATIA'],
  Morocco: ['MOROCCO'],
  Japan: ['JAPAN'],
  'United States': ['USA', 'UNITED STATES'],
  Mexico: ['MEXICO'],
  Canada: ['CANADA'],
  Scotland: ['SCOTLAND'],
  Wales: ['WALES'],
  Ireland: ['REPUBLIC OF IRELAND', 'IRELAND'],
  Turkey: ['TURKEY'],
  Senegal: ['SENEGAL'],
  'South Korea': ['KOREA REPUBLIC', 'SOUTH KOREA'],
  'Ivory Coast': ['IVORY COAST', "COTE D'IVOIRE"],
}

export const ALL_TEAM_PRESETS = [...MAJOR_CLUBS, ...NATIONAL_TEAMS]

export const getGameDisplayNames = (team: string): string[] => {
  const trimmed = team.trim()
  if (!trimmed) return []

  const mapped = TEAM_GAME_NAMES[trimmed]
  if (mapped?.length) return [...new Set(mapped)]

  const upper = trimmed.toUpperCase()
  return [upper]
}

export const getPrimaryGameDisplayName = (team: string): string =>
  getGameDisplayNames(team)[0] ?? team.trim().toUpperCase()

export const teamMatchesGameName = (team: string, gameName: string): boolean => {
  const normalized = gameName.trim().toUpperCase()
  if (!normalized) return false

  return getGameDisplayNames(team).some((alias) => alias === normalized)
}

export const formatMatchTitle = (playedAs: string, opponent: string) =>
  `${playedAs} vs ${opponent}`

export const getTeamInitials = (team: string): string => {
  const words = team.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return '?'
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase()
  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}

export const normalizeTeamLabel = (team: string): string => {
  const trimmed = team.trim()
  if (!trimmed) return trimmed

  if (trimmed.toLowerCase().includes('paris')) return 'PSG'
  return trimmed
}

export const addPlayedTeam = (teams: string[], newTeam: string): string[] => {
  const label = normalizeTeamLabel(newTeam)
  if (!label) return teams

  const exists = teams.some((team) => team.toLowerCase() === label.toLowerCase())
  return exists ? teams : [...teams, label]
}

export const filterPresetTeams = (query: string, exclude: string[] = []): string[] => {
  const needle = query.trim().toLowerCase()
  const excluded = new Set(exclude.map((team) => team.toLowerCase()))

  return ALL_TEAM_PRESETS.filter((team) => {
    if (excluded.has(team.toLowerCase())) return false
    if (!needle) return true
    return team.toLowerCase().includes(needle)
  })
}
