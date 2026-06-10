import { useMemo, useRef, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  averageOpponentStat,
  averagePsgStat,
  buildComparisonRows,
  buildTrendData,
  formatAnalysisValue,
  formatComparisonDelta,
  getYAxisConfig,
  matchesWithStats,
  type ComparisonMode,
  type ComparisonRow,
  type TrendDataPoint,
} from './analysisUtils'
import { statsCategories, type StatsCategory } from './statsCategories'
import type { Match } from './types'
import { getThemeColors, type Theme } from './theme'

const panelClass = 'card'
const headingClass = 'record-display-font text-base font-bold uppercase sm:text-lg'
const secondaryButtonClass = 'btn-secondary px-3 py-2 text-xs'
const tabActiveClass = 'btn-tab-active px-4 py-2 text-sm font-semibold'
const tabInactiveClass = 'btn-tab-inactive px-4 py-2 text-sm font-semibold'

const PSG_COLOR = '#05CD99'
const OPP_COLOR = '#8F9BB3'

function MatchInsightPanel({
  point,
  statLabel,
  suffix = '',
  decimals = 0,
  placeholder = 'Hover directly over a dot to see the match and stat values.',
}: {
  point: TrendDataPoint | null
  statLabel: string
  suffix?: string
  decimals?: number
  placeholder?: string
}) {
  if (!point) {
    return (
      <div className="mb-3 rounded-xl border border-dashed border-ink/40 bg-soft px-4 py-3">
        <p className="text-xs text-muted">{placeholder}</p>
      </div>
    )
  }

  return (
    <div className="mb-3 rounded-xl border border-ink bg-soft px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">vs {point.opponentName}</p>
          <p className="mt-0.5 text-xs text-muted">{point.fullDate}</p>
          <p className="text-xs text-muted">{point.matchSummary}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{statLabel}</p>
          <p className="number text-sm font-bold" style={{ color: PSG_COLOR }}>
            PSG {formatAnalysisValue(point.psg, suffix, decimals)}
          </p>
          <p className="number text-sm font-semibold text-muted">
            Opp {formatAnalysisValue(point.opponent, suffix, decimals)}
          </p>
        </div>
      </div>
    </div>
  )
}

function LineHoverDot({
  cx,
  cy,
  index,
  fill,
  activeIndex,
  onHover,
}: {
  cx?: number
  cy?: number
  index?: number
  fill?: string
  activeIndex: number | null
  onHover: (index: number) => void
}) {
  if (typeof cx !== 'number' || typeof cy !== 'number' || index == null) return null

  const isActive = activeIndex === index
  const radius = isActive ? 7 : 5

  return (
    <circle
      cx={cx}
      cy={cy}
      r={radius}
      fill={fill}
      stroke="var(--color-card)"
      strokeWidth={2}
      style={{ cursor: 'pointer', pointerEvents: 'all' }}
      onMouseEnter={() => onHover(index)}
    />
  )
}

const overviewStats = [
  { key: 'possession' as const, label: 'Possession', suffix: '%' },
  { key: 'xG' as const, label: 'Expected goals', suffix: '', decimals: 1 },
  { key: 'shots' as const, label: 'Shots', suffix: '' },
] as const

type ChartTooltipProps = {
  active?: boolean
  payload?: Array<{
    name?: string
    value?: number
    color?: string
    dataKey?: string | number
    payload?: { team?: string; name?: string }
  }>
  label?: string
  statLabel?: string
  suffix?: string
  decimals?: number
}

function ChartTooltipContent({
  active,
  payload,
  label,
  statLabel,
  suffix,
  decimals,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-xl border border-ink bg-card px-3 py-2 text-ink shadow-sm">
      {statLabel ? (
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{statLabel}</p>
      ) : null}
      {label ? <p className="mb-1 text-xs font-semibold text-muted">{label}</p> : null}
      <div className="grid gap-1">
        {payload.map((entry) => {
          const seriesName =
            entry.payload?.team ??
            entry.payload?.name ??
            (entry.dataKey === 'psg'
              ? 'PSG'
              : entry.dataKey === 'opponent'
                ? 'Opposition'
                : entry.name)
          const formatted = formatAnalysisValue(
            typeof entry.value === 'number' ? entry.value : null,
            suffix,
            decimals,
          )

          return (
            <p
              key={`${seriesName}-${entry.dataKey}`}
              className="text-sm font-semibold"
              style={{ color: entry.color ?? 'var(--color-ink)' }}
            >
              {seriesName}: {formatted}
            </p>
          )
        })}
      </div>
    </div>
  )
}

