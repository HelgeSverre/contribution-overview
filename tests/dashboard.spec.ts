import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

const fixture = path.join(import.meta.dirname, "fixtures/data.json");

async function seedLocalMode(page: Page, settings: Record<string, unknown> = {}) {
  await page.clock.setFixedTime(new Date("2026-08-07T12:00:00Z"));
  await page.route("https://api.github.com/**", (route) => route.abort("blockedbyclient"));
  await page.addInitScript(
    ({ saved }) => {
      localStorage.setItem(
        "github-dashboard",
        JSON.stringify({ username: "sample-developer", useLocalFile: true, selectedPreset: "10y", ...saved }),
      );
    },
    { saved: settings },
  );
}

async function openDashboard(page: Page, settings: Record<string, unknown> = {}) {
  await seedLocalMode(page, settings);
  await page.route("**/data.json", (route) => route.fulfill({ path: fixture, contentType: "application/json" }));
  await page.goto("/app/");
  await expect(page.getByText("Total Contributions")).toBeVisible();
  await expect(page.locator("[data-testid=heatmap] svg").first()).toBeVisible();
}

function contributionResponse(date: string, count: number) {
  return {
    data: {
      user: {
        avatarUrl: "https://example.test/avatar.png",
        contributionsCollection: {
          contributionCalendar: {
            totalContributions: count,
            weeks: [{ contributionDays: [{ date, contributionCount: count }] }],
          },
          commitContributionsByRepository: [
            {
              repository: { name: "project", nameWithOwner: "fixture/project", isPrivate: false },
              contributions: { totalCount: count },
            },
          ],
        },
      },
    },
  };
}

test("launch dashboard opens the dashboard entry point", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Launch Dashboard" }).click();

  await expect(page).toHaveURL(/\/app\/$/);
  await expect(page.getByRole("button", { name: "Open settings" })).toBeVisible();
});

test("both dashboard route variants resolve to canonical /app/", async ({ page }) => {
  for (const route of ["/app", "/app/"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/app\/$/);
    await expect(page.getByRole("button", { name: "Open settings" })).toBeVisible();
  }
});

test("charts show ten years without horizontal overflow", async ({ page }) => {
  await openDashboard(page);

  expect(await page.locator("[data-testid=heatmap] svg").count()).toBeGreaterThanOrEqual(10);
  const dimensions = await page.locator("[data-testid=heatmap]").evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  await expect(page.locator('[data-testid="repository-creations-chart"] [data-series="original"]')).toBeVisible();
  await expect(page.locator('[data-testid="repository-creations-chart"] [data-series="fork"]')).toBeVisible();
});

test("heatmap remains contained on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDashboard(page);

  const contained = await page
    .locator("[data-testid=heatmap]")
    .evaluate((element) => element.scrollWidth <= element.clientWidth);
  expect(contained).toBe(true);
});

