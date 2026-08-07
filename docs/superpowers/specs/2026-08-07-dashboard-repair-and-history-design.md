# Dashboard Repair and History Design

## Goal

Restore the dashboard to a reliable working state, preserve its current visual direction, support longer contribution histories, add repository-creation history, prevent heatmap scrolling, modernize dependencies, and establish repeatable end-to-end coverage with public synthetic data.

## Scope

### Date ranges

Keep the existing presets and add:

- 2 Years
- 5 Years
- 10 Years

Contribution requests remain bounded to GitHub-supported intervals. Multi-year ranges are split into non-overlapping chunks with controlled concurrency so a ten-year selection does not produce a burst of simultaneous requests or skip boundary dates.

Local fixture mode applies the same selected range on the client to its full ten-year dataset. Changing a preset or custom range therefore produces the same visible period whether data came from GitHub or the local fixture.

### Repository creation history

Fetch repositories owned by the selected GitHub user through a separately paginated GraphQL repository connection. Each repository record must include at least:

- Name and full name
- Creation timestamp
- Fork status
- Privacy status where available to the token

Group repositories by creation month within the selected date range. Render a “Repositories Created” chart with separate series for original repositories and forks. Original repositories use the configured accent color; forks use a visually distinct muted color. Each monthly data point exposes the original, fork, and total counts.

Repository metadata is fetched once per dashboard refresh, not once per contribution chunk. Forks are included in totals but remain visually distinguishable.

### Responsive heatmap

Replace the single horizontally scrolling heatmap with calendar-year rows. Each row retains the familiar seven-day GitHub calendar structure and scales to the available container width. Multiple years stack vertically in chronological order.

The heatmap must:

- Never require horizontal scrolling.
- Remain inside its card at mobile and desktop widths.
- Preserve year, month, weekday, contribution-level, and per-day tooltip context where space permits.
- Prefer reduced label density over unreadably small cells on narrow screens.

### Repairs and cleanup

Repair defects encountered in the current implementation that directly affect the requested dashboard behavior, including:

- Correct root-relative local fixture/data loading.
- Remove accidental duplicate fields and duplicated activity grouping logic.
- Correct date chunk boundaries so dates are neither skipped nor double-counted.
- Remove development logging from normal dashboard operation.
- Escape dynamic labels inserted into generated SVG/HTML.
- Preserve useful loading, empty, API-error, and malformed-data states.

Do not redesign the page or introduce a charting framework. Keep the existing Alpine and SVG rendering approach unless a current dependency upgrade makes a minimal compatibility change necessary.

## Test fixture

Add a committed public fixture at `tests/fixtures/data.json`. It must be deterministic, fictional, and contain no live or personal GitHub data.

The fixture covers ten complete years and includes:

- Daily contribution calendars, including leap years.
- Quiet intervals, zero-contribution days, normal variation, and activity spikes.
- Enough repositories to exercise pagination-shaped data and chart density.
- Original repositories and forks created across many different months.
- Synthetic public and private repository metadata where the UI consumes it.

The fixture follows the GitHub GraphQL response shape used by the dashboard and includes a repository collection with `createdAt`, `isFork`, and privacy fields in addition to contribution-calendar and commit-by-repository data.

Add a reusable Bun generator and a package script such as `bun run generate:test-fixture`. Commit both the generator and generated fixture so tests run without a generation prerequisite while remaining reproducible.

## End-to-end tests

Add a Playwright suite if none exists. Tests must run against the local Vite application and intercept the root data request with `tests/fixtures/data.json`; they must never require a GitHub token or make live GitHub API requests.

The suite covers:

- Loading the dashboard from mocked local data.
- Core stats and chart rendering.
- Existing presets plus the 2-, 5-, and 10-year presets.
- Custom date ranges.
- Repository creation history with distinct original and fork series.
- Activity grouping and settings interactions that are important to normal use.
- Loading, fetch failure, and malformed response behavior where practical.
- Mobile and desktop layouts.
- An explicit assertion that a ten-year heatmap does not overflow horizontally.

Tests may seed local storage before navigation to select local-data mode and intercept `/data.json` with the fixture. Browser state must remain isolated between tests.

## Dependency updates

Update all direct dependencies and development dependencies to the newest stable versions that can work together in this project. Refresh the Bun lockfile and browser compatibility data. Adapt project configuration or source only where required by supported upgrade paths; do not perform unrelated framework migration.

## Verification

The completed change must pass:

1. Focused deterministic tests for date ranges, chunking, repository monthly grouping, and heatmap year grouping where those units can be tested without a browser.
2. The Playwright end-to-end suite against the synthetic fixture.
3. A production Vite build.
4. Browser layout checks at representative mobile and desktop widths.

No verification step may depend on private credentials, personal data, or the live GitHub API.

## Non-goals

- Redesigning the dashboard.
- Adding a backend or proxy for GitHub credentials.
- Replacing Alpine, Tailwind, or the existing SVG chart approach.
- Visualizing repositories contributed to but not owned by the selected user in the repository-creation chart.