function TeamLegend() {
  return (
    <div className="flex flex-wrap gap-4 text-xs font-semibold">
      <span className="inline-flex items-center gap-1.5 text-ink">
        <span
          className="inline-block h-2.5 w-2.5 rounded-sm"
          style={{ background: PSG_COLOR }}
        />
        PSG
      </span>
      <span className="inline-flex items-center gap-1.5 text-muted">
        <span
          className="inline-block h-2.5 w-2.5 rounded-sm"
          style={{ background: OPP_COLOR }}
        />
        Opposition
      </span>
    </div>
  )
}

function ValuePair({
  label,
  statKey,
  psg,
  opponent,
  suffix = '',
  decimals = 0,
}: {
  label: string
  statKey: ComparisonRow['key']
  psg: number | null
  opponent: number | null
  suffix?: string
  decimals?: number
}) {
  const delta = formatComparisonDelta({
    key: statKey,
    psg,
    opponent,
    suffix,
    decimals,
  })

  return (
    <div className="rounded-2xl border border-ink bg-card px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase text-muted">PSG</p>
          <p className="number text-2xl font-bold leading-none" style={{ color: PSG_COLOR }}>
            {formatAnalysisValue(psg, suffix, decimals)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase text-muted">Opposition</p>
          <p className="number text-lg font-semibold leading-none text-muted">
            {formatAnalysisValue(opponent, suffix, decimals)}
          </p>
        </div>
      </div>
      {delta ? (
        <p
          className={`mt-2 text-xs font-semibold ${
            delta.tone === 'psg'
              ? 'text-[#05CD99]'
              : delta.tone === 'opp'
                ? 'text-muted'
                : 'text-muted'
          }`}
        >
          {delta.tone === 'psg' ? 'PSG edge' : delta.tone === 'opp' ? 'Opposition edge' : 'Level'} ·{' '}
          {delta.text}
        </p>
      ) : null}
    </div>
  )
}

function StatsOverview({ matches }: { matches: Match[] }) {
  return (
    <div className="grid gap-3 border-b border-ink px-6 py-5 sm:grid-cols-3">
      {overviewStats.map((field) => (
        <ValuePair
          key={field.key}
          statKey={field.key}
          label={`Avg ${field.label.toLowerCase()}`}
          psg={averagePsgStat(matches, field.key)}
          opponent={averageOpponentStat(matches, field.key)}
          suffix={field.suffix}
          decimals={'decimals' in field ? field.decimals : 0}
        />
      ))}
    </div>
  )
}

type StatsAnalysisProps = {
  matches: Match[]
  scopeLabel?: string
  theme: Theme
}

export default function DetailedStats({ matches, scopeLabel, theme }: StatsAnalysisProps) {
  const colors = useMemo(() => getThemeColors(theme), [theme])
  const statMatches = useMemo(() => matchesWithStats(matches), [matches])
  const [activeIndex, setActiveIndex] = useState(0)
  const carouselRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef<number | null>(null)

  const goTo = (index: number) => {
    const next = Math.max(0, Math.min(statsCategories.length - 1, index))
    setActiveIndex(next)
    carouselRef.current?.children[next]?.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    })
  }

  const handleTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0]?.clientX ?? null
  }

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const delta = (event.changedTouches[0]?.clientX ?? 0) - touchStartX.current
    if (Math.abs(delta) > 48) {
      goTo(activeIndex + (delta < 0 ? 1 : -1))
    }
    touchStartX.current = null
  }

  if (!statMatches.length) {
    return (
      <section className={`${panelClass} p-6`}>
        <h3 className={headingClass}>Detailed stats analysis</h3>
        <p className="mt-2 text-sm text-muted">
          Upload screenshot matches to unlock summary, possession, shooting, passing, defending, and
          events breakdowns.
        </p>
      </section>
    )
  }

  return (
    <section className={`${panelClass} overflow-hidden`}>
      <div className="border-b border-ink px-6 py-5">
        <p className="record-display-font text-xs font-bold uppercase text-muted">Match stats breakdown</p>
        <h3 className={`${headingClass} mt-1`}>Stat analysis</h3>
        <p className="mt-1 text-sm text-muted">
          {scopeLabel ?? `${statMatches.length} logged matches`} · averages per match, PSG vs
          opposition
        </p>
      </div>

      <StatsOverview matches={statMatches} />

      <div className="border-b border-ink px-4 py-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {statsCategories.map((category, index) => (
            <button
              key={category.id}
              type="button"
              onClick={() => goTo(index)}
              className={`shrink-0 transition ${
                index === activeIndex ? tabActiveClass : tabInactiveClass
              }`}
            >
              {category.label}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={carouselRef}
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onScroll={(event) => {
          const width = event.currentTarget.clientWidth
          if (!width) return
          const index = Math.round(event.currentTarget.scrollLeft / width)
          if (index !== activeIndex) setActiveIndex(index)
        }}
      >
        {statsCategories.map((category) => (
          <div key={category.id} className="w-full shrink-0 snap-center p-6">
            <CategoryPanel category={category} matches={statMatches} colors={colors} />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-2 border-t border-ink px-6 py-4">
        <button
          type="button"
          onClick={() => goTo(activeIndex - 1)}
          disabled={activeIndex === 0}
          className={`${secondaryButtonClass} record-display-font disabled:opacity-40`}
        >
          ← Prev
        </button>
        <div className="flex gap-1.5">
          {statsCategories.map((category, index) => (
            <button
              key={category.id}
              type="button"
              aria-label={`Show ${category.label}`}
              onClick={() => goTo(index)}
              className={`h-2.5 rounded-full transition ${
                index === activeIndex ? 'w-6 bg-[var(--color-ink)]' : 'w-2.5 bg-[var(--color-ink)]/20'
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => goTo(activeIndex + 1)}
          disabled={activeIndex === statsCategories.length - 1}
          className={`${secondaryButtonClass} record-display-font disabled:opacity-40`}
        >
          Next →
        </button>
      </div>
    </section>
  )
}

function ComparisonModeToggle({
  mode,
  onChange,
}: {
  mode: ComparisonMode
  onChange: (mode: ComparisonMode) => void
}) {
  return (
    <div className="inline-flex rounded-lg border border-ink bg-card p-1">
      <button
        type="button"
        onClick={() => onChange('total')}
        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
          mode === 'total' ? tabActiveClass : tabInactiveClass
        }`}
      >
        Season totals
      </button>
      <button
        type="button"
        onClick={() => onChange('average')}
        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
          mode === 'average' ? tabActiveClass : tabInactiveClass
        }`}
      >
        Per-match avg
      </button>
    </div>
  )
}

function comparisonModeLabel(row: ComparisonRow) {
  if (row.averageOnly) return 'Per-match average'
  return row.comparisonMode === 'average' ? 'Per-match average' : 'Season total'
}

function CategoryPanel({
  category,
  matches,
  colors,
}: {
  category: StatsCategory
  matches: Match[]
  colors: ReturnType<typeof getThemeColors>
}) {
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('total')
  const rows = useMemo(
    () => buildComparisonRows(matches, category.stats, comparisonMode),
    [category.stats, comparisonMode, matches],
  )
  const trendKey = category.stats[0]?.key
  const trendData = useMemo(
    () => (trendKey ? buildTrendData(matches, trendKey) : []),
    [matches, trendKey],
  )
  const chartRows = rows.filter(
    (row) => typeof row.psg === 'number' || typeof row.opponent === 'number',
  )

  const psgWins = rows.filter((row) => row.psgWins === true).length
  const comparable = rows.filter((row) => row.psgWins !== null).length

  return (
    <div className="grid gap-6">
      <div className="rounded-2xl border border-ink bg-soft px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className={headingClass}>{category.label}</h4>
            <p className="mt-1 text-sm text-muted">{category.description}</p>
          </div>
          {comparable > 0 ? (
            <div className="rounded-xl border border-ink bg-card px-3 py-2 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">PSG ahead</p>
              <p className="number text-xl font-bold text-ink">
                {psgWins}
                <span className="text-sm font-medium text-muted"> / {comparable}</span>
              </p>
            </div>
          ) : null}
        </div>
        <div className="mt-4">
          <TeamLegend />
        </div>
      </div>

      {category.gaugeStats?.length ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {category.gaugeStats.map((field) => (
            <EfficiencyGauge
              key={field.key}
              label={field.label}
              suffix={field.suffix ?? ''}
              psg={averagePsgStat(matches, field.key)}
              opponent={averageOpponentStat(matches, field.key)}
            />
          ))}
        </div>
      ) : null}

      {chartRows.length ? (
        <CategoryComparisonChart rows={chartRows} colors={colors} comparisonMode={comparisonMode} />
      ) : null}

      {trendData.length > 1 ? (
        <TrendChart
          label={category.stats[0]?.label ?? 'Stat'}
          data={trendData}
          suffix={category.stats[0]?.suffix}
          decimals={category.stats[0]?.decimals}
          statKey={category.stats[0]?.key}
          colors={colors}
        />
      ) : null}

      <div className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Stat-by-stat breakdown</p>
            <p className="mt-1 text-xs text-muted">
              Count stats use season totals by default. Percentages always use per-match average.
            </p>
          </div>
          <ComparisonModeToggle mode={comparisonMode} onChange={setComparisonMode} />
        </div>
        {rows.map((row) => (
          <ComparisonStatRow key={row.key} row={row} />
        ))}
      </div>
    </div>
  )
}

function CategoryComparisonChart({
  rows,
  colors,
  comparisonMode,
}: {
  rows: ComparisonRow[]
  colors: ReturnType<typeof getThemeColors>
  comparisonMode: ComparisonMode
}) {
  const chartTitle =
    comparisonMode === 'average' ? 'Category averages' : 'Category season totals'
  const chartDescription =
    comparisonMode === 'average'
      ? 'Per-match averages for each stat in this section'
      : 'Combined totals across logged matches. Percentages still show per-match average.'

  return (
    <div className="grid gap-4">
      <div>
        <p className="text-sm font-semibold text-ink">{chartTitle}</p>
        <p className="mt-1 text-xs text-muted">{chartDescription}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {rows.map((row) =>
          row.key === 'possession' && rows.length === 1 ? (
            <PossessionComparisonChart key={row.key} row={row} colors={colors} />
          ) : (
            <StatComparisonChart key={row.key} row={row} colors={colors} />
          ),
        )}
      </div>
    </div>
  )
}

function StatComparisonChart({
  row,
  colors,
}: {
  row: ComparisonRow
  colors: ReturnType<typeof getThemeColors>
}) {
  const hasPsg = typeof row.psg === 'number'
  const hasOpponent = typeof row.opponent === 'number'

  if (!hasPsg && !hasOpponent) {
    return (
      <div className="flex h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-ink bg-card px-4 text-center">
        <h5 className="text-sm font-semibold text-ink">{row.label}</h5>
        <p className="mt-2 text-xs text-muted">No data logged for this stat yet.</p>
      </div>
    )
  }

  const barData = [
    { team: 'PSG', value: row.psg ?? 0, color: PSG_COLOR },
    { team: 'Opposition', value: row.opponent ?? 0, color: OPP_COLOR },
  ]
  const yAxis = getYAxisConfig(row.psg, row.opponent, row.suffix, row.decimals, row.key)
  const delta = formatComparisonDelta(row)

  return (
    <div className="rounded-2xl border border-ink bg-card p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h5 className="text-sm font-semibold text-ink">{row.label}</h5>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
            {comparisonModeLabel(row)}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <p>
              <span className="font-semibold text-muted">PSG </span>
              <span className="number font-bold" style={{ color: PSG_COLOR }}>
                {formatAnalysisValue(row.psg, row.suffix, row.decimals)}
              </span>
            </p>
            <p>
              <span className="font-semibold text-muted">Opp </span>
              <span className="number font-bold text-muted">
                {formatAnalysisValue(row.opponent, row.suffix, row.decimals)}
              </span>
            </p>
          </div>
        </div>
        {delta ? (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              delta.tone === 'psg'
                ? 'bg-[#E8F7F1] text-[#05CD99]'
                : 'bg-soft text-muted'
            }`}
          >
            {delta.text}
          </span>
        ) : null}
      </div>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={barData} barCategoryGap="35%">
            <CartesianGrid stroke={colors.ink} strokeOpacity={0.08} vertical={false} />
            <XAxis
              dataKey="team"
              tick={{ fill: colors.chartMuted, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={yAxis.domain}
              allowDecimals={yAxis.allowDecimals}
              tickCount={yAxis.tickCount}
              tick={{ fill: colors.chartMuted, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) =>
                row.suffix === '%' ? `${value}%` : `${value}${row.suffix ?? ''}`
              }
            />
            <Tooltip
              content={
                <ChartTooltipContent statLabel={row.label} suffix={row.suffix} decimals={row.decimals} />
              }
            />
            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
              {barData.map((entry) => (
                <Cell key={entry.team} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function PossessionComparisonChart({
  row,
  colors,
}: {
  row: ComparisonRow
  colors: ReturnType<typeof getThemeColors>
}) {
  const psgValue = typeof row.psg === 'number' ? row.psg : 0
  const opponentValue =
    typeof row.opponent === 'number' ? row.opponent : Math.max(100 - psgValue, 0)
  const pieData = [
    { name: 'PSG', value: psgValue, color: PSG_COLOR },
    { name: 'Opposition', value: opponentValue, color: OPP_COLOR },
  ]

  return (
    <div className="rounded-2xl border border-ink bg-card p-4">
      <p className="text-sm font-semibold text-ink">Possession split</p>
      <div className="relative mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="58%"
              outerRadius="82%"
              paddingAngle={2}
              stroke="var(--color-card)"
              strokeWidth={3}
            >
              {pieData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltipContent statLabel={row.label} suffix="%" decimals={row.decimals} />} />
            <Legend
              verticalAlign="bottom"
              iconType="circle"
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-8">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            PSG share
          </span>
          <span className="number mt-1 text-3xl font-bold" style={{ color: PSG_COLOR }}>
            {formatAnalysisValue(row.psg, '%', row.decimals)}
          </span>
          <span className="mt-1 text-xs font-medium text-muted">
            Opp {formatAnalysisValue(row.opponent ?? opponentValue, '%', row.decimals)}
          </span>
        </div>
      </div>
    </div>
  )
}

function TrendChart({
  label,
  data,
  suffix,
  decimals,
  statKey,
  colors,
}: {
  label: string
  data: ReturnType<typeof buildTrendData>
  suffix?: string
  decimals?: number
  statKey?: ComparisonRow['key']
  colors: ReturnType<typeof getThemeColors>
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const hoveredPoint = hoveredIndex != null ? (data[hoveredIndex] ?? null) : null
  const psgValues = data.map((entry) => entry.psg).filter((value): value is number => typeof value === 'number')
  const opponentValues = data
    .map((entry) => entry.opponent)
    .filter((value): value is number => typeof value === 'number')
  const yAxis = getYAxisConfig(
    psgValues.length ? Math.max(...psgValues) : null,
    opponentValues.length ? Math.max(...opponentValues) : null,
    suffix,
    decimals,
    statKey,
  )
  const clearHover = () => setHoveredIndex(null)
  const renderDot =
    (fill: string) =>
    (props: { cx?: number; cy?: number; index?: number; fill?: string }) => (
      <LineHoverDot
        cx={props.cx}
        cy={props.cy}
        index={props.index}
        fill={fill}
        activeIndex={hoveredIndex}
        onHover={setHoveredIndex}
      />
    )

  return (
    <div className="rounded-2xl border border-ink bg-card p-4">
      <p className="text-sm font-semibold text-ink">{label} over recent matches</p>
      <p className="mt-1 text-xs text-muted">Last {data.length} logged matches with this stat</p>
      <MatchInsightPanel
        point={hoveredPoint}
        statLabel={label}
        suffix={suffix}
        decimals={decimals}
      />
      <div className="h-56" onMouseLeave={clearHover}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid stroke={colors.ink} strokeOpacity={0.08} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: colors.chartMuted, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={yAxis.domain}
              allowDecimals={yAxis.allowDecimals}
              tickCount={yAxis.tickCount}
              tick={{ fill: colors.chartMuted, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="psg"
              name="PSG"
              stroke={PSG_COLOR}
              strokeWidth={3}
              style={{ pointerEvents: 'none' }}
              dot={renderDot(PSG_COLOR)}
              activeDot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="opponent"
              name="Opposition"
              stroke={OPP_COLOR}
              strokeWidth={2.5}
              strokeDasharray="6 4"
              style={{ pointerEvents: 'none' }}
              dot={renderDot(OPP_COLOR)}
              activeDot={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function ComparisonStatRow({ row }: { row: ComparisonRow }) {
  const psg = row.psg
  const opponent = row.opponent
  const hasBoth = typeof psg === 'number' && typeof opponent === 'number'
  const delta = formatComparisonDelta(row)
  const modeLabel = comparisonModeLabel(row)
  const aheadLabel =
    row.comparisonMode === 'average' ? 'PSG ahead on average' : 'PSG ahead in totals'
  const behindLabel =
    row.comparisonMode === 'average'
      ? 'Opposition ahead on average'
      : 'Opposition ahead in totals'
  let psgWidth = typeof psg === 'number' ? 100 : 0
  let opponentWidth = 0

  if (hasBoth) {
    const total = Math.max(psg + opponent, 1)
    psgWidth = (psg / total) * 100
    opponentWidth = (opponent / total) * 100
  }

  return (
    <div className="rounded-2xl border border-ink bg-card p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-ink">{row.label}</p>
          <p className="mt-1 text-xs text-muted">{modeLabel}</p>
          {row.averageOnly && row.comparisonMode === 'average' ? (
            <p className="mt-1 text-[11px] text-muted">Percentages are always compared as per-match averages.</p>
          ) : null}
          {row.psgWins === true ? (
            <p className="mt-1 text-xs font-semibold text-[#05CD99]">{aheadLabel}</p>
          ) : null}
          {row.psgWins === false ? (
            <p className="mt-1 text-xs font-semibold text-muted">{behindLabel}</p>
          ) : null}
        </div>
        {delta ? (
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              delta.tone === 'psg'
                ? 'bg-[#E8F7F1] text-[#05CD99]'
                : delta.tone === 'opp'
                  ? 'bg-soft text-muted'
                  : 'bg-soft text-muted'
            }`}
          >
            {delta.text}
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-soft px-3 py-2">
          <p className="text-[10px] font-semibold uppercase text-muted">PSG</p>
          <p className="number mt-1 text-lg font-bold" style={{ color: PSG_COLOR }}>
            {formatAnalysisValue(row.psg, row.suffix, row.decimals)}
          </p>
        </div>
        <div className="rounded-xl bg-soft px-3 py-2">
          <p className="text-[10px] font-semibold uppercase text-muted">Opposition</p>
          <p className="number mt-1 text-lg font-bold text-muted">
            {formatAnalysisValue(row.opponent, row.suffix, row.decimals)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-soft">
        {typeof psg === 'number' && psgWidth > 0 ? (
          <div
            className="h-full rounded-l-full"
            style={{ width: `${psgWidth}%`, background: PSG_COLOR }}
          />
        ) : null}
        {typeof opponent === 'number' && opponentWidth > 0 ? (
          <div
            className="h-full rounded-r-full"
            style={{ width: `${opponentWidth}%`, background: OPP_COLOR }}
          />
        ) : null}
        {!hasBoth && typeof psg === 'number' ? (
          <div className="h-full rounded-full" style={{ width: `${psgWidth}%`, background: PSG_COLOR }} />
        ) : null}
      </div>
    </div>
  )
}

function EfficiencyGauge({
  label,
  psg,
  opponent,
  suffix,
}: {
  label: string
  psg: number | null
  opponent: number | null
  suffix: string
}) {
  const psgValue = typeof psg === 'number' ? Math.min(Math.max(psg, 0), 100) : null
  const opponentValue = typeof opponent === 'number' ? Math.min(Math.max(opponent, 0), 100) : null
  const delta = formatComparisonDelta({
    key: 'passAccuracy',
    psg,
    opponent,
    suffix,
    decimals: 0,
  })

  return (
    <div className="rounded-2xl border border-ink bg-card p-4">
      <p className="text-sm font-semibold text-ink">{label}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-soft px-3 py-2 text-center">
          <p className="text-[10px] font-semibold uppercase text-muted">PSG</p>
          <p className="number mt-1 text-xl font-bold" style={{ color: PSG_COLOR }}>
            {formatAnalysisValue(psgValue, suffix)}
          </p>
        </div>
        <div className="rounded-xl bg-soft px-3 py-2 text-center">
          <p className="text-[10px] font-semibold uppercase text-muted">Opp</p>
          <p className="number mt-1 text-xl font-bold text-muted">
            {formatAnalysisValue(opponentValue, suffix)}
          </p>
        </div>
      </div>
      {delta ? (
        <p className="mt-2 text-center text-xs font-semibold text-muted">{delta.text} vs opposition</p>
      ) : null}
    </div>
  )
}
