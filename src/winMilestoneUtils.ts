export const LAST_WIN_MILESTONE_CELEBRATED_KEY = 'coop26-last-win-milestone-celebrated'

export const isWinCenturyMilestone = (wins: number) => wins >= 100 && wins % 100 === 0

export const shouldCelebrateWinMilestone = (wins: number, lastCelebrated: number) =>
  isWinCenturyMilestone(wins) && wins > lastCelebrated

export const readLastWinMilestoneCelebrated = (): number => {
  try {
    const raw = window.localStorage.getItem(LAST_WIN_MILESTONE_CELEBRATED_KEY)
    const parsed = raw ? Number(raw) : 0
    return Number.isFinite(parsed) ? parsed : 0
  } catch {
    return 0
  }
}

export const markWinMilestoneCelebrated = (wins: number) => {
  if (!isWinCenturyMilestone(wins) || typeof window === 'undefined') return

  try {
    window.localStorage.setItem(LAST_WIN_MILESTONE_CELEBRATED_KEY, String(wins))
  } catch {
    // Ignore storage failures — celebration may replay next visit.
  }
}
