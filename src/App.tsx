import type { FormEvent, ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { extractMatchFromScreenshot } from './anthropic'
import { getPrimaryCommentPreview, readDefaultCommentAuthor } from './commentUtils'
import MatchComments from './MatchComments'
import {
  clearAllMatches,
  createEmptyStats,
  deleteMatchById,
  extractionToDraft,
  formatStatValue,
  getCurrentUnbeatenStreak,
  getLongestUnbeatenRun,
  getLongestWinningRun,
  createManualFormMatch,
  getFormTickerMatches,
  getImportedXboxContentIds,
  getMatchRecord,
  getSeasonRecord,
  getTrackerRecord,
  getXgRecord,
  isManualFormMatch,
  isStatsMatch,
  normaliseTeamName,
  readMatches,
  sortMatchesNewestFirst,
  statFields,
  STORAGE_KEY,
  toMatch,
  updateMatchComments,
  type ExtractionDraftOptions,
  type ManualFormDraft,
} from './matchUtils'
import { fileDateToInputValue } from './statParsing'
import DetailedStats from './DetailedStats'
import {
  createMatchRemote,
  deleteAllMatchesRemote,
  deleteMatchRemote,
  fetchMatches,
  getMatchScreenshotUrl,
  updateMatchRemote,
} from './matchesApi'
import OverallRecordDisplay, { AnimatedCountUp } from './OverallRecordDisplay'
import UpdateTimeline from './UpdateTimeline'
import WelcomeIntro from './WelcomeIntro'
import { applyTheme, getThemeColors, readTheme, type Theme } from './theme'
import { hasSeenWelcomeIntro } from './welcomeIntroStorage'

const SEASON_CLUBS = ['Real Madrid', 'Manchester United', 'PSG'] as const
import {
  buildDuplicateComparison,
  findDuplicateMatches,
  formatLoggedMatchLabel,
} from './duplicateUtils'
import type { DraftMatch, Match, MatchStats, Result, Venue, VisionExtraction } from './types'
import {
  extractMatchFromXboxScreenshot,
  fetchXboxScreenshots,
  formatXboxCaptureDate,
  formatXboxSyncTime,
  type XboxScreenshotItem,
  type XboxSyncStatus,
} from './xbox'

type View = 'dashboard' | 'stats' | 'add' | 'detail' | 'settings' | 'updates'

const resultColors: Record<Result, string> = {
  W: '#05CD99',
  D: '#FFB547',
  L: '#EE5D50',
}

const resultToneStyles = {
  win: {
    background: 'linear-gradient(145deg, #06D6A0 0%, #05CD99 100%)',
    shadow: '0 14px 30px rgba(5, 205, 153, 0.35)',
  },
  draw: {
    background: 'linear-gradient(145deg, #FFC766 0%, #FFB547 100%)',
    shadow: '0 14px 30px rgba(255, 181, 71, 0.35)',
  },
  loss: {
    background: 'linear-gradient(145deg, #F56B61 0%, #EE5D50 100%)',
    shadow: '0 14px 30px rgba(238, 93, 80, 0.35)',
  },
} as const

const resultToTone = (result: Result): keyof typeof resultToneStyles =>
  result === 'W' ? 'win' : result === 'D' ? 'draw' : 'loss'

const winRateColor = (rate: number) => {
  if (rate >= 60) return resultColors.W
  if (rate >= 40) return resultColors.D
  return resultColors.L
}

const panelClass = 'card'
const innerBoxClass = 'box-inner'
const subtleTextClass = 'text-sm text-muted'
const inputClass = 'field-input px-4 py-3'
const labelClass = 'record-display-font mb-2 block text-xs font-bold uppercase'
const headingClass = 'record-display-font text-base font-bold uppercase sm:text-lg'
const primaryButtonClass = 'btn-primary px-5 py-3'
const secondaryButtonClass = 'btn-secondary px-4 py-2'
const tabActiveClass = 'btn-tab-active px-4 py-2 text-sm font-semibold'
const tabInactiveClass = 'btn-tab-inactive px-4 py-2 text-sm font-semibold'

function App() {
  const [matches, setMatches] = useState<Match[]>([])
  const [matchesLoading, setMatchesLoading] = useState(true)
  const [matchesError, setMatchesError] = useState<string | null>(null)
  const [view, setView] = useState<View>('dashboard')
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null)
  const [theme, setTheme] = useState<Theme>(() => readTheme())
  const [showWelcomeIntro, setShowWelcomeIntro] = useState(() => !hasSeenWelcomeIntro())

  useEffect(() => {
    let cancelled = false

    setMatchesLoading(true)
    fetchMatches()
      .then(async (loaded) => {
        if (cancelled) return

        if (loaded.length) {
          setMatches(loaded)
          setMatchesError(null)
          return
        }

        const localMatches = readMatches()
        if (!localMatches.length) {
          setMatches([])
          setMatchesError(null)
          return
        }

        for (const match of localMatches) {
          await createMatchRemote(match)
        }

        window.localStorage.removeItem(STORAGE_KEY)
        const imported = await fetchMatches()
        if (cancelled) return
        setMatches(imported)
        setMatchesError(null)
      })
      .catch((error) => {
        if (cancelled) return
        setMatchesError(error instanceof Error ? error.message : 'Could not load matches.')
      })
      .finally(() => {
        if (!cancelled) setMatchesLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [view, selectedMatchId])

  const selectedMatch = useMemo(
    () => matches.find((match) => match.id === selectedMatchId) ?? null,
    [matches, selectedMatchId],
  )

  const saveDraft = async (draft: DraftMatch) => {
    const match = toMatch(draft)

    try {
      const saved = await createMatchRemote(match, draft.screenshotArchiveKey)
      setMatches((current) => sortMatchesNewestFirst([saved, ...current]))
      setMatchesError(null)
      setSelectedMatchId(null)
      setView('dashboard')
    } catch (error) {
      setMatchesError(error instanceof Error ? error.message : 'Could not save match.')
    }
  }

  const saveManualFormEntry = async (draft: ManualFormDraft) => {
    const match = createManualFormMatch(draft)

    try {
      await createMatchRemote(match)
      setMatches((current) => sortMatchesNewestFirst([match, ...current]))
      setMatchesError(null)
    } catch (error) {
      setMatchesError(error instanceof Error ? error.message : 'Could not save match.')
    }
  }

  const openMatch = (match: Match) => {
    setSelectedMatchId(match.id)
    setView('detail')
  }

  const removeMatch = async (id: number) => {
    try {
      await deleteMatchRemote(id)
      setMatches((current) => deleteMatchById(current, id))
      setMatchesError(null)
      if (selectedMatchId === id) {
        setSelectedMatchId(null)
        setView('dashboard')
      }
    } catch (error) {
      setMatchesError(error instanceof Error ? error.message : 'Could not delete match.')
    }
  }

  const resetAllMatches = async () => {
    try {
      await deleteAllMatchesRemote()
      setMatches(clearAllMatches())
      setMatchesError(null)
      setSelectedMatchId(null)
      setView('dashboard')
    } catch (error) {
      setMatchesError(error instanceof Error ? error.message : 'Could not clear matches.')
    }
  }

  const saveMatchComments = async (id: number, comments: Match['comments']) => {
    const nextMatches = updateMatchComments(matches, id, comments ?? [])
    const updated = nextMatches.find((match) => match.id === id)
    if (!updated) return

    setMatches(nextMatches)

    try {
      await updateMatchRemote(updated)
      setMatchesError(null)
    } catch (error) {
      setMatchesError(error instanceof Error ? error.message : 'Could not save comments.')
      try {
        setMatches(await fetchMatches())
      } catch {
        // Keep optimistic state if refresh also fails.
      }
    }
  }

  const pageTitle =
    view === 'dashboard'
      ? 'CO-OP 26 Dashboard'
      : view === 'stats'
        ? 'Stats analysis'
        : view === 'add'
          ? 'Add match'
          : view === 'settings'
            ? 'Settings'
            : view === 'updates'
              ? 'Tool updates'
              : selectedMatch
              ? `PSG vs ${selectedMatch.opponent}`
              : 'Match detail'

  return (
    <div
      className={`min-h-screen ${showWelcomeIntro ? 'overflow-hidden bg-[#101010]' : 'bg-page text-ink'}`}
    >
      {showWelcomeIntro ? <WelcomeIntro onComplete={() => setShowWelcomeIntro(false)} /> : null}
      <div
        className={`mx-auto flex min-h-screen max-w-[1440px] flex-col lg:flex-row ${
          showWelcomeIntro ? 'invisible' : ''
        }`}
        aria-hidden={showWelcomeIntro}
      >
        <aside className="card m-4 flex shrink-0 flex-col gap-8 p-5 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:w-64 lg:self-start">
          <button type="button" className="text-left" onClick={() => setView('dashboard')}>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-ink bg-[var(--color-primary-bg)] text-sm font-bold text-[var(--color-primary-text)]">
                PSG
              </div>
              <div>
                <p className="record-display-font text-sm font-bold uppercase">Match Tracker</p>
                <p className="text-xs font-semibold text-muted">Co-op Seasons</p>
              </div>
            </div>
          </button>

          <nav className="grid gap-1">
            <NavButton active={view === 'dashboard'} onClick={() => setView('dashboard')}>
              Dashboard
            </NavButton>
            <NavButton active={view === 'stats'} onClick={() => setView('stats')}>
              Stats analysis
            </NavButton>
            <NavButton active={view === 'add'} onClick={() => setView('add')}>
              Add match
            </NavButton>
            <NavButton active={view === 'settings'} onClick={() => setView('settings')}>
              Settings
            </NavButton>
            <NavButton active={view === 'updates'} onClick={() => setView('updates')}>
              Updates
            </NavButton>
          </nav>

          <div className="mt-auto grid gap-3">
            <div className="hidden box-inner p-4 lg:block">
              <p className="record-display-font text-xs font-bold uppercase">Season overview</p>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Track results, form, and match stats from post-match screenshots.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setTheme((current) => (current === 'night' ? 'day' : 'night'))}
              className="theme-toggle w-full px-4 py-3 text-left"
              aria-pressed={theme === 'night'}
            >
              {theme === 'night' ? '☀ Day mode' : '🌙 Night mode'}
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-6 px-4 pb-6 pt-4 lg:px-6 lg:pb-8 lg:pt-6">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="record-display-font text-xs font-bold uppercase text-muted">
                {view === 'dashboard' ? 'Home' : pageTitle}
              </p>
              <h1 className="record-display-font mt-1 text-2xl font-bold uppercase sm:text-3xl">
                {pageTitle}
              </h1>
            </div>
            {view === 'dashboard' && (
              <button type="button" onClick={() => setView('add')} className={primaryButtonClass}>
                + Log match
              </button>
            )}
          </header>

          {matchesError ? (
            <div className="rounded-2xl border border-ink bg-danger px-4 py-3 text-sm font-medium text-[#EE5D50]">
              {matchesError}
            </div>
          ) : null}

          {matchesLoading ? (
            <div className={`${panelClass} px-6 py-10 text-center text-sm font-medium text-muted`}>
              Loading shared match data…
            </div>
          ) : null}

          {!matchesLoading && view === 'dashboard' && (
            <Dashboard
              matches={matches}
              theme={theme}
              onAdd={() => setView('add')}
              onOpenMatch={openMatch}
              onAddManualFormEntry={saveManualFormEntry}
            />
          )}
          {!matchesLoading && view === 'stats' && (
            <DetailedStats
              matches={matches.filter(isStatsMatch)}
              theme={theme}
              scopeLabel={`Season view · ${matches.filter(isStatsMatch).length} matches logged`}
            />
          )}
          {view === 'add' && (
            <AddMatch
              onSave={saveDraft}
              existingMatches={matches}
              importedXboxIds={getImportedXboxContentIds(matches)}
            />
          )}
          {view === 'detail' && selectedMatch && (
            <MatchDetail
              match={selectedMatch}
              theme={theme}
              onBack={() => setView('dashboard')}
              onDelete={() => removeMatch(selectedMatch.id)}
              onSaveComments={(comments) => saveMatchComments(selectedMatch.id, comments)}
            />
          )}
          {view === 'settings' && (
            <Settings
              matches={matches}
              onDeleteMatch={removeMatch}
              onClearAll={resetAllMatches}
            />
          )}
          {view === 'updates' && <UpdateTimeline />}
        </div>
      </div>
    </div>
  )
}

function NavButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-lg px-4 py-3 text-left text-sm font-semibold transition ${
        active ? tabActiveClass : tabInactiveClass
      }`}
    >
      {children}
    </button>
  )
}

function Dashboard({
  matches,
  theme,
  onAdd,
  onOpenMatch,
  onAddManualFormEntry,
}: {
  matches: Match[]
  theme: Theme
  onAdd: () => void
  onOpenMatch: (match: Match) => void
  onAddManualFormEntry: (draft: ManualFormDraft) => void
}) {
  const chartColors = useMemo(() => getThemeColors(theme), [theme])
  const sortedMatches = useMemo(() => sortMatchesNewestFirst(matches), [matches])
  const statsMatches = useMemo(() => matches.filter(isStatsMatch), [matches])
  const formMatches = useMemo(() => getFormTickerMatches(matches), [matches])
  const record = getSeasonRecord(matches)
  const total = record.W + record.D + record.L
  const winRate = total ? Math.round((record.W / total) * 100) : 0
  const goalsFor = statsMatches.reduce((sum, match) => sum + match.myScore, 0)
  const goalsAgainst = statsMatches.reduce((sum, match) => sum + match.opponentScore, 0)
  const homeMatches = statsMatches.filter((match) => match.venue === 'home')
  const awayMatches = statsMatches.filter((match) => match.venue === 'away')
  const lastTen = sortMatchesNewestFirst(statsMatches).slice(0, 10)
  const chartData = [...lastTen].reverse().map((match) => ({
    label: new Date(match.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    fullDate: new Date(match.date).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    opponentName: match.opponent,
    matchSummary: `${match.myScore}-${match.opponentScore} ${match.result} · ${match.venue === 'home' ? 'Home' : 'Away'}`,
    scored: match.myScore,
    conceded: match.opponentScore,
  }))

  const avgPossession = average(statsMatches.map((match) => match.stats?.possession ?? null))
  const avgXg = average(statsMatches.map((match) => match.stats?.xG ?? null))
  const xgRecord = useMemo(() => getXgRecord(statsMatches), [statsMatches])
  const unbeatenStreak = useMemo(() => getCurrentUnbeatenStreak(matches), [matches])
  const longestUnbeatenRun = useMemo(() => getLongestUnbeatenRun(matches), [matches])
  const longestWinningRun = useMemo(() => getLongestWinningRun(matches), [matches])
  const trackerRecord = useMemo(() => getTrackerRecord(matches), [matches])
  const [hoveredGoalIndex, setHoveredGoalIndex] = useState<number | null>(null)
  const hoveredGoalPoint = hoveredGoalIndex != null ? (chartData[hoveredGoalIndex] ?? null) : null

  return (
    <main className="grid gap-6">
      <section className={`${panelClass} p-6`}>
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between xl:gap-10">
          <div className="min-w-0 shrink-0">
            <OverallRecordDisplay wins={record.W} draws={record.D} losses={record.L} />
          </div>
          <div className="flex w-full max-w-[11.5rem] shrink-0 flex-col gap-3 xl:w-[11.5rem]">
            <div className={`${innerBoxClass} px-4 py-3`}>
              <p className="record-display-font text-xs font-bold uppercase">Win rate</p>
              <AnimatedCountUp
                value={winRate}
                color={winRateColor(winRate)}
                suffix="%"
                delayMs={500}
                className="mt-1 text-2xl sm:text-3xl"
              />
            </div>
            <div className={`${innerBoxClass} px-4 py-3`}>
              <p className="record-display-font text-xs font-bold uppercase">Matches played</p>
              <AnimatedCountUp
                value={total}
                color="var(--color-ink)"
                delayMs={640}
                className="mt-1 text-2xl sm:text-3xl"
              />
            </div>
          </div>
          <div className="w-full max-w-[15rem] shrink-0 xl:w-[15rem]">
            <SeasonClubsPlayed clubs={SEASON_CLUBS} />
          </div>
        </div>

        <FormTicker
          matches={formMatches}
          unbeatenStreak={unbeatenStreak}
          longestUnbeatenRun={longestUnbeatenRun}
          longestWinningRun={longestWinningRun}
          trackerRecord={trackerRecord}
          onAddManualEntry={onAddManualFormEntry}
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard label="Goals scored" value={goalsFor} />
        <MetricCard label="Goals conceded" value={goalsAgainst} />
        <MetricCard label="Goal difference" value={goalsFor - goalsAgainst} signed />
        <MetricCard label="Avg possession" value={avgPossession} suffix="%" />
        <MetricCard label="Avg xG" value={avgXg} decimals={1} footer={<XgRecordText record={xgRecord} />} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div className={`${panelClass} p-6`}>
          <h2 className={headingClass}>Home / away split</h2>
          <div className="mt-4 grid gap-3">
            <SplitRecord label="Home" matches={homeMatches} />
            <SplitRecord label="Away" matches={awayMatches} />
          </div>
        </div>

        <div className={`${panelClass} min-h-[21rem] p-6`}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className={headingClass}>Goals — last 10 matches</h2>
            <span className="text-xs font-medium text-muted">Scored / conceded</span>
          </div>
          {chartData.length ? (
            <>
              {hoveredGoalPoint ? (
                <div className="mb-3 rounded-xl border border-ink bg-soft px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">vs {hoveredGoalPoint.opponentName}</p>
                      <p className="mt-0.5 text-xs text-muted">{hoveredGoalPoint.fullDate}</p>
                      <p className="text-xs text-muted">{hoveredGoalPoint.matchSummary}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Goals</p>
                      <p className="number text-sm font-bold text-ink">
                        Scored {hoveredGoalPoint.scored}
                      </p>
                      <p className="number text-sm font-semibold text-muted">
                        Conceded {hoveredGoalPoint.conceded}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mb-3 rounded-xl border border-dashed border-ink/40 bg-soft px-4 py-3">
                  <p className="text-xs text-muted">Hover directly over a dot to see which match it was.</p>
                </div>
              )}
              <div className="h-72" onMouseLeave={() => setHoveredGoalIndex(null)}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ left: -8, right: 8, top: 12, bottom: 4 }}>
                  <CartesianGrid stroke={chartColors.ink} strokeOpacity={0.08} vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: chartColors.chartMuted, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: chartColors.chartMuted, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    wrapperStyle={{ fontSize: 12, paddingTop: 16, color: chartColors.ink }}
                  />
                  <Line
                    type="monotone"
                    dataKey="scored"
                    name="Goals scored"
                    stroke={chartColors.ink}
                    strokeWidth={2.5}
                    style={{ pointerEvents: 'none' }}
                    dot={(props) => {
                      if (typeof props.cx !== 'number' || typeof props.cy !== 'number' || props.index == null) {
                        return null
                      }

                      const isActive = hoveredGoalIndex === props.index
                      const radius = isActive ? 7 : 5

                      return (
                        <circle
                          cx={props.cx}
                          cy={props.cy}
                          r={radius}
                          fill={chartColors.ink}
                          stroke="var(--color-card)"
                          strokeWidth={2}
                          style={{ cursor: 'pointer', pointerEvents: 'all' }}
                          onMouseEnter={() => setHoveredGoalIndex(props.index ?? null)}
                        />
                      )
                    }}
                    activeDot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="conceded"
                    name="Goals conceded"
                    stroke="#EE5D50"
                    strokeWidth={2.5}
                    style={{ pointerEvents: 'none' }}
                    dot={(props) => {
                      if (typeof props.cx !== 'number' || typeof props.cy !== 'number' || props.index == null) {
                        return null
                      }

                      const isActive = hoveredGoalIndex === props.index
                      const radius = isActive ? 7 : 5

                      return (
                        <circle
                          cx={props.cx}
                          cy={props.cy}
                          r={radius}
                          fill="#EE5D50"
                          stroke="var(--color-card)"
                          strokeWidth={2}
                          style={{ cursor: 'pointer', pointerEvents: 'all' }}
                          onMouseEnter={() => setHoveredGoalIndex(props.index ?? null)}
                        />
                      )
                    }}
                    activeDot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            </>
          ) : (
            <EmptyState onAdd={onAdd} />
          )}
        </div>
      </section>

      <section className={`${panelClass} overflow-hidden`}>
        <div className="border-b border-ink px-6 py-5">
          <h2 className={headingClass}>Match history</h2>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {sortedMatches.length ? (
            sortedMatches.map((match) => (
              <button
                key={match.id}
                type="button"
                onClick={() => onOpenMatch(match)}
                className="grid w-full gap-3 px-6 py-5 text-left transition hover:bg-soft sm:grid-cols-[8rem_1fr_auto] sm:items-center"
              >
                <span className="text-sm font-medium text-muted">
                  {new Date(match.date).toLocaleDateString()}
                </span>
                <span>
                  <span className="block text-base font-semibold text-ink">
                    {isManualFormMatch(match) ? `PSG vs ${match.opponent}` : match.opponent}
                  </span>
                  <span className="mt-1 block text-sm text-muted">
                    {isManualFormMatch(match)
                      ? `Manual form · ${match.venue === 'home' ? 'Home' : 'Away'}`
                      : quickStatsLine(match)}
                  </span>
                  {isManualFormMatch(match) && match.manualEntryReason ? (
                    <span className="mt-1 block text-sm text-muted italic">
                      “{truncateComment(match.manualEntryReason)}”
                    </span>
                  ) : null}
                  {!isManualFormMatch(match) && getPrimaryCommentPreview(match) ? (
                    <span className="mt-1 block text-sm text-muted italic">
                      “{truncateComment(getPrimaryCommentPreview(match)!)}”
                    </span>
                  ) : null}
                </span>
                <span className="flex items-center gap-2 sm:justify-end">
                  {!isManualFormMatch(match) ? (
                    <span className="number text-lg font-semibold text-ink">
                      {match.myScore}-{match.opponentScore}
                    </span>
                  ) : null}
                  <ResultBadge result={match.result} />
                  <VenueBadge venue={match.venue} />
                </span>
              </button>
            ))
          ) : (
            <div className="p-6">
              <EmptyState onAdd={onAdd} />
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

function AddMatch({
  onSave,
  existingMatches,
  importedXboxIds,
}: {
  onSave: (draft: DraftMatch) => void
  existingMatches: Match[]
  importedXboxIds: string[]
}) {
  return (
    <main className={`${panelClass} overflow-hidden`}>
      <div className="border-b border-ink px-6 py-5">
        <p className="record-display-font text-xs font-bold uppercase text-muted">New entry</p>
        <h2 className={`${headingClass} mt-1`}>Log a match</h2>
        <p className="mt-1 text-sm text-muted">
          Upload a stats screenshot or pick one from your Xbox EA FC library, then review before
          saving.
        </p>
      </div>
      <div className="px-6 pb-6 pt-5">
        <ScreenshotFlow
          onSave={onSave}
          existingMatches={existingMatches}
          importedXboxIds={importedXboxIds}
        />
      </div>
    </main>
  )
}

type MatchSource = 'upload' | 'xbox'

function ScreenshotFlow({
  onSave,
  existingMatches,
  importedXboxIds,
}: {
  onSave: (draft: DraftMatch) => void
  existingMatches: Match[]
  importedXboxIds: string[]
}) {
  const [source, setSource] = useState<MatchSource>('upload')
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [extraction, setExtraction] = useState<VisionExtraction | null>(null)
  const [draft, setDraft] = useState<DraftMatch | null>(null)
  const [extractDraftOptions, setExtractDraftOptions] = useState<ExtractionDraftOptions | null>(null)
  const [xboxScreenshots, setXboxScreenshots] = useState<XboxScreenshotItem[]>([])
  const [xboxGamertag, setXboxGamertag] = useState<string | null>(null)
  const [xboxSyncStatus, setXboxSyncStatus] = useState<XboxSyncStatus | null>(null)
  const [xboxLastSyncedAt, setXboxLastSyncedAt] = useState<string | null>(null)
  const [isLoadingXbox, setIsLoadingXbox] = useState(false)
  const [xboxLoaded, setXboxLoaded] = useState(false)
  const [selectedXboxId, setSelectedXboxId] = useState<string | null>(null)
  const [showXboxLibrary, setShowXboxLibrary] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const draftOptions = extractDraftOptions ?? undefined

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const resetFlow = () => {
    setError(null)
    setDraft(null)
    setExtraction(null)
    setExtractDraftOptions(null)
    setSelectedXboxId(null)
  }

  const processFile = async (file: File | undefined) => {
    if (!file) return
    resetFlow()
    setIsProcessing(true)

    try {
      const options: ExtractionDraftOptions = {
        loggedVia: 'screenshot',
        screenshotDate: fileDateToInputValue(file),
      }
      setExtractDraftOptions(options)
      const { extraction: extracted, screenshotArchiveKey } = await extractMatchFromScreenshot(file)
      setExtractDraftOptions({ ...options, screenshotArchiveKey })
      if (extracted.psgSide === 'both') {
        setExtraction(extracted)
      } else {
        setDraft(extractionToDraft(extracted, undefined, options))
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Could not extract match data.'
      setError(message)
    } finally {
      setIsProcessing(false)
      resetFileInput()
    }
  }

  const loadXboxScreenshots = async () => {
    setError(null)
    setIsLoadingXbox(true)

    try {
      const result = await fetchXboxScreenshots(importedXboxIds)
      setXboxScreenshots(result.screenshots)
      setXboxGamertag(result.gamertag)
      setXboxSyncStatus(result.syncStatus)
      setXboxLastSyncedAt(result.lastSyncedAt)
      setXboxLoaded(true)
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : 'Could not load Xbox screenshots.'
      setError(message)
      setXboxLoaded(false)
    } finally {
      setIsLoadingXbox(false)
    }
  }

  const processXboxScreenshot = async (screenshot: XboxScreenshotItem) => {
    if (screenshot.alreadyImported) return

    resetFlow()
    setSelectedXboxId(screenshot.contentId)
    setIsProcessing(true)

    try {
      const { extraction: extracted, contentId, screenshotArchiveKey } =
        await extractMatchFromXboxScreenshot(screenshot)
      const options: ExtractionDraftOptions = {
        loggedVia: 'xbox',
        xboxContentId: contentId,
        screenshotDate: screenshot.captureDate,
        screenshotArchiveKey,
      }
      setExtractDraftOptions(options)

      if (extracted.psgSide === 'both') {
        setExtraction(extracted)
      } else {
        setDraft(extractionToDraft(extracted, undefined, options))
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Could not extract match data.'
      setError(message)
    } finally {
      setIsProcessing(false)
    }
  }

  const chooseSide = (side: 'left' | 'right') => {
    if (!extraction) return
    setDraft(extractionToDraft(extraction, side, draftOptions))
    setExtraction(null)
  }

  useEffect(() => {
    if (source !== 'xbox' || xboxLoaded || isLoadingXbox) return
    void loadXboxScreenshots()
  }, [source, xboxLoaded, isLoadingXbox, importedXboxIds.join(',')])

  useEffect(() => {
    if (source !== 'xbox') setShowXboxLibrary(false)
  }, [source])

  const xboxLibrarySummary = () => {
    if (isLoadingXbox && !xboxScreenshots.length) return 'Loading screenshots from Xbox…'
    if (!xboxLoaded) return 'Connecting to your Xbox library…'

    const count = xboxScreenshots.length
    if (!count) {
      return `Connected to ${xboxGamertag ?? 'your Xbox account'} · expand for sync help`
    }

    const importedCount = xboxScreenshots.filter((screenshot) => screenshot.alreadyImported).length
    const freshCount = count - importedCount
    const syncHint =
      xboxSyncStatus === 'cached'
        ? ' · showing last synced captures'
        : xboxSyncStatus === 'live'
          ? ' · live from Xbox'
          : ''

    return `${count} screenshot${count === 1 ? '' : 's'}${freshCount !== count ? ` · ${freshCount} new` : ''}${syncHint}`
  }

  if (draft) {
    return (
      <ReviewForm
        draft={draft}
        existingMatches={existingMatches}
        onChange={setDraft}
        onSave={onSave}
        title="Review extracted match"
        description="Edit any score, opponent, venue, or stat before saving."
      />
    )
  }

  if (extraction?.psgSide === 'both') {
    return (
      <div className="grid gap-4">
        <div className="rounded-2xl border border-ink bg-warning p-5">
          <h3 className="text-lg font-semibold text-ink">Which side are you?</h3>
          <p className="mt-2 text-sm text-muted">
            Both sides were detected as the same club. Choose your side to set home or away.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => chooseSide('left')}
            className={`${primaryButtonClass} p-5 text-lg`}
          >
            Left
          </button>
          <button
            type="button"
            onClick={() => chooseSide('right')}
            className="rounded-xl border border-ink bg-[#EE5D50] p-5 text-lg font-semibold text-white"
          >
            Right
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <div className="inline-flex rounded-lg border border-ink bg-card p-1">
        <button
          type="button"
          onClick={() => {
            setSource('upload')
            resetFlow()
          }}
          className={`px-4 py-2 text-sm font-semibold transition ${
            source === 'upload' ? tabActiveClass : tabInactiveClass
          }`}
        >
          Upload file
        </button>
        <button
          type="button"
          onClick={() => {
            setSource('xbox')
            resetFlow()
          }}
          className={`px-4 py-2 text-sm font-semibold transition ${
            source === 'xbox' ? tabActiveClass : tabInactiveClass
          }`}
        >
          Import from Xbox
        </button>
      </div>

      {source === 'upload' ? (
        <div
          onDragOver={(event) => {
            event.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setIsDragging(false)
            void processFile(event.dataTransfer.files[0])
          }}
          className={`rounded-2xl border-2 border-dashed p-8 text-center transition ${
            isDragging ? 'border-ink bg-soft' : 'border-ink bg-card'
          }`}
        >
          <p className="text-lg font-semibold text-ink">Drop a stats screenshot here</p>
          <p className="mt-2 text-sm text-muted">
            Claude Vision will detect the side, score, and visible stats for review.
          </p>
          <label
            className={`${primaryButtonClass} mt-5 inline-flex ${
              isProcessing ? 'pointer-events-none opacity-60' : 'cursor-pointer'
            }`}
          >
            Select screenshot
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={isProcessing}
              onChange={(event) => void processFile(event.target.files?.[0])}
            />
          </label>
        </div>
      ) : (
        <div className="grid gap-4">
          <section className="overflow-hidden rounded-2xl border border-ink bg-card">
            <div className="flex items-start justify-between gap-3 px-4 py-4 sm:px-5">
              <button
                type="button"
                onClick={() => setShowXboxLibrary((open) => !open)}
                aria-expanded={showXboxLibrary}
                className="min-w-0 flex-1 text-left transition hover:opacity-80"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">Xbox screenshot library</p>
                    <p className="mt-1 text-sm text-muted">{xboxLibrarySummary()}</p>
                    <p className="mt-1 text-xs text-muted">
                      {showXboxLibrary
                        ? 'Pick a post-match stats screenshot to analyse.'
                        : 'Expand to browse captured screenshots.'}
                    </p>
                  </div>
                  <span
                    className={`record-display-font shrink-0 text-xl text-ink transition-transform ${
                      showXboxLibrary ? 'rotate-180' : ''
                    }`}
                    aria-hidden
                  >
                    ▾
                  </span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setXboxLoaded(false)
                  void loadXboxScreenshots()
                }}
                disabled={isLoadingXbox}
                className={`${secondaryButtonClass} shrink-0 disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {isLoadingXbox ? 'Loading…' : 'Refresh'}
              </button>
            </div>

            {showXboxLibrary ? (
              <div className="grid gap-4 border-t border-ink px-4 py-4 sm:px-5">
                {isLoadingXbox && !xboxScreenshots.length ? (
                  <div className="rounded-2xl border border-ink bg-card p-4 text-sm font-medium text-ink">
                    Loading Xbox screenshots…
                  </div>
                ) : null}

                {!isLoadingXbox && xboxSyncStatus === 'cached' && xboxScreenshots.length > 0 ? (
                  <div className="rounded-2xl border border-ink bg-warning p-4 text-sm text-muted">
                    <p className="font-semibold text-ink">
                      Showing your last synced Xbox captures
                      {formatXboxSyncTime(xboxLastSyncedAt)
                        ? ` (${formatXboxSyncTime(xboxLastSyncedAt)})`
                        : ''}
                      .
                    </p>
                    <p className="mt-2">
                      Xbox cloud sync is empty right now, so these are kept from the last successful load.
                      You can still analyse them, or click Refresh after taking a new screenshot.
                    </p>
                  </div>
                ) : null}

                {!isLoadingXbox && xboxLoaded && xboxScreenshots.length === 0 ? (
                  <div className="rounded-2xl border border-ink bg-card p-5 text-sm text-muted">
                    <p className="font-semibold text-ink">
                      Connected to {xboxGamertag ?? 'your Xbox account'} — Xbox cloud returned no
                      screenshots.
                    </p>
                    <p className="mt-2">
                      This sometimes happens when Xbox Live sync is slow or OpenXBL has not caught up
                      yet. Your FC 26 capture may still exist on the console — try Refresh in a minute.
                    </p>
                    <ol className="mt-2 list-decimal space-y-1 pl-5">
                      <li>Open the post-match Summary stats screen.</li>
                      <li>Press the Xbox button and take a screenshot.</li>
                      <li>Wait for upload, then click Refresh here.</li>
                    </ol>
                    <p className="mt-3">
                      Already have the stats image saved?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setSource('upload')
                          resetFlow()
                        }}
                        className="font-semibold text-ink underline underline-offset-2"
                      >
                        Upload file
                      </button>{' '}
                      is the most reliable option when Xbox cloud is empty.
                    </p>
                  </div>
                ) : null}

                {xboxScreenshots.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {xboxScreenshots.map((screenshot) => {
                      const isSelected = selectedXboxId === screenshot.contentId
                      const isDisabled = screenshot.alreadyImported || isProcessing

                      return (
                        <button
                          key={screenshot.contentId}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => void processXboxScreenshot(screenshot)}
                          className={`group relative overflow-hidden rounded-2xl border text-left transition ${
                            screenshot.alreadyImported
                              ? 'cursor-not-allowed border-ink opacity-70'
                              : isSelected
                                ? 'border-ink ring-2 ring-[var(--color-border)]/10'
                                : 'border-ink hover:brightness-95'
                          }`}
                        >
                          <div className="aspect-video bg-soft">
                            {screenshot.thumbnailUrl ? (
                              <img
                                src={screenshot.thumbnailUrl}
                                alt={`EA FC screenshot from ${formatXboxCaptureDate(screenshot.captureDate)}`}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center text-xs font-medium text-muted">
                                No preview
                              </div>
                            )}
                          </div>
                          <div className="space-y-1 p-3">
                            <p className="text-xs font-semibold text-ink">
                              {formatXboxCaptureDate(screenshot.captureDate)}
                            </p>
                            <p className="truncate text-[11px] text-muted">{screenshot.titleName}</p>
                          </div>
                          {screenshot.alreadyImported ? (
                            <span className="badge-outline absolute right-2 top-2 bg-card text-[10px] uppercase tracking-wide">
                              Imported
                            </span>
                          ) : null}
                          {!screenshot.alreadyImported && isSelected && isProcessing ? (
                            <span className="absolute inset-0 flex items-center justify-center bg-[var(--color-primary-bg)]/70 text-sm font-semibold text-[var(--color-primary-text)]">
                              Analysing…
                            </span>
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
      )}

      {isProcessing && (
        <div className="rounded-2xl border border-ink bg-card p-4 text-sm font-medium text-ink">
          {source === 'xbox' ? 'Analysing Xbox screenshot…' : 'Analysing match…'}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-ink bg-danger p-4">
          <p className="font-semibold text-[#EE5D50]">{error}</p>
          <button
            type="button"
            onClick={() => {
              setError(null)
              resetFileInput()
            }}
            className="mt-3 rounded-xl border border-ink bg-card px-4 py-2 text-sm font-semibold text-[#EE5D50] transition hover:bg-danger"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  )
}

function DuplicateMatchWarning({
  match,
  draft,
  onSaveAnyway,
  onDismiss,
}: {
  match: Match
  draft: DraftMatch
  onSaveAnyway: () => void
  onDismiss: () => void
}) {
  const comparison = buildDuplicateComparison(draft, match)
  const mismatchCount = comparison.filter((row) => !row.matches).length

  return (
    <section className="rounded-2xl border border-ink bg-warning p-5">
      <p className="text-sm font-semibold text-ink">Possible duplicate match</p>
      <p className="mt-1 text-sm text-muted">
        This upload matches a game already in your log
        {mismatchCount === 0 ? ' on every compared stat' : ' on the core score and stats below'}.
      </p>
      <p className="mt-2 text-sm font-medium text-ink">{formatLoggedMatchLabel(match)}</p>

      <div className="mt-4 overflow-x-auto rounded-xl border border-ink bg-card">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-ink bg-card text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2 font-semibold">Stat</th>
              <th className="px-3 py-2 font-semibold">This upload</th>
              <th className="px-3 py-2 font-semibold">Existing match</th>
            </tr>
          </thead>
          <tbody>
            {comparison.map((row) => (
              <tr key={row.label} className="border-b border-ink last:border-b-0">
                <td className="px-3 py-2 font-medium text-ink">{row.label}</td>
                <td
                  className={`px-3 py-2 ${row.matches ? 'text-ink' : 'font-semibold text-[#FFB547]'}`}
                >
                  {row.draftValue}
                </td>
                <td
                  className={`px-3 py-2 ${row.matches ? 'text-ink' : 'font-semibold text-[#FFB547]'}`}
                >
                  {row.existingValue}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={onDismiss} className={primaryButtonClass}>
          Go back and edit
        </button>
        <button
          type="button"
          onClick={onSaveAnyway}
          className="rounded-xl border border-ink bg-card px-5 py-3 text-sm font-semibold text-[#BA7517] transition hover:bg-warning"
        >
          Save anyway
        </button>
      </div>
    </section>
  )
}

function ReviewForm({
  draft,
  existingMatches,
  onChange,
  onSave,
  title,
  description,
}: {
  draft: DraftMatch
  existingMatches: Match[]
  onChange: (draft: DraftMatch) => void
  onSave: (draft: DraftMatch) => void
  title: string
  description: string
}) {
  const canSave = Boolean(draft.opponent.trim()) && draft.myScore !== null && draft.opponentScore !== null
  const [showCommentComposer, setShowCommentComposer] = useState(false)
  const [duplicateMatch, setDuplicateMatch] = useState<Match | null>(null)
  const duplicateWarningRef = useRef<HTMLDivElement>(null)

  const duplicateMatches = useMemo(
    () => (canSave ? findDuplicateMatches(draft, existingMatches) : []),
    [canSave, draft, existingMatches],
  )

  useEffect(() => {
    setDuplicateMatch(null)
  }, [draft])

  useEffect(() => {
    if (!duplicateMatch) return

    duplicateWarningRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [duplicateMatch])

  const normalizedDraft = useMemo(
    () => ({
      ...draft,
      opponent: normaliseTeamName(draft.opponent),
    }),
    [draft],
  )

  const submitDraft = (force = false) => {
    if (!canSave) return

    const duplicates = findDuplicateMatches(normalizedDraft, existingMatches)
    if (duplicates.length > 0 && !force) {
      setDuplicateMatch(duplicates[0])
      return
    }

    onSave(normalizedDraft)
  }

  const updateStat = (key: keyof MatchStats, value: number | null) => {
    onChange({
      ...draft,
      stats: {
        ...(draft.stats ?? createEmptyStats()),
        [key]: value,
      },
    })
  }

  const updateOpponentStat = (key: keyof MatchStats, value: number | null) => {
    onChange({
      ...draft,
      opponentStats: {
        ...(draft.opponentStats ?? {}),
        [key]: value,
      },
    })
  }

  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        submitDraft()
      }}
    >
      <div>
        <h3 className={`${headingClass} text-2xl sm:text-3xl`}>{title}</h3>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="review-date">
            Match date
          </label>
          <input
            id="review-date"
            type="date"
            className={inputClass}
            value={draft.date}
            onChange={(event) => onChange({ ...draft, date: event.target.value })}
          />
          <p className="mt-1 text-xs text-muted">
            Prefilled from the screenshot date when available — edit if needed.
          </p>
        </div>
        <div>
          <label className={labelClass} htmlFor="review-opponent">
            Opponent
          </label>
          <input
            id="review-opponent"
            className={inputClass}
            value={draft.opponent}
            onChange={(event) => onChange({ ...draft, opponent: event.target.value })}
          />
        </div>
      </div>

      <VenueToggle venue={draft.venue} onChange={(venue) => onChange({ ...draft, venue })} />

      <div className="grid grid-cols-2 gap-3">
        <ScoreInput
          label="My score"
          value={draft.myScore}
          onChange={(myScore) => onChange({ ...draft, myScore })}
        />
        <ScoreInput
          label="Opponent score"
          value={draft.opponentScore}
          onChange={(opponentScore) => onChange({ ...draft, opponentScore })}
        />
      </div>

      <section className="grid gap-3">
        <div>
          <h4 className={headingClass}>PSG stats</h4>
          <p className="text-sm text-muted">Blank values will be saved as null.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {statFields.map((field) => (
            <NumberField
              key={field.key}
              label={field.label}
              value={draft.stats?.[field.key] ?? null}
              step={field.key === 'xG' ? '0.1' : '1'}
              onChange={(value) => updateStat(field.key, value)}
            />
          ))}
        </div>
      </section>

      <section className="grid gap-3">
        <div>
          <h4 className={headingClass}>Opponent comparison fields</h4>
          <p className="text-sm text-muted">
            These are used for detail comparison bars when visible in the screenshot.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {statFields.map((field) => (
            <NumberField
              key={field.key}
              label={`Opponent ${field.label}`}
              value={draft.opponentStats?.[field.key] ?? null}
              step={field.key === 'xG' ? '0.1' : '1'}
              onChange={(value) => updateOpponentStat(field.key, value)}
            />
          ))}
        </div>
      </section>

      <section className="grid gap-3">
        {showCommentComposer ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className={headingClass}>Leave a comment</h4>
                <p className="text-sm text-muted">
                  Optional first comment for this match — it will appear in the comments thread.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCommentComposer(false)
                  onChange({ ...draft, comment: null, commentAuthor: null })
                }}
                className="text-sm font-semibold text-muted transition hover:text-ink"
              >
                Cancel
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
              <label className="block">
                <span className={labelClass}>Your name</span>
                <input
                  className={inputClass}
                  value={draft.commentAuthor ?? readDefaultCommentAuthor()}
                  onChange={(event) => onChange({ ...draft, commentAuthor: event.target.value })}
                />
              </label>
              <label className="block">
                <span className={labelClass}>Comment</span>
                <textarea
                  className={`${inputClass} min-h-28 resize-y`}
                  value={draft.comment ?? ''}
                  placeholder="Add a match note..."
                  onChange={(event) => onChange({ ...draft, comment: event.target.value })}
                />
              </label>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setShowCommentComposer(true)}
            className={`${secondaryButtonClass} w-full border-dashed`}
          >
            Leave a comment
          </button>
        )}
      </section>

      {duplicateMatches.length > 0 && !duplicateMatch ? (
        <div className="rounded-2xl border border-ink bg-warning px-4 py-3 text-sm text-muted">
          This upload looks like{' '}
          <span className="font-semibold text-ink">
            {formatLoggedMatchLabel(duplicateMatches[0])}
          </span>
          . Saving will ask you to confirm the stat comparison first.
        </div>
      ) : null}

      {duplicateMatch ? (
        <div ref={duplicateWarningRef}>
          <DuplicateMatchWarning
            match={duplicateMatch}
            draft={normalizedDraft}
            onDismiss={() => setDuplicateMatch(null)}
            onSaveAnyway={() => submitDraft(true)}
          />
        </div>
      ) : (
        <button
          type="submit"
          disabled={!canSave}
          className={`${primaryButtonClass} w-full py-4`}
        >
          Save reviewed match
        </button>
      )}
    </form>
  )
}

function MatchDetail({
  match,
  theme,
  onBack,
  onDelete,
  onSaveComments,
}: {
  match: Match
  theme: Theme
  onBack: () => void
  onDelete: () => void
  onSaveComments: (comments: Match['comments']) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const manualEntry = isManualFormMatch(match)
  const loggedViaLabel =
    match.loggedVia === 'manual-form'
      ? 'Manual form'
      : match.loggedVia === 'xbox'
        ? 'Xbox screenshot'
        : 'Screenshot'

  return (
    <main className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className={`${secondaryButtonClass} text-muted`}
        >
          ← Back to dashboard
        </button>
        {confirmDelete ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-[#EE5D50]">
              Delete this match and all its data?
            </span>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="rounded-xl border border-ink bg-card px-3 py-2 text-sm font-semibold text-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="rounded-xl bg-[#EE5D50] px-3 py-2 text-sm font-semibold text-white"
            >
              Delete
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="rounded-xl border border-ink bg-danger px-4 py-2 text-sm font-semibold text-[#EE5D50] transition hover:bg-[var(--color-danger-hover)]"
          >
            Delete match
          </button>
        )}
      </div>

      <section className={`${panelClass} p-6`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted">{new Date(match.date).toLocaleDateString()}</p>
            <h2 className={`${headingClass} mt-2 text-2xl sm:text-3xl`}>PSG vs {match.opponent}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <VenueBadge venue={match.venue} />
              <ResultBadge result={match.result} />
              <span className="badge-outline">{loggedViaLabel}</span>
            </div>
          </div>
          {manualEntry ? (
            <div
              className={`${innerBoxClass} flex min-h-[5.5rem] items-center justify-center px-6 py-4 text-4xl font-bold sm:text-5xl`}
              style={{ color: resultColors[match.result] }}
            >
              {match.result}
            </div>
          ) : (
            <div className={`${innerBoxClass} number px-6 py-4 text-4xl font-bold sm:text-5xl`} style={{ color: resultColors[match.result] }}>
              {match.myScore}-{match.opponentScore}
            </div>
          )}
        </div>
        {manualEntry && match.manualEntryReason ? (
          <div className={`${innerBoxClass} mt-4 px-4 py-3`}>
            <p className="record-display-font text-xs font-bold uppercase text-muted">Reason for manual entry</p>
            <p className="mt-2 text-sm text-ink">{match.manualEntryReason}</p>
          </div>
        ) : null}
        {match.hasArchivedScreenshot ? (
          <div className={`${innerBoxClass} mt-4 overflow-hidden`}>
            <p className="record-display-font px-4 pt-4 text-xs font-bold uppercase text-muted">
              Archived screenshot
            </p>
            <p className="px-4 pb-3 text-xs text-muted">
              Saved when this match was logged. If Xbox removes the capture from the cloud, this match
              and its stats stay here. Use Delete match above if you want to remove it yourself.
            </p>
            <img
              src={getMatchScreenshotUrl(match.id)}
              alt={`Archived stats screenshot for PSG vs ${match.opponent}`}
              className="w-full border-t border-ink object-contain"
              loading="lazy"
            />
          </div>
        ) : null}
      </section>

      <MatchComments
        match={match}
        onUpdateComments={(comments) => onSaveComments(comments)}
      />

      {!manualEntry ? (
        <DetailedStats
          matches={[match]}
          theme={theme}
          scopeLabel={`${match.opponent} · ${new Date(match.date).toLocaleDateString()}`}
        />
      ) : null}
    </main>
  )
}

function FormTicker({
  matches,
  unbeatenStreak,
  longestUnbeatenRun,
  longestWinningRun,
  trackerRecord,
  onAddManualEntry,
}: {
  matches: Match[]
  unbeatenStreak: number
  longestUnbeatenRun: number
  longestWinningRun: number
  trackerRecord: { W: number; D: number; L: number }
  onAddManualEntry: (draft: ManualFormDraft) => void
}) {
  const pageSize = 20
  const carouselRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef<number | null>(null)
  const [recordsOpen, setRecordsOpen] = useState(false)
  const pages = useMemo(() => {
    const result: Match[][] = []

    for (let index = 0; index < matches.length; index += pageSize) {
      result.push(matches.slice(index, index + pageSize))
    }

    return result.length ? result : [[]]
  }, [matches])
  const [activePage, setActivePage] = useState(0)

  useEffect(() => {
    setActivePage(0)
  }, [matches.length])

  const goTo = (index: number) => {
    const next = Math.max(0, Math.min(pages.length - 1, index))
    setActivePage(next)
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
      goTo(activePage + (delta < 0 ? 1 : -1))
    }
    touchStartX.current = null
  }

  const pageLabel = (pageIndex: number) => {
    if (!matches.length) return 'No results yet'

    const start = pageIndex * pageSize + 1
    const end = Math.min((pageIndex + 1) * pageSize, matches.length)

    if (pageIndex === 0) {
      return pages.length > 1 ? `Latest ${end}` : `Latest ${matches.length}`
    }

    return `Games ${start}–${end}`
  }

  return (
    <div className="relative mt-6 overflow-visible rounded-2xl border border-ink bg-card p-4">
      <div className="mb-3 flex items-start justify-between gap-2 px-1">
        <p className="record-display-font text-sm font-bold uppercase sm:text-base">Recent form</p>
        <div className="flex shrink-0 items-center gap-2">
          <p className="hidden text-xs font-medium text-muted sm:block">
            {pageLabel(activePage)}
            {pages.length > 1 ? ` · ${activePage + 1}/${pages.length}` : ''}
          </p>
          <FormManualEntry onSubmit={onAddManualEntry} />
        </div>
      </div>

      <p className="mb-3 px-1 text-xs font-medium text-muted sm:hidden">
        {pageLabel(activePage)}
        {pages.length > 1 ? ` · ${activePage + 1}/${pages.length}` : ''}
      </p>

      <div
        ref={carouselRef}
        className="relative flex snap-x snap-mandatory overflow-x-auto scroll-smooth"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onScroll={(event) => {
          const width = event.currentTarget.clientWidth
          if (!width) return
          const index = Math.round(event.currentTarget.scrollLeft / width)
          if (index !== activePage) setActivePage(index)
        }}
      >
        {pages.map((pageMatches, pageIndex) => (
          <div key={pageIndex} className="w-full shrink-0 snap-center px-1">
            <div className="grid grid-cols-10 gap-1.5 sm:grid-cols-20">
              {Array.from({ length: pageSize }, (_, index) => {
                const match = pageMatches[index] ?? null

                return match ? (
                  <FormMiniTile key={match.id} match={match} />
                ) : (
                  <div
                    key={`empty-${pageIndex}-${index}`}
                    className="aspect-square min-h-8 rounded-sm border border-dashed border-ink/15"
                    aria-hidden
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {pages.length > 1 ? (
        <div className="relative mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => goTo(activePage + 1)}
            disabled={activePage === pages.length - 1}
            className="record-display-font rounded-lg border border-ink bg-card px-3 py-1.5 text-xs transition hover:bg-card disabled:opacity-40"
          >
            ← Older
          </button>
          <div className="flex flex-wrap justify-center gap-1.5">
            {pages.map((_, index) => (
              <button
                key={index}
                type="button"
                aria-label={`Show form page ${index + 1}`}
                onClick={() => goTo(index)}
                className={`h-2 rounded-full transition ${
                  index === activePage ? 'w-5 bg-[var(--color-ink)]' : 'w-2 bg-[var(--color-ink)]/20'
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => goTo(activePage - 1)}
            disabled={activePage === 0}
            className="record-display-font rounded-lg border border-ink bg-card px-3 py-1.5 text-xs transition hover:bg-card disabled:opacity-40"
          >
            Newer →
          </button>
        </div>
      ) : null}

      <div className="relative mt-4 overflow-hidden rounded-xl border border-ink">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <p className="record-display-font text-xs uppercase sm:text-sm">Current unbeaten streak</p>
          <p className="record-display-font text-lg sm:text-xl">
            {unbeatenStreak} {unbeatenStreak === 1 ? 'game' : 'games'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRecordsOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-3 border-t border-ink px-4 py-2.5 text-left transition hover:bg-soft"
          aria-expanded={recordsOpen}
        >
          <span className="record-display-font text-[10px] uppercase text-muted sm:text-xs">Records</span>
          <span className="text-xs font-semibold text-muted">{recordsOpen ? '▲' : '▼'}</span>
        </button>
        {recordsOpen ? (
          <div className="border-t border-ink bg-soft/40">
            <div className="flex items-center justify-between gap-3 px-4 py-2.5">
              <p className="record-display-font text-[10px] uppercase text-muted sm:text-xs">
                Longest unbeaten run
              </p>
              <p className="record-display-font text-sm sm:text-base">
                {longestUnbeatenRun} {longestUnbeatenRun === 1 ? 'game' : 'games'}
              </p>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-ink px-4 py-2.5">
              <p className="record-display-font text-[10px] uppercase text-muted sm:text-xs">
                Longest winning run
              </p>
              <p className="record-display-font text-sm sm:text-base">
                {longestWinningRun} {longestWinningRun === 1 ? 'game' : 'games'}
              </p>
            </div>
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-3 border-t border-ink px-4 py-2.5">
          <p className="record-display-font text-[10px] uppercase text-muted sm:text-xs">
            Since tracker started
          </p>
          <p className="number text-sm font-semibold sm:text-base">
            <span style={{ color: resultColors.W }}>{trackerRecord.W}</span>
            <span className="text-muted">-</span>
            <span style={{ color: resultColors.D }}>{trackerRecord.D}</span>
            <span className="text-muted">-</span>
            <span style={{ color: resultColors.L }}>{trackerRecord.L}</span>
          </p>
        </div>
      </div>
    </div>
  )
}

function FormManualEntry({ onSubmit }: { onSubmit: (draft: ManualFormDraft) => void }) {
  const [open, setOpen] = useState(false)
  const [opponent, setOpponent] = useState('')
  const [venue, setVenue] = useState<Venue>('home')
  const [result, setResult] = useState<Result | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const resetForm = () => {
    setOpponent('')
    setVenue('home')
    setResult(null)
    setReason('')
    setError(null)
  }

  const closeModal = () => {
    setOpen(false)
    setError(null)
  }

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeModal()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const trimmedOpponent = opponent.trim()
    const trimmedReason = reason.trim()

    if (!trimmedOpponent) {
      setError('Enter the opponent team name.')
      return
    }
    if (!result) {
      setError('Choose a result.')
      return
    }
    if (!trimmedReason) {
      setError('Add a short reason for this manual entry.')
      return
    }

    onSubmit({
      opponent: trimmedOpponent,
      venue,
      result,
      reason: trimmedReason,
    })
    resetForm()
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center rounded-md border border-ink/20 px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted transition hover:border-ink/40 hover:text-ink"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Add manual form entry"
      >
        + manual
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="presentation"
          onClick={closeModal}
        >
          <div
            className="absolute inset-0 bg-[var(--color-ink)]/40"
            aria-hidden
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="manual-form-title"
            className={`${panelClass} relative z-10 w-full max-w-md p-5 shadow-none`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p id="manual-form-title" className="record-display-font text-sm font-bold uppercase">
                  Manual form entry
                </p>
                <p className="mt-1 text-xs text-muted">Quick add when you don&apos;t have a screenshot</p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="record-display-font rounded-md border border-ink px-2 py-1 text-xs font-bold uppercase text-muted transition hover:text-ink"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-3">
              <div>
                <label className={labelClass} htmlFor="manual-form-opponent">
                  Teams
                </label>
                <div className="flex items-center gap-2">
                  <span className="record-display-font shrink-0 text-xs font-bold uppercase sm:text-sm">PSG vs</span>
                  <input
                    id="manual-form-opponent"
                    value={opponent}
                    onChange={(event) => {
                      setOpponent(event.target.value)
                      setError(null)
                    }}
                    placeholder="Opponent team"
                    className={`${inputClass} min-w-0 flex-1 py-2 text-sm`}
                    autoFocus
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className={labelClass}>Venue</p>
                  <div className="flex gap-1.5">
                    {(['home', 'away'] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setVenue(option)}
                        className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold capitalize transition ${
                          venue === option ? tabActiveClass : tabInactiveClass
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className={labelClass}>Result</p>
                  <div className="flex gap-1.5">
                    {(['W', 'D', 'L'] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          setResult(option)
                          setError(null)
                        }}
                        className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold transition ${
                          result === option ? tabActiveClass : tabInactiveClass
                        }`}
                        style={result === option ? { color: resultColors[option] } : undefined}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className={labelClass} htmlFor="manual-form-reason">
                  Reason for manual entry
                </label>
                <textarea
                  id="manual-form-reason"
                  value={reason}
                  onChange={(event) => {
                    setReason(event.target.value)
                    setError(null)
                  }}
                  rows={2}
                  placeholder="e.g. Forgot to screenshot..."
                  className={`${inputClass} min-h-[3.5rem] resize-none py-2 text-sm`}
                />
              </div>

              {error ? <p className="text-xs font-medium text-[#EE5D50]">{error}</p> : null}

              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <button type="button" onClick={closeModal} className={`${secondaryButtonClass} px-3 py-1.5 text-xs`}>
                  Cancel
                </button>
                <button type="submit" className={`${primaryButtonClass} px-3 py-1.5 text-xs`}>
                  Add to form
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}

function FormMiniTile({ match }: { match: Match }) {
  const tileRef = useRef<HTMLDivElement>(null)
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const manualEntry = isManualFormMatch(match)
  const resultLabel = match.result === 'W' ? 'Win' : match.result === 'D' ? 'Draw' : 'Loss'
  const venueLabel = match.venue === 'home' ? 'Home' : 'Away'
  const tooltipText = manualEntry
    ? `${resultLabel} · ${venueLabel} · PSG vs ${match.opponent}`
    : `${resultLabel} · ${venueLabel} · ${match.opponent} ${match.myScore}-${match.opponentScore}`
  const tone = resultToTone(match.result)

  const updateTooltipPos = () => {
    const rect = tileRef.current?.getBoundingClientRect()
    if (!rect) return
    setTooltipPos({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    })
  }

  const showTileTooltip = () => {
    updateTooltipPos()
    setShowTooltip(true)
  }

  return (
    <>
      <div
        ref={tileRef}
        className="group relative flex aspect-square min-h-8 items-center justify-center"
        title={tooltipText}
        onMouseEnter={showTileTooltip}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={showTileTooltip}
        onBlur={() => setShowTooltip(false)}
      >
        <div
          className="flex h-full w-full items-center justify-center rounded-sm border border-ink transition-[filter,transform] group-hover:brightness-110"
          style={{ background: resultToneStyles[tone].background }}
        >
          <span className="record-display-font text-sm leading-none !text-white sm:text-base">
            {match.result}
          </span>
        </div>
      </div>

      {showTooltip ? (
        <div
          role="tooltip"
          style={{
            left: tooltipPos.x,
            top: tooltipPos.y,
            transform: 'translate(-50%, -100%)',
          }}
          className="pointer-events-none fixed z-50 w-max max-w-[11rem] rounded-xl border border-ink bg-card px-3 py-2 text-center"
        >
          <p className="text-xs font-semibold" style={{ color: resultColors[match.result] }}>
            {resultLabel}
          </p>
          <p className="mt-0.5 text-xs font-medium text-ink">{venueLabel}</p>
          <p className="mt-1 text-[11px] text-muted">
            {manualEntry ? `PSG vs ${match.opponent}` : `${match.opponent} · ${match.myScore}-${match.opponentScore}`}
          </p>
          {manualEntry && match.manualEntryReason ? (
            <p className="mt-1 text-[11px] italic text-muted">{match.manualEntryReason}</p>
          ) : null}
          <div className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 border-b border-r border-ink bg-card" />
        </div>
      ) : null}
    </>
  )
}

function SeasonClubsPlayed({ clubs }: { clubs: readonly string[] }) {
  return (
    <div className={`${innerBoxClass} h-full px-4 py-3`}>
      <p className="record-display-font text-xs font-bold uppercase">Club&apos;s played AS</p>
      <ul className="mt-3 grid gap-2">
        {clubs.map((club) => (
          <li key={club} className="badge-outline w-fit">
            {club}
          </li>
        ))}
      </ul>
    </div>
  )
}

function MetricCard({
  label,
  value,
  suffix = '',
  decimals = 0,
  signed = false,
  footer,
}: {
  label: string
  value: number
  suffix?: string
  decimals?: number
  signed?: boolean
  footer?: ReactNode
}) {
  const formatted = `${signed && value > 0 ? '+' : ''}${Number.isInteger(value) && decimals === 0 ? value : value.toFixed(decimals)}${suffix}`

  return (
    <div className={`${panelClass} p-5`}>
      <p className="record-display-font text-xs font-bold uppercase">{label}</p>
      <p className="number mt-2 text-2xl font-bold text-ink sm:text-3xl">{formatted}</p>
      {footer}
    </div>
  )
}

function XgRecordText({ record }: { record: { W: number; D: number; L: number } }) {
  const total = record.W + record.D + record.L

  if (!total) {
    return <p className="mt-2 text-xs font-medium text-muted">No xG comparisons yet</p>
  }

  return (
    <p className="number mt-2 flex flex-wrap items-center gap-x-1.5 text-xs font-semibold">
      <span className="text-[#05CD99]">W {record.W}</span>
      <span className="text-muted">-</span>
      <span className="text-[#FFB547]">D {record.D}</span>
      <span className="text-muted">-</span>
      <span className="text-[#EE5D50]">L {record.L}</span>
    </p>
  )
}

function SplitRecord({ label, matches }: { label: string; matches: Match[] }) {
  const record = getMatchRecord(matches)
  const total = matches.length

  return (
    <div className="card-soft p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="record-display-font text-xs font-bold uppercase">{label}</p>
        <p className="number text-sm font-semibold text-ink">
          {total} {total === 1 ? 'game' : 'games'}
        </p>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <SplitRecordTile label="W" value={record.W} tone="win" />
        <SplitRecordTile label="D" value={record.D} tone="draw" />
        <SplitRecordTile label="L" value={record.L} tone="loss" />
      </div>
    </div>
  )
}

function SplitRecordTile({
  label,
  value,
  tone,
}: {
  label: 'W' | 'D' | 'L'
  value: number
  tone: keyof typeof resultToneStyles
}) {
  const styles = resultToneStyles[tone]

  return (
    <div
      className="flex flex-col items-center justify-center rounded-sm border border-ink px-2 py-2.5 text-white"
      style={{
        background: styles.background,
      }}
    >
      <span className="text-[10px] font-bold tracking-[0.14em]">{label}</span>
      <span className="number mt-0.5 text-xl font-bold leading-none">{value}</span>
    </div>
  )
}

function Settings({
  matches,
  onDeleteMatch,
  onClearAll,
}: {
  matches: Match[]
  onDeleteMatch: (id: number) => void
  onClearAll: () => void
}) {
  const sortedMatches = useMemo(() => sortMatchesNewestFirst(matches), [matches])
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)
  const [confirmClearAll, setConfirmClearAll] = useState(false)
  const [showLoggedMatches, setShowLoggedMatches] = useState(false)

  const toggleLoggedMatches = () => {
    setShowLoggedMatches((open) => {
      if (open) setPendingDeleteId(null)
      return !open
    })
  }

  return (
    <main className="grid gap-6">
      <section className={`${panelClass} p-6`}>
        <p className="record-display-font text-xs font-bold uppercase text-muted">Data management</p>
        <h2 className={`${headingClass} mt-1`}>Settings</h2>
        <p className="mt-2 text-sm text-muted">
          Remove incorrect test entries or reset all logged matches. Changes are saved immediately.
        </p>
        <p className="mt-4 text-sm font-medium text-ink">
          {matches.length} match{matches.length === 1 ? '' : 'es'} stored locally
        </p>
      </section>

      <section className={`${panelClass} overflow-hidden`}>
        <button
          type="button"
          onClick={toggleLoggedMatches}
          aria-expanded={showLoggedMatches}
          className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition hover:bg-soft"
        >
          <div>
            <h3 className={headingClass}>Logged matches</h3>
            <p className="mt-1 text-sm text-muted">
              {matches.length} stored · expand to review or delete individual entries
            </p>
          </div>
          <span
            className={`record-display-font shrink-0 text-xl text-ink transition-transform ${
              showLoggedMatches ? 'rotate-180' : ''
            }`}
            aria-hidden
          >
            ▾
          </span>
        </button>

        {showLoggedMatches ? (
          <div className="divide-y divide-[var(--color-border)] border-t border-ink">
            {sortedMatches.length ? (
              sortedMatches.map((match) => (
                <div
                  key={match.id}
                  className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-muted">
                      {new Date(match.date).toLocaleDateString()}
                    </p>
                    <p className="mt-1 text-base font-semibold text-ink">PSG vs {match.opponent}</p>
                    <p className="mt-1 text-sm text-muted">
                      {isManualFormMatch(match)
                        ? `Manual form · ${match.result} · ${match.venue === 'home' ? 'Home' : 'Away'}`
                        : `${match.myScore}-${match.opponentScore} · ${match.venue === 'home' ? 'Home' : 'Away'}`}
                    </p>
                    {isManualFormMatch(match) && match.manualEntryReason ? (
                      <p className="mt-1 text-sm italic text-muted">{match.manualEntryReason}</p>
                    ) : null}
                  </div>
                  {pendingDeleteId === match.id ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-[#EE5D50]">
                        Delete this match and all its data?
                      </span>
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(null)}
                        className="rounded-xl border border-ink bg-card px-3 py-2 text-sm font-semibold text-muted"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteMatch(match.id)
                          setPendingDeleteId(null)
                        }}
                        className="rounded-xl bg-[#EE5D50] px-3 py-2 text-sm font-semibold text-white"
                      >
                        Delete
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPendingDeleteId(match.id)}
                      className="w-fit rounded-xl border border-ink bg-danger px-4 py-2 text-sm font-semibold text-[#EE5D50] transition hover:bg-[var(--color-danger-hover)]"
                    >
                      Delete
                    </button>
                  )}
                </div>
              ))
            ) : (
              <div className="px-6 py-8 text-center text-sm text-muted">No matches to delete.</div>
            )}
          </div>
        ) : null}
      </section>

      <section className={`${panelClass} p-6`}>
        <h3 className={headingClass}>Data retention</h3>
        <p className="mt-2 text-sm text-muted">
          Logged matches are stored in the shared tracker, not on Xbox. If Xbox deletes a capture from
          the cloud, your saved scores, stats, comments, and archived screenshot stay until you delete
          the match here.
        </p>
      </section>

      <section className={`${panelClass} p-6`}>
        <h3 className={headingClass}>Reset all data</h3>
        <p className="mt-2 text-sm text-muted">
          Permanently removes every logged match, archived screenshot, and comment from the shared tracker.
        </p>
        {confirmClearAll ? (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-[#EE5D50]">
              Delete all {matches.length} matches? This cannot be undone.
            </span>
            <button
              type="button"
              onClick={() => setConfirmClearAll(false)}
              className="rounded-xl border border-ink bg-card px-4 py-2 text-sm font-semibold text-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onClearAll()
                setConfirmClearAll(false)
                setPendingDeleteId(null)
              }}
              className="rounded-lg border border-ink bg-[#EE5D50] px-4 py-2 text-sm font-semibold text-white"
            >
              Clear all matches
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={!matches.length}
            onClick={() => setConfirmClearAll(true)}
            className="mt-5 rounded-xl border border-ink bg-danger px-5 py-3 text-sm font-semibold text-[#EE5D50] transition hover:bg-[var(--color-danger-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear all matches
          </button>
        )}
      </section>
    </main>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-ink bg-card p-8 text-center">
      <div>
        <p className="font-semibold text-ink">No match data yet</p>
        <p className="mt-1 text-sm text-muted">Log your first PSG co-op seasons result.</p>
        <button type="button" onClick={onAdd} className={`${primaryButtonClass} mt-4`}>
          Add match
        </button>
      </div>
    </div>
  )
}

function ResultBadge({ result }: { result: Result }) {
  return (
    <span
      className="number inline-flex h-8 w-8 items-center justify-center rounded-sm border border-ink text-xs font-bold text-white"
      style={{ backgroundColor: resultColors[result] }}
    >
      {result}
    </span>
  )
}

function VenueBadge({ venue }: { venue: Venue }) {
  return <span className="badge-outline">{venue === 'home' ? 'Home' : 'Away'}</span>
}

function VenueToggle({ venue, onChange }: { venue: Venue; onChange: (venue: Venue) => void }) {
  return (
    <div>
      <span className={labelClass}>Venue</span>
      <div className="grid grid-cols-2 gap-2">
        {(['home', 'away'] as Venue[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`px-4 py-3 text-sm font-semibold capitalize transition ${
              venue === option ? tabActiveClass : tabInactiveClass
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}

function ScoreInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: number | null
  onChange: (value: number | null) => void
}) {
  return <NumberField label={label} value={value} onChange={onChange} min={0} />
}

function NumberField({
  label,
  value,
  onChange,
  step = '1',
  min,
}: {
  label: string
  value: number | null
  onChange: (value: number | null) => void
  step?: string
  min?: number
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <input
        className={`${inputClass} number`}
        type="number"
        inputMode="decimal"
        min={min}
        step={step}
        value={value ?? ''}
        onChange={(event) => {
          const nextValue = event.target.value
          onChange(nextValue === '' ? null : Number(nextValue))
        }}
      />
    </label>
  )
}

function average(values: Array<number | null>) {
  const valid = values.filter((value): value is number => typeof value === 'number')
  if (!valid.length) return 0
  return valid.reduce((sum, value) => sum + value, 0) / valid.length
}

function quickStatsLine(match: Match) {
  if (!match.stats) return 'No stats'

  return [
    `Poss ${formatStatValue(match.stats.possession, '%')}`,
    `Shots ${formatStatValue(match.stats.shots)}`,
    `xG ${formatStatValue(match.stats.xG)}`,
  ].join(' - ')
}

function truncateComment(comment: string, maxLength = 80) {
  if (comment.length <= maxLength) return comment
  return `${comment.slice(0, maxLength).trim()}…`
}

export default App
