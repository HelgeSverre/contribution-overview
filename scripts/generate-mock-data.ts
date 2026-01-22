import { writeFileSync } from "fs";

interface ContributionDay {
  date: string;
  contributionCount: number;
}

interface Week {
  contributionDays: ContributionDay[];
}

interface Repository {
  name: string;
  commits: number;
  isPrivate: boolean;
}

interface ContributionData {
  data: {
    user: {
      avatarUrl: string;
      contributionsCollection: {
        contributionCalendar: {
          totalContributions: number;
          weeks: Week[];
        };
        commitContributionsByRepository: {
          repository: {
            name: string;
            isPrivate: boolean;
          };
          contributions: {
            totalCount: number;
          };
        }[];
      };
    };
  };
}

function generateMockData(): void {
  const endDate = new Date("2025-01-21");
  const startDate = new Date("2022-01-01");

  const weeks: Week[] = [];
  let currentDate = new Date(startDate);

  // Align to Sunday
  const dayOfWeek = currentDate.getDay();
  if (dayOfWeek !== 0) {
    currentDate.setDate(currentDate.getDate() - dayOfWeek);
  }

  while (currentDate <= endDate) {
    const week: Week = { contributionDays: [] };

    for (let i = 0; i < 7; i++) {
      const date = new Date(currentDate);
      date.setDate(date.getDate() + i);

      if (date <= endDate) {
        // Generate realistic-looking contribution counts
        const isWeekend = i === 0 || i === 6;
        const baseChance = isWeekend ? 0.3 : 0.7;
        const hasContribution = Math.random() < baseChance;

        let count = 0;
        if (hasContribution) {
          // Weighted random for contribution count
          const r = Math.random();
          if (r < 0.4) count = Math.floor(Math.random() * 3) + 1;
          else if (r < 0.7) count = Math.floor(Math.random() * 5) + 3;
          else if (r < 0.9) count = Math.floor(Math.random() * 8) + 8;
          else count = Math.floor(Math.random() * 15) + 15;
        }

        week.contributionDays.push({
          date: date.toISOString().split("T")[0],
          contributionCount: count,
        });
      }
    }

    if (week.contributionDays.length > 0) {
      weeks.push(week);
    }

    currentDate.setDate(currentDate.getDate() + 7);
  }

  // Generate mock repos
  const repos: Repository[] = [
    { name: "contribution-overview", commits: 156, isPrivate: false },
    { name: "laravel-app", commits: 89, isPrivate: true },
    { name: "react-dashboard", commits: 67, isPrivate: false },
    { name: "api-server", commits: 45, isPrivate: true },
    { name: "docs-site", commits: 34, isPrivate: false },
  ];

  const totalContributions = weeks.reduce(
    (sum, week) =>
      sum + week.contributionDays.reduce((s, d) => s + d.contributionCount, 0),
    0,
  );

  const data: ContributionData = {
    data: {
      user: {
        avatarUrl: "https://avatars.githubusercontent.com/u/1?v=4",
        contributionsCollection: {
          contributionCalendar: {
            totalContributions,
            weeks,
          },
          commitContributionsByRepository: repos.map((r) => ({
            repository: {
              name: r.name,
              isPrivate: r.isPrivate,
            },
            contributions: {
              totalCount: r.commits,
            },
          })),
        },
      },
    },
  };

  writeFileSync("data.json", JSON.stringify(data, null, 2));
  console.log(
    `Generated ${weeks.length} weeks of data with ${totalContributions} total contributions`,
  );
}

generateMockData();
