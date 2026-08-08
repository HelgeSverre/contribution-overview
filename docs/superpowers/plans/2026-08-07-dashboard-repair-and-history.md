# Dashboard Repair and History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the dashboard, add 2/5/10-year history, visualize original and forked repositories created per month, make the heatmap responsive without scrolling, update dependencies, and cover the result with deterministic tests.

**Architecture:** Extract date and response transformations from the Alpine component into a pure TypeScript data module, while retaining the existing Alpine and generated-SVG presentation. GitHub contributions are fetched in bounded yearly chunks; owned repository metadata is fetched once through pagination. Local mode consumes one full synthetic GraphQL-shaped fixture and applies the selected range client-side.

**Tech Stack:** Bun, TypeScript, Alpine.js, Tailwind CSS, Vite, GitHub GraphQL, generated SVG, Playwright.

## Global Constraints

- Preserve the current visual design and existing Alpine/SVG approach.
- Include 2-, 5-, and 10-year presets.
- Include forks in repository creation totals but color them differently.
- Never require horizontal heatmap scrolling.
- Use only deterministic fictional public test data; never call live GitHub from tests.
- Use Bun/Node tooling only; Python tooling is forbidden.

---

### Task 1: Pure data contracts and range transformations

**Files:**

- Create: `src/app/data.ts`
- Create: `src/app/data.test.ts`
- Modify: `package.json`

**Interfaces:**

- Produces: `getDateRange(preset, customFrom?, customTo?, now?)`, `getDateChunks(from, to)`, `filterResponseToRange(response, from, to)`, `mergeContributionResponses(responses)`, `groupRepositoriesByMonth(repositories, from, to)`, and shared response/data types.
- Consumes: GraphQL-shaped contribution responses and repository nodes.

- [ ] **Step 1: Write failing Bun tests**

Cover exact 2/5/10-year ranges, adjacent non-overlapping one-year chunks, local response filtering, response merging, and monthly original/fork grouping:

```ts
import { describe, expect, test } from "bun:test";
import { getDateChunks, getDateRange, groupRepositoriesByMonth } from "./data";

describe("history data", () => {
  test.each([
    ["2y", 2024],
    ["5y", 2021],
    ["10y", 2016],
  ])("resolves %s", (preset, year) => {
    expect(getDateRange(preset, null, null, new Date("2026-08-07T12:00:00Z")).from.getUTCFullYear()).toBe(year);
  });

  test("creates adjacent chunks without skipped dates", () => {
    const chunks = getDateChunks(new Date("2024-01-01T00:00:00Z"), new Date("2026-01-01T00:00:00Z"));
    expect(chunks[1].from.getTime()).toBe(chunks[0].to.getTime());
  });

  test("separates original repositories and forks by creation month", () => {
    const months = groupRepositoriesByMonth(
      [
        { name: "one", nameWithOwner: "demo/one", createdAt: "2026-01-02T00:00:00Z", isFork: false, isPrivate: false },
        { name: "fork", nameWithOwner: "demo/fork", createdAt: "2026-01-03T00:00:00Z", isFork: true, isPrivate: false },
      ],
      new Date("2026-01-01T00:00:00Z"),
      new Date("2026-02-01T00:00:00Z"),
    );
    expect(months[0]).toMatchObject({ month: "2026-01", original: 1, forks: 1, total: 2 });
  });
});
```

- [ ] **Step 2: Run tests and confirm the missing module failure**

Run: `bun test src/app/data.test.ts`
Expected: FAIL because `src/app/data.ts` does not exist.

- [ ] **Step 3: Implement the pure module**

Use half-open chunk intervals internally, deduplicate contribution days by ISO date during merge, validate required response branches before transformation, and escape no presentation values in this data-only module.

- [ ] **Step 4: Run focused tests**

Run: `bun test src/app/data.test.ts`
Expected: all data tests pass.

### Task 2: Deterministic ten-year fixture generator

**Files:**

- Create: `scripts/generate-test-fixture.ts`
- Create: `tests/fixtures/data.json`
- Create: `scripts/generate-test-fixture.test.ts`
- Modify: `package.json`

**Interfaces:**

- Produces: `generateFixture()` returning the GraphQL-shaped local response accepted by `filterResponseToRange`.
- Fixture repository nodes provide `name`, `nameWithOwner`, `createdAt`, `isFork`, and `isPrivate`.

- [ ] **Step 1: Write a failing generator contract test**

```ts
import { expect, test } from "bun:test";
import { generateFixture } from "./generate-test-fixture";

test("generates fictional ten-year complex data", () => {
  const fixture = generateFixture();
  const user = fixture.data.user;
  const days = user.contributionsCollection.contributionCalendar.weeks.flatMap((week) => week.contributionDays);
  expect(days.length).toBeGreaterThanOrEqual(3652);
  expect(user.repositories.nodes.some((repo) => repo.isFork)).toBe(true);
  expect(user.repositories.nodes.some((repo) => !repo.isFork)).toBe(true);
  expect(JSON.stringify(fixture)).not.toContain("helge");
});
```

- [ ] **Step 2: Run the generator test**

Run: `bun test scripts/generate-test-fixture.test.ts`
Expected: FAIL because the generator does not exist.

- [ ] **Step 3: Implement deterministic generation and package command**

Use a seeded integer PRNG, fixed date bounds, fictional `sample-developer/*` names, Sunday-aligned weeks, deliberate quiet/spike periods, and at least 140 repository nodes. Add `"generate:test-fixture": "bun scripts/generate-test-fixture.ts"`.

- [ ] **Step 4: Generate and test the committed fixture**

