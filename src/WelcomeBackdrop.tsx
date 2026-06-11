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

type WelcomeBackdropProps = {
  formMatches: Match[]
}

export default function WelcomeBackdrop({ formMatches }: WelcomeBackdropProps) {
  return (
    <div className="welcome-backdrop" aria-hidden="true">
      <div className="welcome-backdrop__glow welcome-backdrop__glow--win" />
      <div className="welcome-backdrop__glow welcome-backdrop__glow--draw" />

      <div className="welcome-backdrop__form">
        {formMatches.map((match, index) => {
          const tone = resultToTone(match.result)

          return (
            <span
              key={`${match.id}-${index}`}
              className="record-display-font welcome-backdrop__letter"
              style={{ background: resultToneStyles[tone].background }}
            >
              {match.result}
            </span>
          )
        })}
      </div>

      <div className="welcome-backdrop__brand">
        <div className="welcome-backdrop__accents">
          <span className="welcome-backdrop__chip welcome-backdrop__chip--win">W</span>
          <span className="welcome-backdrop__chip welcome-backdrop__chip--draw">D</span>
          <span className="welcome-backdrop__chip welcome-backdrop__chip--loss">L</span>
        </div>
        <p className="record-display-font welcome-backdrop__line">Welcome to the</p>
        <p className="record-display-font welcome-backdrop__line welcome-backdrop__line--hero">
          <span className="welcome-backdrop__coop">CO-OP</span>{' '}
          <span className="welcome-backdrop__season">26</span>
        </p>
        <p className="record-display-font welcome-backdrop__line welcome-backdrop__line--dashboard">
          Dashboard
        </p>
      </div>
    </div>
  )
}
