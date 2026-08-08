import {
  getDateChunks,
  getDateRange,
  mergeContributionResponses,
  type GitHubResponse,
  type RepositoryNode,
} from "../src/app/data";

const contributionQuery = `
  query($username: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $username) {
      avatarUrl
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          totalContributions
          weeks { contributionDays { date contributionCount } }
        }
        commitContributionsByRepository(maxRepositories: 100) {
          repository { name nameWithOwner isPrivate }
          contributions { totalCount }
        }
      }
    }
  }
`;

const repositoryQuery = `
  query($username: String!, $cursor: String) {
    user(login: $username) {
      repositories(first: 100, after: $cursor, ownerAffiliations: OWNER, orderBy: { field: CREATED_AT, direction: DESC }) {
        nodes { name nameWithOwner createdAt isFork isPrivate }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

async function graphql<T>(query: string, variables: Record<string, string | null>): Promise<T> {
  const args = ["gh", "api", "graphql", "-f", `query=${query}`];
  for (const [key, value] of Object.entries(variables)) {
    if (value !== null) args.push("-f", `${key}=${value}`);
  }
  const process = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  if (exitCode !== 0) throw new Error(stderr.trim() || "GitHub request failed");
  return JSON.parse(stdout) as T;
}

function parseRange(fromArgument?: string, toArgument?: string) {
  const to = toArgument ? new Date(`${toArgument}T23:59:59.999Z`) : new Date();
  const from = fromArgument ? new Date(`${fromArgument}T00:00:00.000Z`) : getDateRange("1y", null, null, to).from;
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    throw new Error("Dates must use YYYY-MM-DD and the from date must not be after the to date");
  }
  return { from, to };
}

async function fetchRepositories(username: string) {
  const repositories: RepositoryNode[] = [];
  let cursor: string | null = null;
  do {
    const response = await graphql<{
      data?: {
        user?: {
          repositories: { nodes: RepositoryNode[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } };
        };
      };
      errors?: { message: string }[];
    }>(repositoryQuery, { username, cursor });
    if (response.errors?.length) throw new Error(response.errors[0].message);
    if (!response.data?.user) throw new Error(`User "${username}" not found`);
    repositories.push(...response.data.user.repositories.nodes);
    const pageInfo = response.data.user.repositories.pageInfo;
    cursor = pageInfo.hasNextPage ? pageInfo.endCursor : null;
  } while (cursor);
  return repositories;
}

export async function fetchData(username: string, from: Date, to: Date) {
  const chunks = getDateChunks(from, to);
  const responses: GitHubResponse[] = [];
  for (const chunk of chunks) {
    const response = await graphql<GitHubResponse & { errors?: { message: string }[] }>(contributionQuery, {
      username,
      from: chunk.from.toISOString(),
      to: chunk.to.toISOString(),
    });
    if (response.errors?.length) throw new Error(response.errors[0].message);
    if (!response.data?.user) throw new Error(`User "${username}" not found`);
    responses.push(response);
  }

  const merged = mergeContributionResponses(responses);
  merged.data.user.repositories = {
    nodes: await fetchRepositories(username),
    pageInfo: { hasNextPage: false, endCursor: null },
  };
  return merged;
}

async function main() {
  const [username, fromArgument, toArgument] = Bun.argv.slice(2);
  if (!username) {
    console.error("Usage: ./fetch-data.sh <username> [from-date] [to-date]");
    process.exit(1);
  }

  const auth = Bun.spawnSync(["gh", "auth", "status"], { stdout: "ignore", stderr: "ignore" });
  if (auth.exitCode !== 0) throw new Error("GitHub CLI is unavailable or not authenticated. Run: gh auth login");

  const { from, to } = parseRange(fromArgument, toArgument);
  console.log(`Fetching ${username} from ${from.toISOString()} to ${to.toISOString()}...`);
  const data = await fetchData(username, from, to);
  await Bun.write("data.json", JSON.stringify(data));
  console.log(
    `Saved data.json with ${data.data.user.contributionsCollection.contributionCalendar.totalContributions} contributions.`,
  );
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(`Error: ${(error as Error).message}`);
    process.exit(1);
  });
}
