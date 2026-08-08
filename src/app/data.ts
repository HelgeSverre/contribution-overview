export interface ContributionDay {
  date: string;
  contributionCount: number;
}

export interface CalendarHeatmapDay extends ContributionDay {
  outsideSelectedRange: boolean;
}

export interface Week {
  contributionDays: ContributionDay[];
}

export interface RepositoryNode {
  name: string;
  nameWithOwner?: string;
  createdAt: string;
  isFork: boolean;
  isPrivate: boolean;
}

export interface GitHubResponse {
  data: {
    user: {
      avatarUrl?: string;
      contributionsCollection: {
        contributionCalendar: {
          totalContributions: number;
          weeks: Week[];
        };
        commitContributionsByRepository: {
          repository: { name: string; nameWithOwner?: string; isPrivate: boolean };
          contributions: { totalCount: number };
        }[];
      };
      repositories?: {
        nodes: RepositoryNode[];
        pageInfo?: { hasNextPage: boolean; endCursor: string | null };
      };
    };
  };
}

export interface RepositoryMonth {
  month: string;
  original: number;
  forks: number;
  total: number;
}

function daysInUtcMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function subtractUtcMonths(date: Date, months: number) {
  const totalMonths = date.getUTCFullYear() * 12 + date.getUTCMonth() - months;
  const year = Math.floor(totalMonths / 12);
  const month = ((totalMonths % 12) + 12) % 12;
  const result = new Date(date);
  result.setUTCFullYear(year, month, Math.min(date.getUTCDate(), daysInUtcMonth(year, month)));
  return result;
}

function subtractUtcYears(date: Date, years: number) {
  const year = date.getUTCFullYear() - years;
  const result = new Date(date);
  result.setUTCFullYear(
    year,
    date.getUTCMonth(),
    Math.min(date.getUTCDate(), daysInUtcMonth(year, date.getUTCMonth())),
  );
  return result;
}

function localDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function expandDaysToCalendarYears(days: ContributionDay[], from: Date, to: Date): CalendarHeatmapDay[] {
  const fromDate = localDateString(from);
  const toDate = localDateString(to);
  if (fromDate > toDate) return [];

  const daysByDate = new Map(days.map((day) => [day.date, day]));
  const firstYear = Number(fromDate.slice(0, 4));
  const lastYear = Number(toDate.slice(0, 4));
  const expanded: CalendarHeatmapDay[] = [];

  for (let year = firstYear; year <= lastYear; year++) {
    const end = Date.UTC(year + 1, 0, 1);
    for (let timestamp = Date.UTC(year, 0, 1); timestamp < end; timestamp += 86_400_000) {
      const date = new Date(timestamp).toISOString().slice(0, 10);
      const outsideSelectedRange = date < fromDate || date > toDate;
      const contributionCount = daysByDate.get(date)?.contributionCount ?? 0;
      expanded.push({ date, contributionCount, outsideSelectedRange });
    }
  }

  return expanded;
}

export function getCalendarYearExtensions(from: Date, to: Date) {
  const fromDate = localDateString(from);
  const toDate = localDateString(to);
  if (fromDate > toDate) return [];

  const firstYear = Number(fromDate.slice(0, 4));
  const lastYear = Number(toDate.slice(0, 4));
  const yearStart = new Date(Date.UTC(firstYear, 0, 1));
  const yearEnd = new Date(Date.UTC(lastYear + 1, 0, 1) - 1);
  const selectedStart = new Date(`${fromDate}T00:00:00.000Z`);
  const selectedStartDayEnd = new Date(`${fromDate}T23:59:59.999Z`);
  const selectedEndDayStart = new Date(`${toDate}T00:00:00.000Z`);
  const selectedEnd = new Date(`${toDate}T23:59:59.999Z`);
  const extensions: { from: Date; to: Date }[] = [];

  // Include each boundary day in the extension so its heatmap count represents a complete day.
  if (yearStart < selectedStart) {
    extensions.push({ from: yearStart, to: selectedStartDayEnd });
  }
  if (selectedEnd < yearEnd) {
    extensions.push({ from: selectedEndDayStart, to: yearEnd });
  }

  return extensions;
}

export function getDateRange(
  preset: string,
  customFrom: Date | null = null,
  customTo: Date | null = null,
  now = new Date(),
) {
  if (preset === "custom" && customFrom && customTo && customFrom <= customTo) {
    const from = new Date(customFrom);
    const to = new Date(customTo);
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }

  let from = new Date(now);
  const years = /^([0-9]+)y$/.exec(preset)?.[1];
  if (years) {
    from = subtractUtcYears(from, Number(years));
  } else {
    const months = /^([0-9]+)m$/.exec(preset)?.[1];
    if (months) from = subtractUtcMonths(from, Number(months));
    else from.setUTCDate(from.getUTCDate() - 7);
  }
  return { from, to: now };
}

