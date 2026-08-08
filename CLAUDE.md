# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A GitHub contributions dashboard (commits.site) that visualizes contribution data using GitHub's GraphQL API. Static site deployed to Vercel.

## Tech Stack

- **Frontend**: Alpine.js for reactivity, Tailwind CSS, Lucide icons, Flatpickr for date picking
- **Build**: Vite for bundling
- **Data**: GitHub GraphQL API (direct browser calls) or local `data.json` via CLI
- **Hosting**: Vercel (static)
- **Dev Dependencies**: Playwright for testing

## Development

```bash
bun run dev          # Start Vite dev server
bun run build        # Build for production
bun run preview      # Preview production build
bun run format       # Format with Prettier
bun run deploy       # Build and deploy to Vercel production
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

Multi-page static site with Vite:

- `index.html` - Marketing landing page (Tailwind + Lucide, no Alpine)
- `app/index.html` - Dashboard application (Alpine.js + all visualization logic)
- `src/landing.ts` - Entry point for landing page
- `src/app/main.ts` - Entry point for dashboard (Alpine init, flatpickr, icons)
- `src/app/dashboard.ts` - Alpine.js dashboard component (~900 lines)
- `src/icons.ts` - Tree-shaken Lucide icon imports
- `src/styles/tailwind.css` - Tailwind directives + custom styles

Dashboard features:

- Fetches from GitHub GraphQL API with automatic chunking for ranges >1 year
- Supports date range presets (1w, 1m, 3m, 6m, 1y, 3y) and custom ranges
- Settings stored in localStorage under `github-dashboard` key
- SVG-based rendering for heatmap, bar chart, and trend chart
- PWA support with service worker (`public/sw.js`)

## Utility Scripts

```bash
bun scripts/generate-mock-data.ts   # Generate fake data.json for testing
bun scripts/generate-opengraph.ts   # Generate og-image.png from screenshot.png
```
