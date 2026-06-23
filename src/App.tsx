import type { FormEvent, KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
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
  getMatchPlayedAs,
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
  type StreakRunStats,
  type WinningRunStats,
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
import {
  AnimatedCountUp,
  RecordHeaderLabel,
  RecordOdometerStack,
} from './OverallRecordDisplay'
import UpdateTimeline from './UpdateTimeline'
import DashboardUpdateAlert from './DashboardUpdateAlert'
import WelcomeIntro from './WelcomeIntro'
import { applyTheme, getThemeColors, readTheme, type Theme } from './theme'
import { hasSeenWelcomeIntroThisSession } from './welcomeIntroStorage'
import { fetchUpdateNotes } from './updatesApi'
import { getPendingUpdateAlert, markForcedUpdatesDismissed, markUpdatesSeen } from './updateNotificationUtils'
import {
  addPlayedTeam,
  formatMatchTitle,
  normalizeTeamLabel,
  removePlayedTeam,
  searchPresetTeams,
} from './teamConfig'
import { readPlayedTeams, readSelectedTeam, writePlayedTeams, writeSelectedTeam } from './teamStorage'
import {
  buildDuplicateComparison,
  findDuplicateMatches,
  formatLoggedMatchLabel,
} from './duplicateUtils'
import type { DraftMatch, Match, MatchStats, Result, UpdateNote, Venue, VisionExtraction } from './types'
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

const winDrawGradient = (wins: number, draws: number) => {
  const total = wins + draws
  if (total <= 0) return 'var(--color-card)'
  if (draws === 0) return resultToneStyles.win.background
  if (wins === 0) return resultToneStyles.draw.background

  const winShare = (wins / total) * 100
  const feather = Math.min(30, Math.max(16, (100 / total) * 8))
  const start = Math.max(0, winShare - feather)
  const end = Math.min(100, winShare + feather)
  const midBefore = Math.max(0, winShare - feather * 0.4)
  const midAfter = Math.min(100, winShare + feather * 0.4)

  return `linear-gradient(90deg, #06D6A0 0%, #05CD99 ${start}%, #8ADFC8 ${midBefore}%, #FFD08A ${midAfter}%, #FFB547 ${end}%, #FFB547 100%)`
}

const streakRunBadgeClass =
  'record-display-font shrink-0 rounded-sm border border-ink px-3 py-1.5 text-sm text-white sm:text-base'

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
  const [showWelcomeIntro, setShowWelcomeIntro] = useState(() => !hasSeenWelcomeIntroThisSession())
  const [updateNotes, setUpdateNotes] = useState<UpdateNote[]>([])
  const [alertUpdates, setAlertUpdates] = useState<UpdateNote[]>([])
  const [showUpdateAlert, setShowUpdateAlert] = useState(false)
  const [playedTeams, setPlayedTeams] = useState<string[]>(() => readPlayedTeams())
  const [selectedTeam, setSelectedTeam] = useState<string>(() => readSelectedTeam())
  const formMatches = useMemo(() => getFormTickerMatches(matches), [matches])

  useEffect(() => {
    let cancelled = false

    fetchUpdateNotes()
      .then((loaded) => {
        if (cancelled) return
        setUpdateNotes(loaded)
        setAlertUpdates(getPendingUpdateAlert(loaded))
      })
      .catch(() => {
        // Ignore update fetch failures — dashboard still loads normally.
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (showWelcomeIntro || !alertUpdates.length) return
    setShowUpdateAlert(true)
  }, [showWelcomeIntro, alertUpdates])

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
    if (view !== 'detail' || selectedMatchId == null) return

    let cancelled = false

    const refreshMatches = () => {
      fetchMatches()
        .then((loaded) => {
          if (!cancelled) setMatches(loaded)
        })
        .catch(() => {
          // Keep current state if background refresh fails.
        })
    }

    refreshMatches()
    const interval = window.setInterval(refreshMatches, 15000)
    window.addEventListener('focus', refreshMatches)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshMatches)
    }
  }, [view, selectedMatchId])

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
    const match = createManualFormMatch({
      ...draft,
      playedAs: draft.playedAs ?? selectedTeam,
    })

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
    let payload: Match | undefined

    setMatches((current) => {
      const nextMatches = updateMatchComments(current, id, comments ?? [])
      payload = nextMatches.find((match) => match.id === id)
      return nextMatches
    })

    if (!payload) return

    try {
      const saved = await updateMatchRemote(payload)
      setMatches((current) => current.map((match) => (match.id === id ? saved : match)))
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

  const dismissUpdateAlert = () => {
    markUpdatesSeen(alertUpdates)
    markForcedUpdatesDismissed(alertUpdates)
    setShowUpdateAlert(false)
    setAlertUpdates([])
  }

  const handleSelectTeam = (team: string) => {
    const label = normalizeTeamLabel(team)
    if (!label) return

    setSelectedTeam(label)
    writeSelectedTeam(label)
  }

  const handleAddTeam = (team: string) => {
    const label = normalizeTeamLabel(team)
    if (!label) return

    setPlayedTeams((current) => {
      const next = addPlayedTeam(current, label)
      writePlayedTeams(next)
      return next
    })
    handleSelectTeam(label)
  }

  const handleRemoveTeam = (team: string) => {
    const label = normalizeTeamLabel(team)
    if (!label) return

    const next = removePlayedTeam(playedTeams, label)
    if (next.length === playedTeams.length) return

    writePlayedTeams(next)
    setPlayedTeams(next)

    if (selectedTeam.toLowerCase() === label.toLowerCase()) {
      const replacement = next[0]
      setSelectedTeam(replacement)
      writeSelectedTeam(replacement)
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
              ? formatMatchTitle(getMatchPlayedAs(selectedMatch), selectedMatch.opponent)
              : 'Match detail'

  return (
    <div
      className={`min-h-screen ${showWelcomeIntro ? 'overflow-hidden bg-[#101010]' : 'bg-page text-ink'}`}
    >
      {showWelcomeIntro ? (
        <WelcomeIntro formMatches={formMatches} onComplete={() => setShowWelcomeIntro(false)} />
      ) : null}
      {showUpdateAlert ? (
        <DashboardUpdateAlert
          unseenUpdates={alertUpdates}
          allUpdates={updateNotes}
          onDismiss={dismissUpdateAlert}
        />
      ) : null}
      <div
        className={`dashboard-shell mx-auto flex min-h-screen max-w-[1440px] flex-col lg:flex-row ${
          showWelcomeIntro ? 'invisible' : ''
        } ${showUpdateAlert ? 'dashboard-shell--dimmed' : ''}`}
        aria-hidden={showWelcomeIntro}
      >
        <aside className="card m-4 flex shrink-0 flex-col gap-8 p-5 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:w-64 lg:self-start">
          <button type="button" className="text-left" onClick={() => setView('dashboard')}>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-ink bg-[var(--color-primary-bg)] text-xs font-bold text-[var(--color-primary-text)]">
                {selectedTeam.slice(0, 3).toUpperCase()}
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
              recordAnimationsActive={!showWelcomeIntro}
              playedTeams={playedTeams}
              selectedTeam={selectedTeam}
              onSelectTeam={handleSelectTeam}
              onAddTeam={handleAddTeam}
              onRemoveTeam={handleRemoveTeam}
              onAdd={() => setView('add')}
              onOpenMatch={openMatch}
              onAddManualFormEntry={saveManualFormEntry}
            />
          )}
          {!matchesLoading && view === 'stats' && (
            <DetailedStats
              matches={matches.filter(isStatsMatch)}
              recordMatches={matches}
              theme={theme}
              scopeLabel={`Season view · ${matches.filter(isStatsMatch).length} matches logged`}
            />
          )}
          {view === 'add' && (
            <AddMatch
              onSave={saveDraft}
              existingMatches={matches}
              importedXboxIds={getImportedXboxContentIds(matches)}
              selectedTeam={selectedTeam}
            />
          )}
          {view === 'detail' && selectedMatch && (
            <MatchDetail
              match={selectedMatch}
              allMatches={matches}
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
  recordAnimationsActive,
  playedTeams,
  selectedTeam,
  onSelectTeam,
  onAddTeam,
  onRemoveTeam,
  onAdd,
  onOpenMatch,
  onAddManualFormEntry,
}: {
  matches: Match[]
  theme: Theme
  recordAnimationsActive: boolean
  playedTeams: string[]
  selectedTeam: string
  onSelectTeam: (team: string) => void
  onAddTeam: (team: string) => void
  onRemoveTeam: (team: string) => void
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
  const wlRatio = record.W - record.L
  const wlRatioColor = wlRatio > 0 ? resultColors.W : resultColors.L
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
  const odometerRef = useRef<HTMLDivElement>(null)
  const [metricsHeight, setMetricsHeight] = useState<number | undefined>(undefined)
  const [hoveredGoalIndex, setHoveredGoalIndex] = useState<number | null>(null)
  const hoveredGoalPoint = hoveredGoalIndex != null ? (chartData[hoveredGoalIndex] ?? null) : null

  useEffect(() => {
    const node = odometerRef.current
    if (!node) return

    const syncMetricsHeight = () => {
      setMetricsHeight(node.getBoundingClientRect().height)
    }

    syncMetricsHeight()
    const observer = new ResizeObserver(syncMetricsHeight)
    observer.observe(node)
    window.addEventListener('resize', syncMetricsHeight)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', syncMetricsHeight)
    }
  }, [record.W, record.D, record.L])

  return (
    <main className="grid gap-6">
      <section className={`${panelClass} p-6`}>
        <div className="dashboard-record-header grid grid-cols-1 gap-8 xl:grid-cols-[auto_auto_minmax(9.5rem,10rem)_12rem] xl:items-start xl:gap-x-12 xl:gap-y-0">
          <RecordHeaderLabel />
          <div ref={odometerRef} className="shrink-0">
            <RecordOdometerStack
              wins={record.W}
              draws={record.D}
              losses={record.L}
              animate={recordAnimationsActive}
            />
          </div>
          <div
            className="dashboard-record-metrics grid min-h-0 grid-rows-3 gap-2.5"
            style={metricsHeight ? { height: metricsHeight } : undefined}
          >
            <DashboardMetricBox label="Win rate">
              <AnimatedCountUp
                value={winRate}
                color={winRateColor(winRate)}
                suffix="%"
                delayMs={560}
                active={recordAnimationsActive}
                className="mt-0.5 text-lg sm:text-xl"
              />
            </DashboardMetricBox>
            <DashboardMetricBox label="Matches played">
              <AnimatedCountUp
                value={total}
                color="var(--color-ink)"
                delayMs={700}
                active={recordAnimationsActive}
                className="mt-0.5 text-lg sm:text-xl"
              />
            </DashboardMetricBox>
            <DashboardMetricBox label="W/L Ratio">
              <AnimatedCountUp
                value={wlRatio}
                color={wlRatioColor}
                signed
                delayMs={780}
                active={recordAnimationsActive}
                className="mt-0.5 text-lg sm:text-xl"
              />
            </DashboardMetricBox>
          </div>
          <div
            className="w-full shrink-0 xl:w-[12rem]"
            style={metricsHeight ? { height: metricsHeight } : undefined}
          >
            <SeasonClubsPlayed
              teams={playedTeams}
              selectedTeam={selectedTeam}
              onSelectTeam={onSelectTeam}
              onRemoveTeam={onRemoveTeam}
            />
          </div>
        </div>

        <AddTeamField teams={playedTeams} onAddTeam={onAddTeam} />

        <FormTicker
          matches={formMatches}
          unbeatenStreak={unbeatenStreak}
          longestUnbeatenRun={longestUnbeatenRun}
          longestWinningRun={longestWinningRun}
          trackerRecord={trackerRecord}
          selectedTeam={selectedTeam}
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

      <TeamRecordsBreakdown matches={matches} />

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
                    stroke="#05CD99"
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
                          fill="#05CD99"
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
                    {isManualFormMatch(match)
                      ? formatMatchTitle(getMatchPlayedAs(match), match.opponent)
                      : match.opponent}
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
  selectedTeam,
}: {
  onSave: (draft: DraftMatch) => void
  existingMatches: Match[]
  importedXboxIds: string[]
  selectedTeam: string
}) {
  return (
    <main className={`${panelClass} overflow-hidden`}>
      <div className="border-b border-ink px-6 py-5">
        <p className="record-display-font text-xs font-bold uppercase text-muted">New entry</p>
        <h2 className={`${headingClass} mt-1`}>Log a match</h2>
        <p className="mt-1 text-sm text-muted">
          Upload a stats screenshot or pick one from your Xbox EA FC library, then review before
          saving. Currently playing as <span className="font-semibold text-ink">{selectedTeam}</span>.
        </p>
      </div>
      <div className="px-6 pb-6 pt-5">
        <ScreenshotFlow
          onSave={onSave}
          existingMatches={existingMatches}
          importedXboxIds={importedXboxIds}
          selectedTeam={selectedTeam}
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
  selectedTeam,
}: {
  onSave: (draft: DraftMatch) => void
  existingMatches: Match[]
  importedXboxIds: string[]
  selectedTeam: string
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
        playedAs: selectedTeam,
        screenshotDate: fileDateToInputValue(file),
      }
      setExtractDraftOptions(options)
      const { extraction: extracted, screenshotArchiveKey } = await extractMatchFromScreenshot(
        file,
        selectedTeam,
      )
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
        await extractMatchFromXboxScreenshot(screenshot, selectedTeam)
      const options: ExtractionDraftOptions = {
        loggedVia: 'xbox',
        playedAs: selectedTeam,
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
        playedAsTeam={draft.playedAs ?? selectedTeam}
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
  playedAsTeam,
  title,
  description,
}: {
  draft: DraftMatch
  existingMatches: Match[]
  onChange: (draft: DraftMatch) => void
  onSave: (draft: DraftMatch) => void
  playedAsTeam: string
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
          <h4 className={headingClass}>{playedAsTeam} stats</h4>
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
  allMatches,
  theme,
  onBack,
  onDelete,
  onSaveComments,
}: {
  match: Match
  allMatches: Match[]
  theme: Theme
  onBack: () => void
  onDelete: () => void
  onSaveComments: (comments: Match['comments']) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const manualEntry = isManualFormMatch(match)
  const playedAs = getMatchPlayedAs(match)
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
            <h2 className={`${headingClass} mt-2 text-2xl sm:text-3xl`}>
              {formatMatchTitle(playedAs, match.opponent)}
            </h2>
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
              alt={`Archived stats screenshot for ${formatMatchTitle(playedAs, match.opponent)}`}
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
          recordMatches={allMatches}
          theme={theme}
          scopeLabel={`${match.opponent} · ${new Date(match.date).toLocaleDateString()}`}
        />
      ) : null}
    </main>
  )
}

