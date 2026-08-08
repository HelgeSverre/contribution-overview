import type { GitHubResponse, RepositoryNode, Week } from "../src/app/data";

function random(seed = 0x5eed1234) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

export function generateFixture(): GitHubResponse {
  const rand = random();
  const start = new Date("2015-12-27T00:00:00Z");
  const end = new Date("2026-08-08T00:00:00Z");
  const weeks: Week[] = [];
  let totalContributions = 0;

  for (let weekStart = new Date(start); weekStart <= end; weekStart.setUTCDate(weekStart.getUTCDate() + 7)) {
    const contributionDays = Array.from({ length: 7 }, (_, dayOffset) => {
      const date = new Date(weekStart);
      date.setUTCDate(date.getUTCDate() + dayOffset);
      const year = date.getUTCFullYear();
      const weekday = date.getUTCDay();
      const quietPeriod = date >= new Date("2020-04-01T00:00:00Z") && date <= new Date("2020-06-30T00:00:00Z");
      const spike = date.getUTCDate() === 7 && date.getUTCMonth() % 4 === 0;
      const activityChance = weekday === 0 || weekday === 6 ? 0.38 : 0.7;
      let contributionCount = quietPeriod || rand() > activityChance ? 0 : Math.floor(rand() * (4 + (year % 6))) + 1;
      if (spike) contributionCount += 20 + Math.floor(rand() * 20);
      totalContributions += contributionCount;
      return { date: isoDate(date), contributionCount };
    });
    weeks.push({ contributionDays });
  }

  const words = [
    "atlas",
    "beacon",
    "canvas",
    "delta",
    "ember",
    "forge",
    "garden",
    "harbor",
    "index",
    "jigsaw",
    "kernel",
    "lantern",
    "mosaic",
    "notebook",
    "orbit",
    "parcel",
    "quartz",
    "relay",
    "signal",
    "toolkit",
  ];
  const repositories: RepositoryNode[] = Array.from({ length: 150 }, (_, index) => {
    const createdAt = new Date("2016-01-15T12:00:00Z");
    createdAt.setUTCDate(createdAt.getUTCDate() + Math.floor((index / 149) * 3830) + Math.floor(rand() * 18));
    const name = `${words[index % words.length]}-${String(index + 1).padStart(3, "0")}`;
    return {
      name,
      nameWithOwner: `sample-developer/${name}`,
      createdAt: createdAt.toISOString(),
      isFork: index % 4 === 0 || index % 11 === 0,
      isPrivate: index % 7 === 0,
    };
  });

  const commitContributionsByRepository = repositories.slice(0, 100).map((repository, index) => ({
    repository: {
      name: repository.name,
      nameWithOwner: repository.nameWithOwner,
      isPrivate: repository.isPrivate,
    },
    contributions: { totalCount: 5 + ((index * 37) % 280) },
  }));

  return {
    data: {
      user: {
        avatarUrl: "/icons/icon-192.png",
        contributionsCollection: {
          contributionCalendar: { totalContributions, weeks },
          commitContributionsByRepository,
        },
        repositories: {
          nodes: repositories,
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    },
  };
}

if (import.meta.main) {
  const destination = new URL("../tests/fixtures/data.json", import.meta.url);
  await Bun.write(destination, JSON.stringify(generateFixture(), null, 2) + "\n");
  console.log(`Generated ${destination.pathname}`);
}
