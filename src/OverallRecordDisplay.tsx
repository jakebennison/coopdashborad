import { useEffect, useRef, useState, type ReactNode } from 'react'

type AnimatedCountUpProps = {
  value: number
  color: string
  delayMs?: number
  suffix?: string
  signed?: boolean
  className?: string
  glow?: boolean
}

const softGlowShadow = (color: string) =>
  `0 0 14px ${color}55, 0 0 28px ${color}33, 0 0 42px ${color}1a`

export function AnimatedCountUp({
  value,
  color,
  delayMs = 0,
  suffix = '',
  signed = false,
  className = 'text-[clamp(2.75rem,7vw,4.75rem)]',
  glow = false,
}: AnimatedCountUpProps) {
  const [displayValue, setDisplayValue] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    setDisplayValue(0)
    setIsAnimating(false)

    const startTimer = window.setTimeout(() => {
      const duration = 1300
      const startedAt = performance.now()

      setIsAnimating(true)

      const tick = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / duration)
        const eased = 1 - (1 - progress) ** 3
        setDisplayValue(Math.round(value * eased))

        if (progress < 1) {
          frameRef.current = requestAnimationFrame(tick)
        } else {
          setDisplayValue(value)
          setIsAnimating(false)
        }
      }

      frameRef.current = requestAnimationFrame(tick)
    }, delayMs)

    return () => {
      window.clearTimeout(startTimer)
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
      }
    }
  }, [delayMs, value])

  return (
    <p
      className={`number record-odometer-value font-bold leading-none ${
        isAnimating ? 'record-odometer-value-animating' : 'record-odometer-value-settled'
      } ${glow ? 'record-odometer-glow' : ''} ${className}`}
      style={{
        color,
        textShadow: glow ? softGlowShadow(color) : undefined,
      }}
      aria-label={`${signed && value > 0 ? '+' : ''}${value}${suffix}`}
    >
      {signed && displayValue > 0 ? '+' : ''}
      {displayValue}
      {suffix}
    </p>
  )
}

type OverallRecordDisplayProps = {
  wins: number
  draws: number
  losses: number
  metrics?: ReactNode
}

export default function OverallRecordDisplay({ wins, draws, losses, metrics }: OverallRecordDisplayProps) {
  return (
    <div className="flex items-start gap-6 sm:gap-10 lg:gap-14 xl:gap-16">
      <div className="flex shrink-0 flex-col pt-1 leading-none">
        <p className="text-[clamp(1.85rem,4.5vw,3rem)] record-display-font font-bold leading-[0.9]">
          OVERALL
        </p>
        <p className="text-[clamp(1.85rem,4.5vw,3rem)] record-display-font font-bold leading-[0.9]">
          RECORD
        </p>
      </div>

      <div className="flex min-w-0 items-stretch gap-3 sm:gap-4 lg:gap-5">
        <div className="record-odometer-stack flex shrink-0 flex-col items-end leading-none">
          <AnimatedCountUp value={wins} color="#05CD99" delayMs={80} glow />
          <AnimatedCountUp value={draws} color="#FFB547" delayMs={220} glow />
          <AnimatedCountUp value={losses} color="#EE5D50" delayMs={360} glow />
        </div>

        {metrics ? (
          <div className="grid h-full min-h-0 w-full max-w-[9.5rem] shrink-0 grid-rows-3 gap-2 sm:max-w-[10rem]">
            {metrics}
          </div>
        ) : null}
      </div>
    </div>
  )
}