test("short presets still render a complete calendar-year heatmap", async ({ page }) => {
  await openDashboard(page, { selectedPreset: "3m" });

  const year = page.locator('[data-testid="heatmap"] svg[data-year="2026"]');
  await expect(year.locator("rect[data-date]")).toHaveCount(365);
  const outsideContribution = year.locator('rect[data-date="2026-01-01"][data-outside-range="true"]');
  await expect(outsideContribution).toHaveAttribute("data-contribution-count", "5");
  expect(await outsideContribution.getAttribute("fill")).toMatch(/^#(?:27272a|3f3f46|52525b|71717a)$/);
  await expect(outsideContribution.locator("title")).toContainText("5 contributions");
  await expect(outsideContribution.locator("title")).toContainText("outside selected period");
  await expect(year.locator('rect[data-date="2026-12-31"][data-outside-range="true"]')).toHaveCount(1);
  await expect(year.getByText("Jan", { exact: true })).toBeVisible();
  await expect(year.getByText("Dec", { exact: true })).toBeVisible();
});

test("cached data renders immediately and is replaced after a background refresh", async ({ page }) => {
  await seedLocalMode(page, { selectedPreset: "3m" });
  const refreshedFixture = JSON.parse(await readFile(fixture, "utf8"));
  const refreshedDay = refreshedFixture.data.user.contributionsCollection.contributionCalendar.weeks
    .flatMap((week: { contributionDays: { date: string; contributionCount: number }[] }) => week.contributionDays)
    .find((day: { date: string }) => day.date === "2026-08-07");
  if (!refreshedDay) throw new Error("Expected fixture day was not found");
  refreshedDay.contributionCount += 100;

  let requests = 0;
  let releaseRefresh: (() => void) | undefined;
  const refreshGate = new Promise<void>((resolve) => {
    releaseRefresh = resolve;
  });
  let releaseFailedRefresh: (() => void) | undefined;
  const failedRefreshGate = new Promise<void>((resolve) => {
    releaseFailedRefresh = resolve;
  });
  await page.route("**/data.json", async (route) => {
    requests++;
    if (requests === 1) {
      await route.fulfill({ path: fixture, contentType: "application/json" });
      return;
    }

    if (requests === 2) {
      await refreshGate;
      await route.fulfill({ json: refreshedFixture });
      return;
    }

    await failedRefreshGate;
    await route.fulfill({ status: 500, body: "failure" });
  });

  await page.goto("/app/");
  const total = page.locator('[data-testid="total-contributions"]');
  await expect(total).toBeVisible();
  const cachedTotal = Number((await total.textContent())?.replaceAll(",", ""));
  await expect
    .poll(() => page.evaluate(() => Boolean(localStorage.getItem("github-dashboard-data-cache-v1"))))
    .toBe(true);

  await page.reload();
  await expect.poll(() => requests).toBe(2);
  await expect(total).toHaveText(cachedTotal.toLocaleString("en-US"));
  await expect(page.locator('[data-testid="background-refresh"]')).toBeVisible();
  await expect(page.getByText("Loading contribution data...")).toBeHidden();
  await expect(page.locator('[data-testid="heatmap"] svg')).toBeVisible();

  releaseRefresh?.();
  await expect.poll(async () => Number((await total.textContent())?.replaceAll(",", ""))).toBe(cachedTotal + 100);
  await expect(page.locator('[data-testid="background-refresh"]')).toBeHidden();

  await page.reload();
  await expect.poll(() => requests).toBe(3);
  await expect(total).toHaveText((cachedTotal + 100).toLocaleString("en-US"));
  await expect(page.locator('[data-testid="background-refresh"]')).toBeVisible();
  releaseFailedRefresh?.();
  await expect(page.getByText("Error loading data")).toBeVisible();
  await expect(total).toHaveText((cachedTotal + 100).toLocaleString("en-US"));
  await expect(page.locator('[data-testid="heatmap"] svg')).toBeVisible();
  await expect(page.getByText("Loading contribution data...")).toBeHidden();
});

test("2, 5, and 10 year presets filter the local history", async ({ page }) => {
  await openDashboard(page);

  for (const [label, minimum, maximum] of [
    ["2 Years", 2, 3],
    ["5 Years", 5, 6],
    ["10 Years", 10, 11],
  ] as const) {
    const dataResponse = page.waitForResponse((response) => response.url().endsWith("/data.json"));
    await page.getByRole("button", { name: label, exact: true }).click();
    await dataResponse;
    await expect(page.getByText("Loading contribution data...")).toBeHidden();
    await expect.poll(() => page.locator("[data-testid=heatmap] svg").count()).toBeGreaterThanOrEqual(minimum);
    expect(await page.locator("[data-testid=heatmap] svg").count()).toBeLessThanOrEqual(maximum);
  }
});

test("custom dates filter fixture data", async ({ page }) => {
  await openDashboard(page, {
    selectedPreset: "custom",
    customDateFrom: "2022-02-01T00:00:00.000Z",
    customDateTo: "2022-11-30T23:59:59.000Z",
  });

  await expect(page.locator('[data-testid=heatmap] svg[data-year="2022"]')).toBeVisible();
  await expect(page.locator("[data-testid=heatmap] svg")).toHaveCount(1);
});

test("activity grouping and settings remain interactive", async ({ page }) => {
  await openDashboard(page, { selectedPreset: "1y" });

  await page.getByRole("button", { name: "Weekly", exact: true }).click();
  await expect(page.getByText(/Week \d+, 2026/).first()).toBeVisible();
  await page.getByRole("button", { name: "Monthly", exact: true }).click();
  await expect(page.getByText("2026", { exact: true }).last()).toBeVisible();

  await page.getByRole("button", { name: "Open settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await page.locator(".fixed input").first().fill("fixture-user");
  await page.getByRole("button", { name: "Save & Load Data" }).click();
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("github-dashboard")!).username))
    .toBe("fixture-user");
});

