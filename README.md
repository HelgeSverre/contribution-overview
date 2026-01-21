# GitHub Contributions Dashboard

[![Try it Live](https://img.shields.io/badge/Try_it_Live-→-brightgreen?style=for-the-badge)](https://commits.site/app)
[![Website](https://img.shields.io/badge/Website-commits.site-10b981?style=for-the-badge)](https://commits.site)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

A slick, single-page dashboard that visualizes your GitHub contributions with heatmaps, charts, and trend analysis. No build step, no backend, just open and go.

![Screenshot](screenshot.png)

## Try It

**Live demo:** [commits.site/app](https://commits.site/app)

Or run it locally:

```bash
# Clone and open
git clone https://github.com/HelgeSverre/commits.site.git
cd commits.site

# Option 1: Just open it
open index.html

# Option 2: Serve it (enables all features)
npx serve .
```

## Features

- 📊 **Contribution Heatmap** - GitHub-style visualization across any date range
- 📈 **Activity Trends** - Monthly charts showing your momentum over time
- 🏆 **Repository Stats** - See which repos you contribute to most
- 🎨 **14 Accent Colors** - Personalize your dashboard theme
- 🔒 **Privacy First** - All data stays in your browser, no tracking
- 📱 **PWA Support** - Install as an app on desktop or mobile

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
