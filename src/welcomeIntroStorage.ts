export const WELCOME_INTRO_STORAGE_KEY = 'coop26-welcome-intro-seen'

export function hasSeenWelcomeIntro(): boolean {
  try {
    return window.localStorage.getItem(WELCOME_INTRO_STORAGE_KEY) === '1'
  } catch {
    return true
  }
}

export function markWelcomeIntroSeen(): void {
  try {
    window.localStorage.setItem(WELCOME_INTRO_STORAGE_KEY, '1')
  } catch {
    // Ignore storage failures — intro may replay next visit.
  }
}