test("shows a useful error for malformed local data", async ({ page }) => {
  await seedLocalMode(page);
  await page.route("**/data.json", (route) => route.fulfill({ json: { data: {} } }));
  await page.goto("/app/");

  await expect(page.getByText("Error loading data")).toBeVisible();
  await expect(page.getByText(/Invalid GitHub data/)).toBeVisible();
});

test("shows a useful error when local data cannot be loaded", async ({ page }) => {
  await seedLocalMode(page);
  await page.route("**/data.json", (route) => route.fulfill({ status: 500, body: "failure" }));
  await page.goto("/app/");

  await expect(page.getByText("Error loading data")).toBeVisible();
  await expect(page.getByText(/Could not load data.json/)).toBeVisible();
});

test("recovers from corrupt saved settings", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(() => localStorage.setItem("github-dashboard", "not-json"));
  await page.goto("/app/");

  await expect(page.getByText("No data loaded")).toBeVisible();
  expect(
    await page
      .locator("[x-data]")
      .evaluate((element) => Boolean((element as HTMLElement & { _x_dataStack?: unknown })._x_dataStack)),
  ).toBe(true);
  expect(pageErrors).toEqual([]);
});

test("supports existing fixtures without repository owner names", async ({ page }) => {
  await seedLocalMode(page, {
    selectedPreset: "custom",
    customDateFrom: "2015-01-01T00:00:00.000Z",
    customDateTo: "2026-12-31T00:00:00.000Z",
  });
  const legacy = JSON.parse(await readFile(fixture, "utf8"));
  for (const contribution of legacy.data.user.contributionsCollection.commitContributionsByRepository) {
    delete contribution.repository.nameWithOwner;
  }
  await page.route("**/data.json", (route) => route.fulfill({ json: legacy }));
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/app/");
  await expect(page.getByText("Commits by Repository")).toBeVisible();
  await expect(
    page.locator("section").filter({ hasText: "Commits by Repository" }).locator('svg[width="100%"]'),
  ).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("renders custom titles as text, not markup", async ({ page }) => {
  await openDashboard(page, { customTitle: '<img data-testid="injected-title" src="x"> Overview' });

  await expect(page.locator('[data-testid="injected-title"]')).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    '<img data-testid="injected-title" src="x"> Overview',
  );
});

test("a stale request cannot overwrite a newer preset", async ({ page }) => {
  await seedLocalMode(page);
  let requests = 0;
  await page.route("**/data.json", async (route) => {
    requests++;
    if (requests === 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({ json: { data: {} } });
    } else {
      await route.fulfill({ path: fixture, contentType: "application/json" });
    }
  });

  await page.goto("/app/");
  await page.getByRole("button", { name: "2 Years", exact: true }).click();
  await expect(page.locator("[data-testid=heatmap] svg").first()).toBeVisible();
  await page.waitForTimeout(600);

  await expect(page.getByText("Error loading data")).toBeHidden();
  expect(await page.locator("[data-testid=heatmap] svg").count()).toBeLessThanOrEqual(3);
});

test("live mode chunks contributions and paginates repositories", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-08-07T12:00:00Z"));
  await page.addInitScript(() => {
    localStorage.setItem(
      "github-dashboard",
      JSON.stringify({ username: "fixture-user", token: "fixture-token", useLocalFile: false, selectedPreset: "2y" }),
    );
  });
  const contributionRanges: { from: string; to: string }[] = [];
  const repositoryCursors: (string | null)[] = [];
  await page.route("https://api.github.com/graphql", async (route) => {
    const body = route.request().postDataJSON() as {
      query: string;
      variables: { from?: string; to?: string; cursor?: string | null };
    };
    if (body.query.includes("contributionsCollection")) {
      contributionRanges.push({ from: body.variables.from!, to: body.variables.to! });
      const count = body.variables.from === "2024-01-01T00:00:00.000Z" ? 8 : contributionRanges.length;
      await route.fulfill({ json: contributionResponse(body.variables.from!.slice(0, 10), count) });
      return;
    }

    repositoryCursors.push(body.variables.cursor ?? null);
    const secondPage = body.variables.cursor === "next-page";
    await route.fulfill({
      json: {
        data: {
          user: {
            repositories: {
              nodes: [
                {
                  name: secondPage ? "fork" : "original",
                  nameWithOwner: `fixture/${secondPage ? "fork" : "original"}`,
                  createdAt: secondPage ? "2026-02-01T00:00:00Z" : "2025-01-01T00:00:00Z",
                  isFork: secondPage,
                  isPrivate: false,
                },
              ],
              pageInfo: { hasNextPage: !secondPage, endCursor: secondPage ? null : "next-page" },
            },
          },
        },
      },
    });
  });

  await page.goto("/app/");
  await expect(page.locator('[data-testid="repository-creations-chart"] [data-series="original"]')).toBeVisible();
  await expect(page.locator('[data-testid="repository-creations-chart"] [data-series="fork"]')).toBeVisible();

  expect(contributionRanges.length).toBeGreaterThanOrEqual(4);
  const selectedRanges = contributionRanges.filter(
    (range) => range.from >= "2024-08-07T12:00:00.000Z" && range.to <= "2026-08-07T12:00:00.000Z",
  );
  const sortedRanges = [...contributionRanges].sort((a, b) => a.from.localeCompare(b.from));
  for (const range of sortedRanges) {
    expect(new Date(range.to).getTime() - new Date(range.from).getTime()).toBeLessThanOrEqual(366 * 86_400_000);
  }
  for (let index = 1; index < selectedRanges.length; index++) {
    expect(new Date(selectedRanges[index].from).getTime()).toBe(new Date(selectedRanges[index - 1].to).getTime() + 1);
  }
  expect(selectedRanges[0].from).toBe("2024-08-07T12:00:00.000Z");
  expect(selectedRanges.at(-1)?.to).toBe("2026-08-07T12:00:00.000Z");
  expect(sortedRanges[0].from).toBe("2024-01-01T00:00:00.000Z");
  expect(sortedRanges.at(-1)?.to).toBe("2026-12-31T23:59:59.999Z");
  const outsideContribution = page.locator(
    '[data-testid="heatmap"] svg[data-year="2024"] rect[data-date="2024-01-01"]',
  );
  await expect(outsideContribution).toHaveAttribute("data-contribution-count", "8");
  await expect(outsideContribution).toHaveAttribute("data-outside-range", "true");
  await expect(outsideContribution).toHaveAttribute("fill", "#71717a");
  await expect(page.locator('[data-testid="total-contributions"]')).toHaveText(
    String((selectedRanges.length * (selectedRanges.length + 1)) / 2),
  );
  await expect(
    page
      .locator('[data-testid="repository-creations-chart"] title')
      .filter({ hasText: "2025-01: 1 original, 0 forks" })
      .first(),
  ).toHaveCount(1);
  await expect(
    page
      .locator('[data-testid="repository-creations-chart"] title')
      .filter({ hasText: "2026-02: 0 original, 1 fork" })
      .first(),
  ).toHaveCount(1);
  expect(repositoryCursors).toEqual([null, "next-page"]);
});

