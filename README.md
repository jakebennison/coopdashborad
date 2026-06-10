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
VITE_ANTHROPIC_API_KEY=your_api_key_here
```

The app stores match data in `localStorage` as JSON under `psg-coop-seasons-matches`.

## Scripts

```bash
npm run dev
npm run build
npm run preview
```