Run: `bun run generate:test-fixture && bun test scripts/generate-test-fixture.test.ts`
Expected: fixture is written and the test passes.

### Task 3: Dashboard fetching, processing, and long-range presets

**Files:**

- Modify: `src/app/dashboard.ts`
- Modify: `app/index.html`
- Modify: `fetch-data.sh`
- Test: `src/app/data.test.ts`

**Interfaces:**

- Consumes: all Task 1 data helpers and types.
- Produces: Alpine `DashboardData` with `repositoryCreations`, responsive chart renderers, and consistent local/live range behavior.

- [ ] **Step 1: Extend tests for malformed responses and merged repository metadata**

Assert malformed local data throws a user-readable error and merged contribution data deduplicates boundary dates while summing repository commit counts.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `bun test src/app/data.test.ts`
Expected: new assertions fail.

- [ ] **Step 3: Integrate date helpers and repository pagination**

Add the presets `{ label: "2 Years", value: "2y" }`, `{ label: "5 Years", value: "5y" }`, and `{ label: "10 Years", value: "10y" }`. Fetch contribution chunks with a small worker pool. Fetch `user.repositories(first: 100, after: $cursor, ownerAffiliations: OWNER, orderBy: {field: CREATED_AT, direction: DESC})` pages once, requesting repository metadata and `pageInfo`. Merge repository nodes into the contribution response before processing.

- [ ] **Step 4: Repair local mode and cleanup**

Load `/data.json`, filter the full fixture to the selected range, remove duplicate declarations/loops and debug logs, validate responses, escape generated SVG text, and update `fetch-data.sh` to request repository metadata compatible with local mode.

- [ ] **Step 5: Run data tests and production build**

Run: `bun test src/app/data.test.ts && bun run build`
Expected: tests pass and Vite completes successfully.

### Task 4: Responsive year heatmap and repository creation chart

**Files:**

- Modify: `src/app/dashboard.ts`
- Modify: `app/index.html`
- Modify: `src/styles/tailwind.css`
- Test: `tests/dashboard.spec.ts`

**Interfaces:**

- Consumes: `DashboardData.weeks` and `DashboardData.repositoryCreations`.
- Produces: `[data-testid="heatmap"]` containing one responsive SVG per year and `[data-testid="repository-creations-chart"]` with distinct original/fork series.

- [ ] **Step 1: Add failing browser assertions for chart semantics**

Assert the heatmap exposes multiple year SVGs, its `scrollWidth <= clientWidth`, and the repository chart exposes both `[data-series="original"]` and `[data-series="fork"]`.

- [ ] **Step 2: Run the focused Playwright test**

Run: `bunx playwright test tests/dashboard.spec.ts --grep "charts"`
Expected: FAIL because the test IDs and new chart do not exist.

- [ ] **Step 3: Render the year-wrapped heatmap**

Group weeks by year, render each year as a `width="100%"` SVG with a fixed `viewBox`, set `preserveAspectRatio="xMinYMin meet"`, reduce month label density naturally by year, remove `overflow-x-auto`/`min-w-fit`, and use an `overflow-hidden` container.

- [ ] **Step 4: Render repository creation history**

Add a stacked monthly bar chart with accent originals and muted forks, sparse adaptive x-axis labels for long ranges, and native SVG `<title>` values containing original/fork/total counts. Keep the existing commits-by-repository chart.

- [ ] **Step 5: Run focused browser checks at desktop and mobile widths**

Run: `bunx playwright test tests/dashboard.spec.ts --grep "charts|overflow"`
Expected: all focused chart tests pass.

### Task 5: Playwright suite and dependency upgrades

**Files:**

- Create: `playwright.config.ts`
- Create: `tests/dashboard.spec.ts`
- Modify: `package.json`
- Modify: `bun.lock`
- Modify as required for compatibility: `vite.config.ts`, `postcss.config.js`, `tailwind.config.js`, `src/styles/tailwind.css`

**Interfaces:**

- Tests intercept `/data.json` with `tests/fixtures/data.json` and seed `github-dashboard` local storage before navigation.

- [ ] **Step 1: Add Playwright configuration and fixture bootstrap**

Configure a Vite web server on a fixed test port, use Chromium, and add an initializer that routes `**/data.json` to the committed fixture and seeds local storage with `{ useLocalFile: true, selectedPreset: "10y" }`.

- [ ] **Step 2: Add complete behavioral tests**

Cover initial load, stats, preset selection, custom ranges, activity modes, settings persistence, both repository series, malformed JSON, fetch failure, and heatmap overflow at desktop and mobile viewports. Abort requests to `api.github.com` so accidental live access fails the suite.

- [ ] **Step 3: Update dependencies to latest stable compatible versions**

Run: `bun update --latest`
Then retain Tailwind 3 only if Tailwind 4 would require a design-affecting migration; otherwise complete the official CSS/PostCSS migration. Resolve the Lucide 1.x import path and Vite 8 config compatibility from actual build errors rather than pinning old versions without evidence.

- [ ] **Step 4: Add test scripts and refresh browser data**

Add `"test": "bun test"`, `"test:e2e": "playwright test"`, and `"test:all": "bun test && playwright test"`. Run `bunx update-browserslist-db@latest` if Browserslist remains in the upgraded dependency tree.

- [ ] **Step 5: Run final verification**

Run: `bun run format && bun test && bun run build && bun run test:e2e`
Expected: formatting completes, all Bun tests pass, Vite builds, and the full Playwright suite passes without network credentials.

- [ ] **Step 6: Review the final diff**

Run: `git diff --check && git status --short`
Expected: no whitespace errors, no generated temporary files, and only intentional project changes remain.
