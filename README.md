# PSG Co-op Seasons Match Tracker

A mobile-first React + TypeScript app for logging PSG co-op seasons results, reviewing screenshot-extracted match stats, and tracking form over time.

## Stack

- Vite
- React
- TypeScript
- Tailwind CSS
- Recharts
- Anthropic Messages API for Vision extraction
- PostgreSQL for shared match storage

## Setup

```bash
npm install
cp .env.example .env
```

Add your Anthropic key to `.env`:

```bash
ANTHROPIC_API_KEY=sk-ant-...
```

Use the server-side variable name `ANTHROPIC_API_KEY` (not `VITE_...`). On Railway, add the same variable in the service settings with no quotes around the value.

### Shared match database

Match data is stored centrally through `/api/matches`:

- **Railway:** add a PostgreSQL database to the project, then attach `DATABASE_URL` to the app service and redeploy.
- **Local dev without Postgres:** if `DATABASE_URL` is unset, the server falls back to `.data/matches.json`.

All users of the deployed app see the same match list once Postgres is connected.

## Scripts

```bash
npm run dev
npm run build
npm start
```
