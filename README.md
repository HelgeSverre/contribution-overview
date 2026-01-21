# GitHub Contributions Dashboard

A single-page dashboard that visualizes your GitHub contribution data with heatmaps, bar charts, and trend analysis.

## Features

- Contribution heatmap (GitHub-style calendar view)
- Bar chart showing contributions per repository
- Trend chart with moving averages
- Date range presets (1 week to 3 years) and custom ranges
- Works with public and private repository contributions

## Getting Started

Open `index.html` in your browser - no build step required.

For local development with a server:
```bash
npx serve .
```

## Data Loading

The dashboard supports two modes for fetching contribution data:

### Browser API Mode (Default)

Fetches data directly from GitHub's GraphQL API in your browser.

1. Open the dashboard and click the settings icon
2. Enter your GitHub username
3. Enter a [GitHub personal access token](https://github.com/settings/tokens) with `read:user` scope
4. Select a date range and click "Fetch Data"

Your token is stored in browser localStorage and never sent anywhere except GitHub's API.

### Local File Mode (CLI)

Pre-fetch data via command line and load from a local file. Useful for:
- Avoiding token storage in the browser
- Automation and CI workflows
- Offline viewing

**Setup:**
```bash
# Authenticate with GitHub CLI (one-time)
gh auth login

# Fetch contribution data
./fetch-data.sh <username> [from-date] [to-date]

# Examples:
./fetch-data.sh octocat                        # Last year
./fetch-data.sh octocat 2024-01-01             # From date to now
./fetch-data.sh octocat 2024-01-01 2024-06-30  # Custom range
```

This saves data to `data.json`. Then in the dashboard settings, enable "Use local data.json file".

## Tech Stack

- [Alpine.js](https://alpinejs.dev/) - Reactivity
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Flatpickr](https://flatpickr.js.org/) - Date picker
- [Lucide](https://lucide.dev/) - Icons
