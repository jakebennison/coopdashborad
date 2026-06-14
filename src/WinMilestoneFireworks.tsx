import { useMemo } from 'react'

type Particle = {
  id: number
  x: number
  y: number
  size: number
  color: string
  delayMs: number
  durationMs: number
}

const FIREWORK_COLORS = ['#05CD99', '#FFB547', '#EE5D50', '#f5f5f5', '#004170', '#DA291C']

const buildParticles = (count: number, spread: number, delayOffsetMs: number): Particle[] =>
  Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.35
    const distance = spread * (0.55 + Math.random() * 0.55)

    return {
      id: index + delayOffsetMs,
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      size: 3 + Math.random() * 4,
      color: FIREWORK_COLORS[index % FIREWORK_COLORS.length],
      delayMs: delayOffsetMs + Math.random() * 120,
      durationMs: 900 + Math.random() * 500,
    }
  })

type WinMilestoneFireworksProps = {
  active: boolean
}

export default function WinMilestoneFireworks({ active }: WinMilestoneFireworksProps) {
  const particles = useMemo(
    () => [...buildParticles(18, 52, 0), ...buildParticles(14, 34, 180), ...buildParticles(10, 68, 360)],
    [active],
  )

  if (!active) return null

  return (
    <div className="win-milestone-fireworks" aria-hidden>
      <span className="win-milestone-fireworks__flash" />
      <span className="win-milestone-fireworks__ring win-milestone-fireworks__ring--one" />
      <span className="win-milestone-fireworks__ring win-milestone-fireworks__ring--two" />
      {particles.map((particle) => (
        <span
          key={particle.id}
          className="win-milestone-fireworks__particle"
          style={{
            ['--tx' as string]: `${particle.x}px`,
            ['--ty' as string]: `${particle.y}px`,
            ['--size' as string]: `${particle.size}px`,
            ['--color' as string]: particle.color,
            ['--delay' as string]: `${particle.delayMs}ms`,
            ['--duration' as string]: `${particle.durationMs}ms`,
          }}
        />
      ))}
    </div>
  )
}
