import { expect, test } from "bun:test";
import { generateFixture } from "./generate-test-fixture";

test("generates fictional ten-year complex data", () => {
  const fixture = generateFixture();
  const user = fixture.data.user;
  const days = user.contributionsCollection.contributionCalendar.weeks.flatMap((week) => week.contributionDays);
  const repositories = user.repositories.nodes;

  expect(days.length).toBeGreaterThanOrEqual(3652);
  expect(days.some((day) => day.contributionCount === 0)).toBe(true);
  expect(days.some((day) => day.contributionCount >= 20)).toBe(true);
  expect(repositories.length).toBeGreaterThanOrEqual(140);
  expect(repositories.some((repo) => repo.isFork)).toBe(true);
  expect(repositories.some((repo) => !repo.isFork)).toBe(true);
  expect(JSON.stringify(fixture).toLowerCase()).not.toContain("helge");
});
