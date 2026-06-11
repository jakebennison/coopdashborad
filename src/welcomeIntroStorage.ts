export const WELCOME_INTRO_SESSION_KEY = 'coop26-welcome-intro-session'

export function hasSeenWelcomeIntroThisSession(): boolean {
  try {
    return window.sessionStorage.getItem(WELCOME_INTRO_SESSION_KEY) === '1'
  } catch {
    return true
  }
}

export function markWelcomeIntroSeenThisSession(): void {
  try {
    window.sessionStorage.setItem(WELCOME_INTRO_SESSION_KEY, '1')
  } catch {
    // Ignore storage failures — intro may replay this session.
  }
}
