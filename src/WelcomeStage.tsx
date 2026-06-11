import type { Match, Result } from './types'

const resultToneStyles = {
  win: {
    background: 'linear-gradient(145deg, #06D6A0 0%, #05CD99 100%)',
  },
  draw: {
    background: 'linear-gradient(145deg, #FFC766 0%, #FFB547 100%)',
  },
  loss: {
    background: 'linear-gradient(145deg, #F56B61 0%, #EE5D50 100%)',
  },
} as const

const resultToTone = (result: Result): keyof typeof resultToneStyles =>
  result === 'W' ? 'win' : result === 'D' ? 'draw' : 'loss'

type WelcomeStageProps = {
  formMatches: Match[]
  onLogMatch: () => void
}

export default function WelcomeStage({ formMatches, onLogMatch }: WelcomeStageProps) {
  return (
    <section className="welcome-intro welcome-intro--permanent" aria-label="Co-Op 26 Dashboard welcome">
      <div className="welcome-intro__form-letters" aria-hidden="true">
        {formMatches.map((match, index) => {
          const tone = resultToTone(match.result)

          return (
            <span
              key={`${match.id}-${index}`}
              className="record-display-font welcome-intro__form-letter"
              style={{ background: resultToneStyles[tone].background }}
            >
              {match.result}
            </span>
          )
        })}
      </div>

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
              <div className="welcome-intro__progress-fill welcome-intro__progress-fill--done" />
            </div>
          </div>

          <button
            type="button"
            className="welcome-intro__enter welcome-intro__enter--ready"
            onClick={onLogMatch}
          >
            + Log match
          </button>
        </div>
      </div>
    </section>
  )
}
