# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A GitHub contributions dashboard (commits.site) that visualizes contribution data using GitHub's GraphQL API. Static site deployed to Vercel.

## Tech Stack

- **Frontend**: Alpine.js for reactivity, Tailwind CSS (CDN), Lucide icons, Flatpickr for date picking
- **Data**: GitHub GraphQL API (direct browser calls) or local `data.json` via CLI
- **Hosting**: Vercel (static)
- **Dev Dependencies**: Playwright for testing

## Development

```bash
bun run dev          # Start dev server on port 3000
bun run format       # Format with Prettier
bun run deploy       # Deploy to Vercel production
```

Fetch data via CLI (alternative to browser API mode):

```bash
./fetch-data.sh <username> [from-date] [to-date]
# Requires: gh auth login
```

## Tooling Preferences

- **Never use Python tooling** - No python, pip, or python-based tools (FORBIDDEN)
- Use `bunx` or adjacent Bun/Node tools instead
- For local dev server: use `file://` protocol or `bun run dev` (NEVER python)
- For package management: prefer bun over npm/yarn

## Architecture

Two-page static site:

- `index.html` - Marketing landing page (Tailwind + Lucide, no Alpine)
- `app/index.html` - Dashboard application (Alpine.js + all visualization logic)

Dashboard component (`app/index.html`):

- Lines 883-1875: Alpine.js `dashboard()` component with all state and methods
- Fetches from GitHub GraphQL API with automatic chunking for ranges >1 year
- Supports date range presets (1w, 1m, 3m, 6m, 1y, 3y) and custom ranges
- Settings stored in localStorage under `github-dashboard` key
- SVG-based rendering for heatmap, bar chart, and trend chart
- PWA support with service worker (`app/sw.js`)
