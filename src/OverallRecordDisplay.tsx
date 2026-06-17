import { useEffect, useMemo, useRef, useState } from 'react'
import WinMilestoneFireworks from './WinMilestoneFireworks'
import {
  markWinMilestoneCelebrated,
  readLastWinMilestoneCelebrated,
  shouldCelebrateWinMilestone,
} from './winMilestoneUtils'

type AnimatedCountUpProps = {
  value: number
  color: string
  delayMs?: number
  suffix?: string
  signed?: boolean
  className?: string
  glow?: boolean
  active?: boolean
  durationMs?: number
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
  active = true,
  durationMs = 1300,
}: AnimatedCountUpProps) {
  const [displayValue, setDisplayValue] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }

    if (!active) {
      setDisplayValue(0)
      setIsAnimating(false)
      return
    }

    setDisplayValue(0)
    setIsAnimating(false)

    const startTimer = window.setTimeout(() => {
      const startedAt = performance.now()

      setIsAnimating(true)

      const tick = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / durationMs)
        const eased = 1 - (1 - progress) ** 3
        setDisplayValue(Math.round(value * eased))

        if (progress < 1) {
          frameRef.current = requestAnimationFrame(tick)
        } else {
          setDisplayValue(value)
          setIsAnimating(false)
          frameRef.current = null
        }
      }

      frameRef.current = requestAnimationFrame(tick)
    }, delayMs)

    return () => {
      window.clearTimeout(startTimer)
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
    }
  }, [active, delayMs, durationMs, value])

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
  animate?: boolean
}

export function RecordHeaderLabel() {
  return (
    <div className="flex shrink-0 flex-col pt-1 leading-none">
      <p className="text-[clamp(1.85rem,4.5vw,3rem)] record-display-font font-bold leading-[0.9]">
        OVERALL
      </p>
      <p className="text-[clamp(1.85rem,4.5vw,3rem)] record-display-font font-bold leading-[0.9]">
        RECORD
      </p>
    </div>
  )
}

export function RecordOdometerStack({ wins, draws, losses, animate = true }: OverallRecordDisplayProps) {
  const [fireworksActive, setFireworksActive] = useState(false)
  const prefersReducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )
  const celebratedRef = useRef<number | null>(null)

  useEffect(() => {
    if (!animate || prefersReducedMotion) return

    const lastCelebrated = readLastWinMilestoneCelebrated()
    if (!shouldCelebrateWinMilestone(wins, lastCelebrated)) return
    if (celebratedRef.current === wins) return

    const startTimer = window.setTimeout(() => {
      celebratedRef.current = wins
      setFireworksActive(true)
      markWinMilestoneCelebrated(wins)

      window.setTimeout(() => setFireworksActive(false), 2400)
    }, 1450)

    return () => window.clearTimeout(startTimer)
  }, [animate, prefersReducedMotion, wins])

  return (
    <div className="record-odometer-stack flex shrink-0 flex-col items-end leading-none">
      <div className="record-odometer-wins">
        <WinMilestoneFireworks active={fireworksActive} />
        <AnimatedCountUp
          value={wins}
          color="#05CD99"
          delayMs={120}
          durationMs={1800}
          glow
          active={animate}
        />
      </div>
      <AnimatedCountUp
        value={draws}
        color="#FFB547"
        delayMs={280}
        durationMs={1800}
        glow
        active={animate}
      />
      <AnimatedCountUp
        value={losses}
        color="#EE5D50"
        delayMs={440}
        durationMs={1800}
        glow
        active={animate}
      />
    </div>
  )
}

export default function OverallRecordDisplay({ wins, draws, losses, animate = true }: OverallRecordDisplayProps) {
  return (
    <div className="flex items-start gap-8 sm:gap-14 lg:gap-20">
      <RecordHeaderLabel />
      <RecordOdometerStack wins={wins} draws={draws} losses={losses} animate={animate} />
    </div>
  )
}
