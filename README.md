# GitHub Contributions Dashboard

[![Try it Live](https://img.shields.io/badge/Try_it_Live-→-brightgreen?style=for-the-badge)](https://helgesverre.github.io/contribution-overview/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A slick, single-page dashboard that visualizes your GitHub contributions with heatmaps, charts, and trend analysis. No build step, no backend, just open and go.

![Screenshot](screenshot.png)

## Try It

**Live demo:** [helgesverre.github.io/contribution-overview](https://helgesverre.github.io/contribution-overview/)

Or run it locally:

```bash
# Clone and open
git clone https://github.com/HelgeSverre/contribution-overview.git
cd contribution-overview

# Option 1: Just open it
open index.html

# Option 2: Serve it (enables all features)
npx serve .
```

## Setup

1. Open the dashboard and click the settings icon
2. Enter your GitHub username
3. Create a [GitHub personal access token](https://github.com/settings/tokens) with `read:user` scope
4. Paste your token and hit "Fetch Data"

Your token stays in your browser's localStorage and is only sent to GitHub's API.

## CLI Mode

Prefer not to store tokens in the browser? Fetch data via command line instead:

```bash
# Authenticate with GitHub CLI (one-time)
gh auth login

# Fetch your contributions
./fetch-data.sh <username> [from-date] [to-date]

# Examples
./fetch-data.sh octocat                        # Last year
./fetch-data.sh octocat 2024-01-01             # From date to now
./fetch-data.sh octocat 2024-01-01 2024-06-30  # Custom range
```

Then enable "Use local data.json file" in settings.

## Tech Stack

[Alpine.js](https://alpinejs.dev/) | [Tailwind CSS](https://tailwindcss.com/) | [Flatpickr](https://flatpickr.js.org/) | [Lucide](https://lucide.dev/)

## License

[MIT](LICENSE)
