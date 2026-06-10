import { useEffect, useMemo, useRef, useState } from 'react'
import { markWelcomeIntroSeen } from './welcomeIntroStorage'

type WelcomeIntroProps = {
  onComplete: () => void
}

const LOAD_MS = 2800

export default function WelcomeIntro({ onComplete }: WelcomeIntroProps) {
  const prefersReducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )
  const [loaded, setLoaded] = useState(prefersReducedMotion)
  const [exiting, setExiting] = useState(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  useEffect(() => {
    if (prefersReducedMotion) return

    const timer = window.setTimeout(() => setLoaded(true), LOAD_MS)
    return () => window.clearTimeout(timer)
  }, [prefersReducedMotion])

  const enter = () => {
    if (!loaded || exiting) return
    setExiting(true)
    markWelcomeIntroSeen()
    window.setTimeout(() => onCompleteRef.current(), prefersReducedMotion ? 0 : 420)
  }

  return (
    <div
      className={`welcome-intro ${exiting ? 'welcome-intro--exit' : ''} ${
        prefersReducedMotion ? 'welcome-intro--reduced' : ''
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to the Co-Op 26 Dashboard"
    >
      <div className="welcome-intro__content">
        <div className="welcome-intro__accents" aria-hidden="true">
          <span className="welcome-intro__chip welcome-intro__chip--win">W</span>
          <span className="welcome-intro__chip welcome-intro__chip--draw">D</span>
          <span className="welcome-intro__chip welcome-intro__chip--loss">L</span>
        </div>

        <div className="welcome-intro__copy">
          <p className="record-display-font welcome-intro__line">Welcome to the</p>
          <p className="record-display-font welcome-intro__line welcome-intro__line--hero">
            <span className="welcome-intro__coop">CO-OP</span>{' '}
            <span className="welcome-intro__season">26</span>
          </p>
          <p className="record-display-font welcome-intro__line welcome-intro__line--dashboard">
            Dashboard
          </p>
        </div>

        <div className="welcome-intro__footer">
          <div className="welcome-intro__progress" aria-hidden="true">
            <div className="welcome-intro__progress-track">
              <div
                className={`welcome-intro__progress-fill ${
                  loaded ? 'welcome-intro__progress-fill--done' : 'welcome-intro__progress-fill--run'
                }`}
              />
            </div>
          </div>

          <button
            type="button"
            className={`welcome-intro__enter ${loaded ? 'welcome-intro__enter--ready' : ''}`}
            disabled={!loaded}
            onClick={enter}
          >
            Click to enter
          </button>
        </div>
      </div>
    </div>
  )
}
