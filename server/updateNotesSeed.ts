import type { UpdateNote } from '../src/types'

type SeedUpdateNote = Omit<UpdateNote, 'createdAt'>

export const UPDATE_NOTES_SEED: SeedUpdateNote[] = [
  {
    id: 2026061230,
    date: '2026-06-12',
    title: 'Update alerts only after five changes',
    body: `Dashboard update alerts now wait until enough changes have built up.

• Entry alert only appears after five or more unseen changelog updates
• Recent form free-scroll update still notifies immediately as a one-off`,
  },
  {
    id: 2026061229,
    date: '2026-06-12',
    title: 'Dashboard update alerts on entry',
    body: `New changelog entries now surface automatically when you enter the dashboard.

• Square update alert appears right after the welcome screen
• Shows version label, summary, and any unseen updates from the changelog
• Dashboard dims and blurs behind the alert until you continue`,
  },
  {
    id: 2026061228,
    date: '2026-06-12',
    title: 'Recent form free scroll and tile dates',
    body: `Browsing older form on the dashboard is smoother and more informative.

• Scroll with click-drag or two-finger trackpad swipe — tiles stay exactly where you leave them
• No page snap-back; browse seamlessly through older results
• ↻ Latest button appears when you have scrolled away and jumps back to the newest games
• Hover any W/D/L tile to see the match date, result, venue, opponent, and score`,
  },
  {
    id: 2026061221,
    date: '2026-06-12',
    title: 'Multiple match comments now persist for everyone',
    body: `Comments no longer overwrite each other when more than one co-op player leaves a note.

• New comments merge with existing ones instead of replacing the thread
• Match detail refreshes in the background so everyone sees the latest comments
• Replies and likes stay attached to their comment threads`,
  },
  {
    id: 2026061220,
    date: '2026-06-12',
    title: 'Insights tabs for Streaks and xG vs Goals',
    body: `Streaks and xG vs Goals now sit together as dedicated insight pages in stat analysis.

• Separate Insights tab row next to match stat categories
• Each insight page gets its own header and full-width layout
• Match averages overview hidden on Streaks and xG vs Goals pages`,
  },
  {
    id: 2026061119,
    date: '2026-06-11',
    title: 'xG vs Goals stat analysis tab',
    body: `New xG vs Goals section in stat analysis for finishing and scoreline insight.

• PSG actual goals compared with xG in totals and per-match averages
• Conceded goals compared with opposition xG against
• xG scoreline W/D/L record, efficiency metrics, and trend chart
• Match-by-match breakdown with finishing deltas and xG battle results`,
  },
  {
    id: 2026061118,
    date: '2026-06-11',
    title: 'Smoother welcome form letter entry',
    body: `Background form results on the welcome screen now ease in more gently.

• Each W/D/L tile fades in with a soft scale and upward motion
• Letters appear in a staggered sequence instead of popping in all at once
• Respects reduced motion preferences`,
  },
  {
    id: 2026061117,
    date: '2026-06-11',
    title: 'Welcome screen on app open only',
    body: `The welcome intro shows when you open the tool, not on the dashboard itself.

• Full CO-OP 26 welcome card with loading bar and Click to enter
• Recent form W/D/L letters tile behind the welcome and wrap as your record grows
• Dismisses into the normal dashboard for the rest of the browser session`,
  },
  {
    id: 2026061116,
    date: '2026-06-11',
    title: 'Welcome screen with live form background',
    body: `Restored the original full welcome design on the dashboard with form letters behind it.

• Exact CO-OP 26 welcome card styling, chips, and progress bar
• Recent form W/D/L tiles wrap across the welcome background as matches are logged
• Scroll down from the welcome screen into the dashboard panels`,
  },
  {
    id: 2026061115,
    date: '2026-06-11',
    title: 'Permanent welcome backdrop with form letters',
    body: `The one-time welcome screen is now a permanent background across the app.

• CO-OP 26 Dashboard branding stays as a subtle watermark
• Recent form W/D/L letters tile across the background and wrap at the screen edge
• Letters update automatically as new matches are logged
• Removed click-to-enter and first-visit only gating`,
  },
  {
    id: 2026061114,
    date: '2026-06-11',
    title: 'Longest winning run goals',
    body: `Season records now show how prolific the best winning streak was.

• Scored and conceded totals for the longest consecutive win run
• Calculated from the actual matches in that streak
• Replaces the previous All wins badge on the record card`,
  },
  {
    id: 2026061113,
    date: '2026-06-11',
    title: 'Season records panel refresh',
    body: `The collapsible records section under recent form is easier to read.

• Renamed to Season records with a collapsed preview (Unbeaten X · Wins Y)
• Expanded view uses card layout with large counts and clearer labels
• Longest unbeaten run shows W/D breakdown pills and a PSG club label
• Equal-length unbeaten runs tie-break by more wins in the run`,
  },
  {
    id: 2026061112,
    date: '2026-06-11',
    title: 'Streaks tab in stat analysis',
    body: `New Streaks category in stat analysis for form runs across the season.

• Current unbeaten and winning runs (always shown, even while building)
• Longest unbeaten and winning records at a glance
• Historical unbeaten runs of 5+ games with start/end dates and W/D breakdown
• Winning streaks of 5+ wins, plus the active streak while it is growing
• Uses all logged matches, not just screenshot stat entries`,
  },
  {
    id: 2026061111,
    date: '2026-06-11',
    title: 'Dashboard record header alignment',
    body: `Overall record, W/D/L stack, and headline metrics line up more cleanly.

• Four-column header grid with even spacing
• Win rate, matches played, and W/L Ratio align top-to-bottom with W, D, and L
• Metric column height synced to the odometer display`,
  },
  {
    id: 2026061110,
    date: '2026-06-11',
    title: 'Dashboard W/L Ratio metric column',
    body: `Added a third headline metric beside the overall record stack.

• W/L Ratio shows wins minus losses from the overall record
• Green when positive, red when zero or negative
• Win rate, matches played, and W/L Ratio align top-to-bottom with the W, D, and L numbers`,
  },
  {
    id: 2026061109,
    date: '2026-06-11',
    title: 'Stats analysis totals vs averages',
    body: `Fixed the stat-by-stat breakdown showing the same numbers for both modes.

• Count stats now show season totals and per-match averages side by side
• Percentage stats stay on per-match average only
• Category charts still switch between totals and averages with the toggle`,
  },
  {
    id: 2026061108,
    date: '2026-06-11',
    title: 'Unbeaten streak badge styling',
    body: `Refined current and longest unbeaten streak visuals in recent form.

• Compact green/orange badges instead of full-width colour blocks
• Softer feathered blend between wins and draws in the badge
• Longest winning run stays solid green`,
  },
  {
    id: 2026061107,
    date: '2026-06-11',
    title: 'Updates timeline grouped by date',
    body: `Changelog entries are easier to scan on the Updates page.

• Entries grouped under their date on the timeline
• Tap a date to expand or collapse its updates
• Tap an individual update to read full release notes`,
  },
  {
    id: 2026061106,
    date: '2026-06-11',
    title: 'Historical changelog seed',
    body: `The Updates timeline now auto-fills with project history when empty.

• Seeds all major dashboard changes from launch onward
• Shared across users when Postgres is connected
• New seed entries are added automatically when missing`,
  },
  {
    id: 2026061102,
    date: '2026-06-11',
    title: 'Streak records in recent form',
    body: `Added a Records dropdown under the current unbeaten streak.

• Longest unbeaten run (wins + draws)
• Longest winning run
• Expand/collapse from the recent form panel`,
  },
  {
    id: 2026061101,
    date: '2026-06-11',
    title: 'Tool updates timeline',
    body: `New Updates page in the sidebar (below Settings).

• Vertical timeline of dashboard changes
• Tap an entry to expand full release notes
• Shared across all users when Postgres is connected
• Subtle + Add update button to log future changes`,
  },
  {
    id: 2026061016,
    date: '2026-06-10',
    title: 'Screenshot archive',
    body: `Match screenshots are now saved when you log a game.

• Stats and scores stay even if Xbox deletes the cloud capture
• Archived screenshot shown on match detail
• Data only removed when you delete the match manually
• Stored in shared Postgres for all users`,
  },
  {
    id: 2026061017,
    date: '2026-06-10',
    title: 'First-visit welcome screen',
    body: `One-time welcome intro for new visitors.

• Co-Op 26 Dashboard branding with W/D/L colours
• Loading bar and click-to-enter
• Remembers if you have seen it (per browser)
• Fixed flash of dashboard before intro loads`,
  },
  {
    id: 2026061015,
    date: '2026-06-10',
    title: 'Xbox screenshot library import',
    body: `Import match screenshots straight from your Xbox cloud library.

• Browse recent Xbox captures in Add match
• Pick a screenshot and run the same Claude Vision extraction
• OpenXBL integration with clearer auth and retry handling`,
  },
  {
    id: 2026061014,
    date: '2026-06-10',
    title: 'Match comments, replies, and likes',
    body: `Social notes on every logged match.

• Leave a comment when reviewing a new screenshot save
• Edit or clear comments from match detail
• Reply threads and like counts on comments
• Comment preview shown in match history list`,
  },
  {
    id: 2026061013,
    date: '2026-06-10',
    title: 'Detailed stats analysis',
    body: `EA FC-style stats breakdown for season and single matches.

• Six swipeable categories: Summary, Possession, Shooting, Passing, Defending, Events
• PSG vs opposition bar charts, trend lines, and comparison rows
• Possession donut chart and fixed 0–6 xG axis scale
• Full opponent stat extraction for passes, tackles, saves, and more`,
  },
  {
    id: 2026061012,
    date: '2026-06-10',
    title: 'PSG branding and dashboard polish',
    body: `Visual refresh to match PSG colours and improve readability.

• Navy, red, and gold palette across nav, charts, and accents
• Traffic-light W/D/L record boxes with animated count-up
• Recent form ticker strip (up to 20 results)
• Current unbeaten streak under recent form
• Home/away split tiles and clearer goals chart (last 10)
• Day and night theme toggle`,
  },
  {
    id: 2026061011,
    date: '2026-06-10',
    title: 'Settings and match deletion',
    body: `Manage stored matches without digging through history.

• New Settings page in the sidebar
• Delete individual matches with confirmation
• Reset all data option
• Delete match button on match detail header`,
  },
  {
    id: 2026061010,
    date: '2026-06-10',
    title: 'Shared match database',
    body: `Replaced browser-only storage with a central database.

• All users see the same match list on Railway
• Postgres when DATABASE_URL is set; local file fallback for dev
• One-time migration from old browser storage on first load
• Setup guide added for Railway Postgres`,
  },
  {
    id: 2026061009,
    date: '2026-06-10',
    title: 'Overall record fix',
    body: `Overall W/D/L now counts every logged match.

• Previously only manual form entries updated the headline record
• Screenshot and Xbox saves now count correctly
• Win rate and matches played update with new saves`,
  },
  {
    id: 2026061008,
    date: '2026-06-10',
    title: 'Baseline record set to 184-48-151',
    body: `Updated the pre-tracker baseline added to overall record.

• Overall record = baseline + all logged matches
• Removed placeholder loss from recent form baseline tiles`,
  },
  {
    id: 2026061007,
    date: '2026-06-10',
    title: 'Railway production fixes',
    body: `Deploy and screenshot extraction reliability on Railway.

• Production Node server (replacing Vite preview)
• Longer timeouts for Claude Vision calls
• Anthropic model updated to claude-sonnet-4-6
• Clearer API key and auth error messages
• OpenXBL env and host fixes for Xbox import
• Safer retry after failed screenshot uploads`,
  },
  {
    id: 2026061006,
    date: '2026-06-10',
    title: 'Recent form UI tweaks',
    body: `• Compact + manual button in recent form header
• Match detail scrolls to top when opened from history`,
  },
  {
    id: 2026061001,
    date: '2026-06-10',
    title: 'Initial dashboard launch',
    body: `First release of the Co-Op 26 Match Tracker.

• Screenshot upload with Claude Vision extraction (scores, opponent, venue, stats)
• Dashboard with overall record, match history, and home/away split
• Duplicate match detection on upload
• Manual form quick-log for games without a screenshot`,
  },
]

export const seedUpdateNoteEntry = (entry: SeedUpdateNote): UpdateNote => ({
  ...entry,
  createdAt: `${entry.date}T12:00:00.000Z`,
})
