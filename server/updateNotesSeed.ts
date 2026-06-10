import type { UpdateNote } from '../src/types'

type SeedUpdateNote = Omit<UpdateNote, 'createdAt'>

export const UPDATE_NOTES_SEED: SeedUpdateNote[] = [
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