export function getDateChunks(from: Date, to: Date) {
  if (from > to) return [];
  const chunks: { from: Date; to: Date }[] = [];
  let start = new Date(from);

  while (start <= to) {
    const nextYear = start.getUTCFullYear() + 1;
    const next = new Date(
      Date.UTC(
        nextYear,
        start.getUTCMonth(),
        Math.min(start.getUTCDate(), daysInUtcMonth(nextYear, start.getUTCMonth())),
      ),
    );
    const end = new Date(Math.min(next.getTime() - 1, to.getTime()));
    chunks.push({ from: new Date(start), to: end });
    if (end.getTime() === to.getTime()) break;
    start = next;
  }

  return chunks;
}

function assertResponse(response: GitHubResponse) {
  const collection = response?.data?.user?.contributionsCollection;
  if (!collection?.contributionCalendar || !Array.isArray(collection.contributionCalendar.weeks)) {
    throw new Error("Invalid GitHub data: contribution calendar is missing");
  }
  if (!Array.isArray(collection.commitContributionsByRepository)) {
    throw new Error("Invalid GitHub data: repository contributions are missing");
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function filterResponseToRange(response: GitHubResponse, from: Date, to: Date): GitHubResponse {
  assertResponse(response);
  const filtered = clone(response);
  const fromDate = localDateString(from);
  const toDate = localDateString(to);
  const calendar = filtered.data.user.contributionsCollection.contributionCalendar;
  const allDays = calendar.weeks.flatMap((week) => week.contributionDays);

  if (allDays.some((day) => day.date < fromDate || day.date > toDate)) {
    filtered.data.user.contributionsCollection.commitContributionsByRepository = [];
  }

  calendar.weeks = calendar.weeks
    .map((week) => ({
      contributionDays: week.contributionDays.filter((day) => day.date >= fromDate && day.date <= toDate),
    }))
    .filter((week) => week.contributionDays.length > 0);
  calendar.totalContributions = calendar.weeks
    .flatMap((week) => week.contributionDays)
    .reduce((total, day) => total + day.contributionCount, 0);

  if (filtered.data.user.repositories) {
    filtered.data.user.repositories.nodes = filtered.data.user.repositories.nodes.filter(
      (repo) => repo.createdAt >= from.toISOString() && repo.createdAt <= to.toISOString(),
    );
  }

  return filtered;
}

export function mergeContributionResponses(responses: GitHubResponse[]): GitHubResponse {
  if (!responses.length) throw new Error("No GitHub contribution data returned");
  responses.forEach(assertResponse);

  const merged = clone(responses[0]);
  const dayMap = new Map<string, ContributionDay>();
  const repoMap = new Map<
    string,
    GitHubResponse["data"]["user"]["contributionsCollection"]["commitContributionsByRepository"][number]
  >();

  for (const response of responses) {
    const collection = response.data.user.contributionsCollection;
    for (const day of collection.contributionCalendar.weeks.flatMap((week) => week.contributionDays)) {
      dayMap.set(day.date, day);
    }
    for (const repo of collection.commitContributionsByRepository) {
      const key = repo.repository.nameWithOwner || repo.repository.name;
      const existing = repoMap.get(key);
      if (existing) existing.contributions.totalCount += repo.contributions.totalCount;
      else repoMap.set(key, clone(repo));
    }
  }

  const days = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  const calendar = merged.data.user.contributionsCollection.contributionCalendar;
  calendar.totalContributions = days.reduce((total, day) => total + day.contributionCount, 0);
  calendar.weeks = [];
  for (let index = 0; index < days.length; index += 7) {
    calendar.weeks.push({ contributionDays: days.slice(index, index + 7) });
  }
  merged.data.user.contributionsCollection.commitContributionsByRepository = [...repoMap.values()];
  return merged;
}

export function groupRepositoriesByMonth(repositories: RepositoryNode[], from: Date, to: Date): RepositoryMonth[] {
  const months = new Map<string, RepositoryMonth>();
  const fromTime = from.getTime();
  const toTime = to.getTime();

  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  const lastMonth = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1);
  while (cursor.getTime() <= lastMonth) {
    const month = cursor.toISOString().slice(0, 7);
    months.set(month, { month, original: 0, forks: 0, total: 0 });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  for (const repo of repositories) {
    const created = new Date(repo.createdAt);
    if (created.getTime() < fromTime || created.getTime() > toTime) continue;
    const month = repo.createdAt.slice(0, 7);
    const value = months.get(month)!;
    if (repo.isFork) value.forks++;
    else value.original++;
    value.total++;
    months.set(month, value);
  }

  return [...months.values()].sort((a, b) => a.month.localeCompare(b.month));
}