test("a stale live request cannot overwrite a newer range", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-08-07T12:00:00Z"));
  await page.addInitScript(() => {
    localStorage.setItem(
      "github-dashboard",
      JSON.stringify({ username: "fixture-user", token: "fixture-token", useLocalFile: false, selectedPreset: "2y" }),
    );
  });
  let contributionRequests = 0;
  await page.route("https://api.github.com/graphql", async (route) => {
    const body = route.request().postDataJSON() as { query: string; variables: { from?: string } };
    if (body.query.includes("contributionsCollection")) {
      contributionRequests++;
      const stale = contributionRequests <= 3;
      if (stale) await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({
        json: contributionResponse(body.variables.from!.slice(0, 10), stale ? 9 : 1),
      });
      return;
    }
    await route.fulfill({
      json: {
        data: {
          user: {
            repositories: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
          },
        },
      },
    });
  });

  await page.goto("/app/");
  await expect.poll(() => contributionRequests).toBe(3);
  await page.locator("[x-data]").evaluate((element) => {
    const component = (element as HTMLElement & { _x_dataStack: { selectPreset: (preset: string) => void }[] })
      ._x_dataStack[0];
    component.selectPreset("1y");
  });
  await expect(page.locator('[data-testid="total-contributions"]')).toHaveText("2");
  await page.waitForTimeout(700);
  await expect(page.locator('[data-testid="total-contributions"]')).toHaveText("2");
});
