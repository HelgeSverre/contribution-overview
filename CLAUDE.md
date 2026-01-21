# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A GitHub contributions dashboard that visualizes contribution data using GitHub's GraphQL API. Single-page application with all logic in `index.html`.

## Tech Stack

- **Frontend**: Alpine.js for reactivity, Tailwind CSS for styling, Lucide icons, Flatpickr for date picking
- **Data**: GitHub GraphQL API (direct browser calls) or local `data.json` via CLI
- **Dev Dependencies**: Playwright for testing

## Development

Serve locally (choose one):
```bash
npx serve .
# or open file:///path/to/index.html directly in browser
```

Fetch data via CLI (alternative to browser API mode):
```bash
./fetch-data.sh <username> [from-date] [to-date]
# Requires: gh auth login
```

## Tooling Preferences

- **Never use Python tooling** - No python, pip, or python-based tools (FORBIDDEN)
- Use `bunx` or adjacent Bun/Node tools instead
- For local dev server: use `file://` protocol or `npx serve` (NEVER python)
- For package management: prefer bun over npm/yarn

## Architecture

All application code lives in `index.html`:
- Lines 540-1363: Alpine.js `dashboard()` component with all state and methods
- Fetches from GitHub GraphQL API with automatic chunking for ranges >1 year
- Supports date range presets (1w, 1m, 3m, 6m, 1y, 3y) and custom ranges
- Settings stored in localStorage under `github-dashboard` key
- SVG-based rendering for heatmap, bar chart, and trend chart