function DashboardMetricBox({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={`${innerBoxClass} flex h-full min-h-0 flex-col justify-center px-3 py-1.5`}>
      <p className="record-display-font text-[10px] font-bold uppercase leading-tight">{label}</p>
      {children}
    </div>
  )
}

function formatFormTileDate(match: Match) {
  const date = new Date(match.date)
  if (Number.isNaN(date.getTime()) || date.getFullYear() <= 1970) {
    return 'Pre-tracker form'
  }

  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function FormTicker({
  matches,
  unbeatenStreak,
  longestUnbeatenRun,
  longestWinningRun,
  trackerRecord,
  selectedTeam,
  onAddManualEntry,
}: {
  matches: Match[]
  unbeatenStreak: StreakRunStats
  longestUnbeatenRun: StreakRunStats
  longestWinningRun: WinningRunStats
  trackerRecord: { W: number; D: number; L: number }
  selectedTeam: string
  onAddManualEntry: (draft: ManualFormDraft) => void
}) {
  const pageSize = 20
  const scrollRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ pointerId: number; startX: number; startScrollLeft: number } | null>(null)
  const isDraggingRef = useRef(false)
  const [recordsOpen, setRecordsOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [viewLabel, setViewLabel] = useState('Latest')
  const [showLatestButton, setShowLatestButton] = useState(false)
  const pages = useMemo(() => {
    const result: Match[][] = []

    for (let index = 0; index < matches.length; index += pageSize) {
      result.push(matches.slice(index, index + pageSize))
    }

    return result.length ? result : [[]]
  }, [matches])
  const canScroll = pages.length > 1

  const buildViewLabel = (scrollLeft: number, viewportWidth: number) => {
    if (!matches.length) return 'No results yet'
    if (scrollLeft < 12) {
      return canScroll ? `Latest ${Math.min(pageSize, matches.length)}` : `Latest ${matches.length}`
    }

    const pageIndex = Math.floor(scrollLeft / Math.max(viewportWidth, 1))
    const start = pageIndex * pageSize + 1
    const end = Math.min((pageIndex + 1) * pageSize, matches.length)

    return `Games ${start}–${end}`
  }

  const updateScrollMeta = () => {
    const scrollEl = scrollRef.current
    if (!scrollEl) return

    const width = scrollEl.clientWidth
    if (!width) return

    setShowLatestButton(scrollEl.scrollLeft > 12)
    setViewLabel(buildViewLabel(scrollEl.scrollLeft, width))
  }

  const scrollToLatest = () => {
    scrollRef.current?.scrollTo({ left: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ left: 0, behavior: 'auto' })
    updateScrollMeta()
  }, [matches.length])

  useEffect(() => {
    updateScrollMeta()
  }, [matches, pages.length])

  const endDrag = (_event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    const scrollEl = scrollRef.current
    if (!drag) return

    if (scrollEl?.hasPointerCapture(drag.pointerId)) {
      scrollEl.releasePointerCapture(drag.pointerId)
    }

    dragRef.current = null
    isDraggingRef.current = false
    setIsDragging(false)
    updateScrollMeta()
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return

    const scrollEl = scrollRef.current
    if (!scrollEl || scrollEl.scrollWidth <= scrollEl.clientWidth) return

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: scrollEl.scrollLeft,
    }
    isDraggingRef.current = true
    setIsDragging(true)
    scrollEl.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const scrollEl = scrollRef.current
    const drag = dragRef.current
    if (!scrollEl || !drag || drag.pointerId !== event.pointerId) return

    event.preventDefault()
    scrollEl.scrollLeft = drag.startScrollLeft - (event.clientX - drag.startX)
  }

  return (
    <div className="relative mt-6 overflow-visible rounded-2xl border border-ink bg-card p-4">
      <div className="mb-3 flex items-start justify-between gap-2 px-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="record-display-font text-sm font-bold uppercase sm:text-base">Recent form</p>
          {canScroll && showLatestButton ? (
            <button
              type="button"
              onClick={scrollToLatest}
              aria-label="Back to latest form"
              title="Back to latest form"
              className="record-display-font inline-flex items-center gap-1 rounded-lg border border-ink bg-soft px-2.5 py-1 text-[11px] font-bold uppercase text-ink transition hover:bg-card"
            >
              <span aria-hidden>↻</span>
              Latest
            </button>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <p className="hidden text-xs font-medium text-muted sm:block">{viewLabel}</p>
          <FormManualEntry selectedTeam={selectedTeam} onSubmit={onAddManualEntry} />
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between gap-2 px-1 sm:hidden">
        <p className="text-xs font-medium text-muted">{viewLabel}</p>
        {canScroll && showLatestButton ? (
          <button
            type="button"
            onClick={scrollToLatest}
            aria-label="Back to latest form"
            title="Back to latest form"
            className="record-display-font inline-flex shrink-0 items-center gap-1 rounded-lg border border-ink bg-soft px-2.5 py-1 text-[11px] font-bold uppercase text-ink transition hover:bg-card"
          >
            <span aria-hidden>↻</span>
            Latest
          </button>
        ) : null}
      </div>

      <div
        ref={scrollRef}
        className={`form-ticker-scroll ${canScroll ? 'is-scrollable' : ''} ${isDragging ? 'is-dragging' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onScroll={updateScrollMeta}
      >
        <div className="flex">
          {pages.map((pageMatches, pageIndex) => (
            <div key={pageIndex} className="w-full shrink-0 px-1">
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
      </div>

      <div className="relative mt-4 overflow-hidden rounded-xl border border-ink">
        <StreakRunBox label="Current unbeaten streak" stats={unbeatenStreak} />
        <button
          type="button"
          onClick={() => setRecordsOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-4 border-t border-ink px-4 py-3 text-left transition hover:bg-soft/70"
          aria-expanded={recordsOpen}
        >
          <div className="min-w-0">
            <p className="record-display-font text-xs font-bold uppercase text-ink sm:text-sm">Season records</p>
            {recordsOpen ? (
              <p className="mt-1 text-xs leading-relaxed text-muted">Longest unbeaten and winning runs this season</p>
            ) : longestUnbeatenRun.total > 0 || longestWinningRun.total > 0 ? (
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Unbeaten{' '}
                <span className="number font-semibold text-ink">{longestUnbeatenRun.total}</span>
                <span className="px-1 text-muted/70">·</span>
                Wins{' '}
                <span className="number font-semibold text-ink">{longestWinningRun.total}</span>
                <span className="hidden sm:inline"> · Tap to expand</span>
              </p>
            ) : (
              <p className="mt-1 text-xs leading-relaxed text-muted">Tap to view longest runs</p>
            )}
          </div>
          <span
            className={`record-display-font shrink-0 text-sm text-muted transition-transform duration-200 ${
              recordsOpen ? 'rotate-180' : ''
            }`}
            aria-hidden
          >
            ▼
          </span>
        </button>
        {recordsOpen ? (
          <div className="border-t border-ink bg-soft/45 px-3 py-3 sm:px-4 sm:py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <RecordStreakCard
                label="Longest unbeaten run"
                club={selectedTeam}
                description="Most consecutive games without a loss"
                stats={longestUnbeatenRun}
                showBreakdown
              />
              <RecordStreakCard
                label="Longest winning run"
                description="Most consecutive wins"
                stats={longestWinningRun}
                goalsFor={longestWinningRun.goalsFor}
                goalsAgainst={longestWinningRun.goalsAgainst}
              />
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

function StreakRunBox({
  label,
  club,
  stats,
  showBreakdown = false,
  bordered = false,
}: {
  label: string
  club?: string
  stats: StreakRunStats
  showBreakdown?: boolean
  bordered?: boolean
}) {
  return (
    <div className={bordered ? 'border-t border-ink' : undefined}>
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        <p className="record-display-font text-[10px] uppercase text-muted sm:text-xs">
          {label}
          {club ? <span className="text-ink"> · {club}</span> : null}
        </p>
        <p
          className={`${streakRunBadgeClass} ${stats.total === 0 ? 'text-ink' : 'text-white'}`}
          style={{ background: winDrawGradient(stats.wins, stats.draws) }}
        >
          {stats.total}
        </p>
      </div>
      {showBreakdown && stats.total > 0 ? (
        <div className="flex items-center justify-between gap-3 border-t border-ink bg-soft/40 px-4 py-2">
          <p className="record-display-font text-[10px] uppercase text-muted sm:text-xs">Breakdown</p>
          <div className="flex items-center gap-2">
            <span className="number text-xs font-semibold" style={{ color: resultColors.W }}>
              {stats.wins}W
            </span>
            <span className="text-xs text-muted">·</span>
            <span className="number text-xs font-semibold" style={{ color: resultColors.D }}>
              {stats.draws}D
            </span>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function RecordStreakCard({
  label,
  club,
  description,
  stats,
  showBreakdown = false,
  goalsFor,
  goalsAgainst,
}: {
  label: string
  club?: string
  description?: string
  stats: StreakRunStats
  showBreakdown?: boolean
  goalsFor?: number
  goalsAgainst?: number
}) {
  const isWinRun = goalsFor !== undefined && goalsAgainst !== undefined
  const countLabel = isWinRun
    ? stats.total === 1
      ? 'win'
      : 'wins'
    : stats.total === 1
      ? 'game'
      : 'games'
  const badgeBackground = isWinRun
    ? resultToneStyles.win.background
    : winDrawGradient(stats.wins, stats.draws)

  return (
    <div className="rounded-xl border border-ink bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="record-display-font text-[11px] font-bold uppercase tracking-wide text-muted sm:text-xs">
            {label}
            {club ? <span className="text-ink"> · {club}</span> : null}
          </p>
          {description ? <p className="mt-1 text-xs leading-relaxed text-muted">{description}</p> : null}
        </div>
        <div className="shrink-0 text-right">
          <p
            className={`${streakRunBadgeClass} ${
              stats.total === 0 && !isWinRun ? 'text-ink' : 'text-white'
            }`}
            style={{ background: badgeBackground }}
          >
            {stats.total}
          </p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted">{countLabel}</p>
        </div>
      </div>

      {showBreakdown && stats.total > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink/70 pt-3">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Made up of</span>
          <span
            className="rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{ color: resultColors.W, backgroundColor: 'rgba(5, 205, 153, 0.12)' }}
          >
            {stats.wins}W
          </span>
          <span
            className="rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{ color: resultColors.D, backgroundColor: 'rgba(255, 181, 71, 0.14)' }}
          >
            {stats.draws}D
          </span>
        </div>
      ) : isWinRun && stats.total > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-ink/70 pt-3">
          <div className="rounded-lg bg-soft px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Scored</p>
            <p className="number mt-1 text-lg font-bold" style={{ color: resultColors.W }}>
              {goalsFor}
            </p>
          </div>
          <div className="rounded-lg bg-soft px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Conceded</p>
            <p className="number mt-1 text-lg font-bold" style={{ color: resultColors.L }}>
              {goalsAgainst}
            </p>
          </div>
        </div>
      ) : stats.total === 0 ? (
        <p className="mt-4 border-t border-ink/70 pt-3 text-xs text-muted">No run logged yet</p>
      ) : null}
    </div>
  )
}

function FormManualEntry({
  selectedTeam,
  onSubmit,
}: {
  selectedTeam: string
  onSubmit: (draft: ManualFormDraft) => void
}) {
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
      playedAs: selectedTeam,
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
                  <span className="record-display-font shrink-0 text-xs font-bold uppercase sm:text-sm">
                    {selectedTeam} vs
                  </span>
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
  const playedAs = getMatchPlayedAs(match)
  const resultLabel = match.result === 'W' ? 'Win' : match.result === 'D' ? 'Draw' : 'Loss'
  const venueLabel = match.venue === 'home' ? 'Home' : 'Away'
  const dateLabel = formatFormTileDate(match)
  const tooltipText = manualEntry
    ? `${dateLabel} · ${resultLabel} · ${venueLabel} · ${formatMatchTitle(playedAs, match.opponent)}`
    : `${dateLabel} · ${resultLabel} · ${venueLabel} · ${match.opponent} ${match.myScore}-${match.opponentScore}`
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
          <p className="mt-0.5 text-[11px] font-medium text-muted">{dateLabel}</p>
          <p className="mt-0.5 text-xs font-medium text-ink">{venueLabel}</p>
          <p className="mt-1 text-[11px] text-muted">
            {manualEntry
              ? formatMatchTitle(getMatchPlayedAs(match), match.opponent)
              : `${match.opponent} · ${match.myScore}-${match.opponentScore}`}
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

function SeasonClubsPlayed({
  teams,
  selectedTeam,
  onSelectTeam,
  onRemoveTeam,
}: {
  teams: string[]
  selectedTeam: string
  onSelectTeam: (team: string) => void
  onRemoveTeam: (team: string) => void
}) {
  const canRemove = teams.length > 1

  return (
    <div className={`${innerBoxClass} flex h-full min-h-0 flex-col px-4 py-3`}>
      <p className="record-display-font shrink-0 text-xs font-bold uppercase">Playing as</p>
      <ul className="mt-3 grid min-h-0 flex-1 gap-2 overflow-y-auto pr-1">
        {teams.map((team) => {
          const isSelected = team === selectedTeam

          return (
            <li key={team} className="group relative">
              <button
                type="button"
                onClick={() => onSelectTeam(team)}
                className={`badge-outline w-full text-left text-sm transition ${
                  canRemove ? 'pr-6' : ''
                } ${isSelected ? 'border-[#05CD99] bg-[#05CD99]/10 font-semibold text-ink' : ''}`}
                aria-pressed={isSelected}
              >
                {team}
                {isSelected ? <span className="ml-2 text-[10px] uppercase text-[#05CD99]">Active</span> : null}
              </button>
              {canRemove ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onRemoveTeam(team)
                  }}
                  aria-label={`Remove ${team}`}
                  title={`Remove ${team}`}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 px-0.5 text-[9px] leading-none text-muted/30 transition hover:text-[#EE5D50] group-hover:text-muted/55"
                >
                  ×
                </button>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function AddTeamField({
  teams,
  onAddTeam,
}: {
  teams: string[]
  onAddTeam: (team: string) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)

  const suggestions = useMemo(() => searchPresetTeams(query, teams), [query, teams])

  const flatSuggestions = useMemo(
    () => [...suggestions.nationals, ...suggestions.clubs],
    [suggestions.nationals, suggestions.clubs],
  )

  const suggestionEntries = useMemo(() => {
    const entries: Array<
      { kind: 'heading'; label: string } | { kind: 'team'; team: string; index: number }
    > = []
    let index = 0

    if (suggestions.nationals.length) {
      entries.push({ kind: 'heading', label: 'International teams' })
      for (const team of suggestions.nationals) {
        entries.push({ kind: 'team', team, index })
        index += 1
      }
    }

    if (suggestions.clubs.length) {
      entries.push({ kind: 'heading', label: 'Clubs' })
      for (const team of suggestions.clubs) {
        entries.push({ kind: 'team', team, index })
        index += 1
      }
    }

    return entries
  }, [suggestions.clubs, suggestions.nationals])

  const showSuggestions = open && query.trim().length > 0 && flatSuggestions.length > 0

  useEffect(() => {
    setActiveIndex(0)
  }, [query, flatSuggestions.length])

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    return () => window.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  const submitTeam = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return
    onAddTeam(trimmed)
    setQuery('')
    setOpen(false)
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!flatSuggestions.length) return
      setActiveIndex((index) => (index + 1) % flatSuggestions.length)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!flatSuggestions.length) return
      setActiveIndex((index) => (index - 1 + flatSuggestions.length) % flatSuggestions.length)
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      if (showSuggestions && flatSuggestions[activeIndex]) {
        submitTeam(flatSuggestions[activeIndex])
        return
      }
      submitTeam(query)
      return
    }

    if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={rootRef} className="relative mt-4 border-t border-ink/15 pt-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1">
          <span className="record-display-font text-[10px] font-bold uppercase">Add team</span>
          <input
            id="add-team-input"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Start typing a club or country…"
            autoComplete="off"
            spellCheck={false}
            className={`${inputClass} mt-2 w-full py-2 text-sm`}
            role="combobox"
            aria-expanded={showSuggestions}
            aria-controls="add-team-suggestions"
            aria-autocomplete="list"
          />
        </label>
        <button
          type="button"
          onClick={() => submitTeam(query)}
          disabled={!query.trim()}
          className={`${secondaryButtonClass} shrink-0 px-4 py-2 text-sm disabled:opacity-40`}
        >
          Add
        </button>
      </div>

      {showSuggestions ? (
        <ul
          id="add-team-suggestions"
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-ink bg-card py-1 shadow-lg sm:right-auto sm:w-full"
        >
          {suggestionEntries.map((entry) =>
            entry.kind === 'heading' ? (
              <li key={entry.label} className="px-3 py-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted">{entry.label}</p>
              </li>
            ) : (
              <li key={entry.team}>
                <button
                  type="button"
                  role="option"
                  aria-selected={entry.index === activeIndex}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => submitTeam(entry.team)}
                  className={`flex w-full px-3 py-2 text-left text-sm transition ${
                    entry.index === activeIndex
                      ? 'bg-soft font-semibold text-ink'
                      : 'text-ink hover:bg-soft/70'
                  }`}
                >
                  {entry.team}
                </button>
              </li>
            ),
          )}
        </ul>
      ) : null}
    </div>
  )
}

function TeamRecordsBreakdown({ matches }: { matches: Match[] }) {
  const teamRecords = useMemo(() => {
    const byTeam = new Map<string, Match[]>()

    for (const match of matches) {
      const team = getMatchPlayedAs(match)
      const teamMatches = byTeam.get(team) ?? []
      teamMatches.push(match)
      byTeam.set(team, teamMatches)
    }

    return [...byTeam.entries()]
      .map(([team, teamMatches]) => ({
        team,
        record: getMatchRecord(teamMatches),
        total: teamMatches.length,
      }))
      .filter(({ total }) => total > 0)
      .sort((left, right) => right.total - left.total || left.team.localeCompare(right.team))
  }, [matches])

  if (!teamRecords.length) return null

  return (
    <section className={`${panelClass} p-6`}>
      <h2 className={headingClass}>Record by team</h2>
      <p className="mt-1 text-sm text-muted">Win-draw-loss breakdown for teams with logged matches.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {teamRecords.map(({ team, record, total }) => (
          <div key={team} className="card-soft p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="record-display-font text-xs font-bold uppercase">{team}</p>
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
        ))}
      </div>
    </section>
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
                    <p className="mt-1 text-base font-semibold text-ink">
                      {formatMatchTitle(getMatchPlayedAs(match), match.opponent)}
                    </p>
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
        <p className="mt-1 text-sm text-muted">Log your first co-op seasons result.</p>
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
