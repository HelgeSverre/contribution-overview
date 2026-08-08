import { describe, expect, test } from "bun:test";
import {
  expandDaysToCalendarYears,
  filterResponseToRange,
  getCalendarYearExtensions,
  getDateChunks,
  getDateRange,
  groupRepositoriesByMonth,
  mergeContributionResponses,
  type GitHubResponse,
} from "./data";

const response = (date: string, count: number, repo = "sample/one"): GitHubResponse => ({
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
            repository: { name: repo.split("/")[1], nameWithOwner: repo, isPrivate: false },
            contributions: { totalCount: count },
          },
        ],
      },
      repositories: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
    },
  },
});

describe("date ranges", () => {
  test.each([
    ["2y", "2024-08-07"],
    ["5y", "2021-08-07"],
    ["10y", "2016-08-07"],
  ])("resolves %s", (preset, expected) => {
    const range = getDateRange(preset, null, null, new Date("2026-08-07T12:00:00Z"));
    expect(range.from.toISOString().slice(0, 10)).toBe(expected);
    expect(range.to.toISOString()).toBe("2026-08-07T12:00:00.000Z");
  });

  test("uses a valid custom range", () => {
    const from = new Date("2020-01-01T00:00:00Z");
    const to = new Date("2020-02-01T00:00:00Z");
    const range = getDateRange("custom", from, to);
    expect(range.from.getHours()).toBe(0);
    expect(range.to.getHours()).toBe(23);
    expect(range.to.getMilliseconds()).toBe(999);
  });

  test("supports a same-day custom range", () => {
    const selected = new Date(2026, 5, 1);
    const range = getDateRange("custom", selected, selected);
    expect(range.from.toLocaleDateString("en-CA")).toBe("2026-06-01");
    expect(range.to.getTime()).toBeGreaterThan(range.from.getTime());
  });

  test("clamps month and leap-year subtraction", () => {
    expect(getDateRange("1m", null, null, new Date("2025-03-31T12:00:00Z")).from.toISOString().slice(0, 10)).toBe(
      "2025-02-28",
    );
    expect(getDateRange("1y", null, null, new Date("2024-02-29T12:00:00Z")).from.toISOString().slice(0, 10)).toBe(
      "2023-02-28",
    );
  });

  test("creates non-overlapping chunks without skipped time", () => {
    const chunks = getDateChunks(new Date("2024-01-01T00:00:00Z"), new Date("2026-01-01T00:00:00Z"));
    expect(chunks).toHaveLength(3);
    expect(chunks[1].from.getTime()).toBe(chunks[0].to.getTime() + 1);
    expect(chunks[0].to.toISOString().slice(11)).toBe("23:59:59.999Z");
    expect(chunks[1].from.toISOString().slice(11)).toBe("00:00:00.000Z");
    expect(chunks.at(-1)?.to.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  test("returns the missing calendar-year ranges, including the selected boundary days", () => {
    const extensions = getCalendarYearExtensions(new Date("2026-05-07T12:00:00Z"), new Date("2026-08-07T12:00:00Z"));

    expect(extensions).toHaveLength(2);
    expect(extensions[0].from.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(extensions[0].to.toISOString()).toBe("2026-05-07T23:59:59.999Z");
    expect(extensions[1].from.toISOString()).toBe("2026-08-07T00:00:00.000Z");
    expect(extensions[1].to.toISOString()).toBe("2026-12-31T23:59:59.999Z");
  });

  test("does not extend a complete calendar year", () => {
    expect(getCalendarYearExtensions(new Date(2026, 0, 1, 0, 0, 0), new Date(2026, 11, 31, 23, 59, 59, 999))).toEqual(
      [],
    );
  });
});

describe("GraphQL response transformations", () => {
  test("filters full local data to the selected range", () => {
    const input = response("2025-01-01", 2);
    input.data.user.contributionsCollection.contributionCalendar.weeks[0].contributionDays.push(
      { date: "2026-01-01", contributionCount: 5 },
      { date: "2027-01-01", contributionCount: 9 },
    );

    const filtered = filterResponseToRange(input, new Date("2026-01-01T00:00:00Z"), new Date("2026-12-31T23:59:59Z"));

    expect(filtered.data.user.contributionsCollection.contributionCalendar.totalContributions).toBe(5);
    expect(
      filtered.data.user.contributionsCollection.contributionCalendar.weeks.flatMap((week) => week.contributionDays),
    ).toEqual([{ date: "2026-01-01", contributionCount: 5 }]);
    expect(filtered.data.user.contributionsCollection.commitContributionsByRepository).toEqual([]);
  });

  test("retains repository totals when the selected range covers the complete fixture", () => {
    const input = response("2026-01-01", 5);
    const filtered = filterResponseToRange(input, new Date("2025-01-01T00:00:00Z"), new Date("2027-01-01T00:00:00Z"));
    expect(filtered.data.user.contributionsCollection.commitContributionsByRepository).toHaveLength(1);
  });

  test("filters local data by the selected local calendar date", () => {
    const input = response("2026-06-01", 5);
    const selected = new Date(2026, 5, 1);
    const filtered = filterResponseToRange(input, selected, selected);
    expect(filtered.data.user.contributionsCollection.contributionCalendar.totalContributions).toBe(5);
  });

  test("rejects malformed responses", () => {
    expect(() => filterResponseToRange({ data: {} } as GitHubResponse, new Date(), new Date())).toThrow(
      "Invalid GitHub data",
    );
  });

  test("merges chunks without duplicating boundary days", () => {
    const first = response("2025-12-31", 2);
    const second = response("2025-12-31", 2);
    second.data.user.contributionsCollection.contributionCalendar.weeks[0].contributionDays.push({
      date: "2026-01-01",
      contributionCount: 3,
    });

    const merged = mergeContributionResponses([first, second]);
    const calendar = merged.data.user.contributionsCollection.contributionCalendar;
    expect(calendar.totalContributions).toBe(5);
    expect(calendar.weeks.flatMap((week) => week.contributionDays)).toHaveLength(2);
    expect(merged.data.user.contributionsCollection.commitContributionsByRepository[0].contributions.totalCount).toBe(
      4,
    );
  });
});

test("expands a short contribution range to complete calendar years", () => {
  const days = [
    { date: "2026-01-01", contributionCount: 5 },
    { date: "2026-05-07", contributionCount: 2 },
    { date: "2026-08-07", contributionCount: 3 },
    { date: "2026-12-31", contributionCount: 7 },
  ];

  const expanded = expandDaysToCalendarYears(days, new Date("2026-05-07T00:00:00Z"), new Date("2026-08-07T23:59:59Z"));

  expect(expanded).toHaveLength(365);
  expect(expanded[0]).toEqual({ date: "2026-01-01", contributionCount: 5, outsideSelectedRange: true });
  expect(expanded.find((day) => day.date === "2026-05-07")).toEqual({
    date: "2026-05-07",
    contributionCount: 2,
    outsideSelectedRange: false,
  });
  expect(expanded.at(-1)).toEqual({ date: "2026-12-31", contributionCount: 7, outsideSelectedRange: true });
});

test("separates original repositories and forks by creation month", () => {
  const months = groupRepositoriesByMonth(
    [
      {
        name: "one",
        nameWithOwner: "sample/one",
        createdAt: "2026-01-02T00:00:00Z",
        isFork: false,
        isPrivate: false,
      },
      {
        name: "fork",
        nameWithOwner: "sample/fork",
        createdAt: "2026-01-03T00:00:00Z",
        isFork: true,
        isPrivate: false,
      },
      {
        name: "outside",
        nameWithOwner: "sample/outside",
        createdAt: "2025-01-03T00:00:00Z",
        isFork: false,
        isPrivate: false,
      },
    ],
    new Date("2026-01-01T00:00:00Z"),
    new Date("2026-01-31T23:59:59Z"),
  );

  expect(months).toEqual([{ month: "2026-01", original: 1, forks: 1, total: 2 }]);
});

test("includes empty months in repository history", () => {
  const months = groupRepositoriesByMonth([], new Date("2026-01-15T00:00:00Z"), new Date("2026-03-02T00:00:00Z"));

  expect(months).toEqual([
    { month: "2026-01", original: 0, forks: 0, total: 0 },
    { month: "2026-02", original: 0, forks: 0, total: 0 },
    { month: "2026-03", original: 0, forks: 0, total: 0 },
  ]);
});
