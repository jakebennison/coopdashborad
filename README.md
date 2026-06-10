# PSG Co-op Seasons Match Tracker

A mobile-first React + TypeScript app for logging PSG co-op seasons results, reviewing screenshot-extracted match stats, and tracking form over time.

## Stack

- Vite
- React
- TypeScript
- Tailwind CSS
- Recharts
- Anthropic Messages API for Vision extraction

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

The app stores match data in `localStorage` as JSON under `psg-coop-seasons-matches`.

## Scripts

```bash
npm run dev
npm run build
npm run preview
```
