export interface MatchStats {
  possession: number | null
  shots: number | null
  shotsOnTarget: number | null
  xG: number | null
  passes: number | null
  passAccuracy: number | null
  tackles: number | null
  tacklesWon: number | null
  interceptions: number | null
  saves: number | null
  foulsCommitted: number | null
  offsides: number | null
  corners: number | null
  freeKicks: number | null
  yellowCards: number | null
  dribbleSuccessRate: number | null
  shotAccuracy: number | null
  ballRecoveryTime: number | null
  penaltyKicks: number | null
}

export interface MatchCommentReply {
  id: string
  author: string
  body: string
  createdAt: string
  likes: number
  likedByMe: boolean
}

export interface MatchComment {
  id: string
  author: string
  body: string
  createdAt: string
  likes: number
  likedByMe: boolean
  replies: MatchCommentReply[]
}

export interface Match {
  id: number
  date: string
  opponent: string
  venue: 'home' | 'away'
  myScore: number
  opponentScore: number
  result: 'W' | 'D' | 'L'
  loggedVia: LoggedVia
  stats: MatchStats | null
  opponentStats?: Partial<MatchStats> | null
  xboxContentId?: string | null
  hasArchivedScreenshot?: boolean
  comments?: MatchComment[]
  /** @deprecated Migrated to comments on read */
  comment?: string | null
  manualEntryReason?: string | null
}

export type Result = Match['result']
export type Venue = Match['venue']
export type LoggedVia = 'screenshot' | 'quick-log' | 'xbox' | 'manual-form'

export interface UpdateNote {
  id: number
  title: string
  body: string
  date: string
  createdAt: string
}

export type PsgSide = 'left' | 'right' | 'both' | 'invalid'

export interface ExtractedTeamStats {
  score: number | null
  possession: number | null
  shots: number | null
  shotsOnTarget: number | null
  xG: number | null
  passes?: number | null
  passAccuracy?: number | null
  tackles?: number | null
  tacklesWon?: number | null
  interceptions?: number | null
  saves?: number | null
  foulsCommitted?: number | null
  offsides?: number | null
  corners?: number | null
  freeKicks?: number | null
  yellowCards?: number | null
  dribbleSuccessRate?: number | null
  shotAccuracy?: number | null
  ballRecoveryTime?: number | null
  penaltyKicks?: number | null
}

export interface ExtractedOpponentStats {
  name: string
  score: number | null
  possession: number | null
  shots: number | null
  shotsOnTarget: number | null
  xG: number | null
  passes?: number | null
  passAccuracy?: number | null
  tackles?: number | null
  tacklesWon?: number | null
  interceptions?: number | null
  saves?: number | null
  foulsCommitted?: number | null
  offsides?: number | null
  corners?: number | null
  freeKicks?: number | null
  yellowCards?: number | null
  dribbleSuccessRate?: number | null
  shotAccuracy?: number | null
  ballRecoveryTime?: number | null
  penaltyKicks?: number | null
}

export interface VisionExtraction {
  psgSide: PsgSide
  venue: Venue
  /** Calendar date visible on the stats screen, if any (YYYY-MM-DD). */
  matchDate?: string | null
  /** Left screen column when psgSide is "both". */
  leftTeam?: ExtractedOpponentStats
  /** Right screen column when psgSide is "both". */
  rightTeam?: ExtractedOpponentStats
  psg: ExtractedTeamStats
  opponent: ExtractedOpponentStats
}

export interface DraftMatch {
  date: string
  opponent: string
  venue: Venue
  myScore: number | null
  opponentScore: number | null
  loggedVia: LoggedVia
  stats: MatchStats | null
  opponentStats?: Partial<MatchStats> | null
  xboxContentId?: string | null
  screenshotArchiveKey?: string | null
  comment?: string | null
  commentAuthor?: string | null
}
