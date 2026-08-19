import flatpickr from "flatpickr";
import { registerIcons } from "../icons";
import { getDashboardCacheKey, getDashboardSourceKey, loadDashboardCache, saveDashboardCache } from "./cache";
import {
  expandDaysToCalendarYears,
  filterResponseToRange,
  getCalendarYearExtensions,
  getDateChunks,
  getDateRange,
  groupRepositoriesByMonth,
  mergeContributionResponses,
  type CalendarHeatmapDay,
  type ContributionDay,
  type GitHubResponse,
  type RepositoryMonth,
  type RepositoryNode,
} from "./data";

export const accentColors = {
  emerald: {
    400: "#34d399",
    500: "#10b981",
    600: "#059669",
    700: "#047857",
    900: "#064e3b",
  },
  green: {
    400: "#4ade80",
    500: "#22c55e",
    600: "#16a34a",
    700: "#15803d",
    900: "#14532d",
  },
  teal: {
    400: "#2dd4bf",
    500: "#14b8a6",
    600: "#0d9488",
    700: "#0f766e",
    900: "#134e4a",
  },
  cyan: {
    400: "#22d3ee",
    500: "#06b6d4",
    600: "#0891b2",
    700: "#0e7490",
    900: "#164e63",
  },
  sky: {
    400: "#38bdf8",
    500: "#0ea5e9",
    600: "#0284c7",
    700: "#0369a1",
    900: "#0c4a6e",
  },
  blue: {
    400: "#60a5fa",
    500: "#3b82f6",
    600: "#2563eb",
    700: "#1d4ed8",
    900: "#1e3a8a",
  },
  violet: {
    400: "#a78bfa",
    500: "#8b5cf6",
    600: "#7c3aed",
    700: "#6d28d9",
    900: "#4c1d95",
  },
  purple: {
    400: "#c084fc",
    500: "#a855f7",
    600: "#9333ea",
    700: "#7e22ce",
    900: "#581c87",
  },
  fuchsia: {
    400: "#e879f9",
    500: "#d946ef",
    600: "#c026d3",
    700: "#a21caf",
    900: "#701a75",
  },
  pink: {
    400: "#f472b6",
    500: "#ec4899",
    600: "#db2777",
    700: "#be185d",
    900: "#831843",
  },
  rose: {
    400: "#fb7185",
    500: "#f43f5e",
    600: "#e11d48",
    700: "#be123c",
    900: "#881337",
  },
  orange: {
    400: "#fb923c",
    500: "#f97316",
    600: "#ea580c",
    700: "#c2410c",
    900: "#7c2d12",
  },
  amber: {
    400: "#fbbf24",
    500: "#f59e0b",
    600: "#d97706",
    700: "#b45309",
    900: "#78350f",
  },
  yellow: {
    400: "#facc15",
    500: "#eab308",
    600: "#ca8a04",
    700: "#a16207",
    900: "#713f12",
  },
  red: {
    400: "#f87171",
    500: "#ef4444",
    600: "#dc2626",
    700: "#b91c1c",
    900: "#7f1d1d",
  },
  lime: {
    400: "#a3e635",
    500: "#84cc16",
    600: "#65a30d",
    700: "#4d7c0f",
    900: "#365314",
  },
  indigo: {
    400: "#818cf8",
    500: "#6366f1",
    600: "#4f46e5",
    700: "#4338ca",
    900: "#312e81",
  },
  slate: {
    400: "#94a3b8",
    500: "#64748b",
    600: "#475569",
    700: "#334155",
    900: "#0f172a",
  },
  gray: {
    400: "#9ca3af",
    500: "#6b7280",
    600: "#4b5563",
    700: "#374151",
    900: "#111827",
  },
  zinc: {
    400: "#a1a1aa",
    500: "#71717a",
    600: "#52525b",
    700: "#3f3f46",
    900: "#18181b",
  },
  neutral: {
    400: "#a3a3a3",
    500: "#737373",
    600: "#525252",
    700: "#404040",
    900: "#171717",
  },
  stone: {
    400: "#a8a29e",
    500: "#78716c",
    600: "#57534e",
    700: "#44403c",
    900: "#1c1917",
  },
};

const storage = {
  key: "github-dashboard",

  load(defaults: Record<string, unknown> = {}) {
    try {
      const saved = localStorage.getItem(this.key);
      if (!saved) return defaults;
      return { ...defaults, ...JSON.parse(saved) };
    } catch (e) {
      console.warn("Failed to load settings:", e);
      return defaults;
    }
  },

  save(data: Record<string, unknown>) {
    try {
      localStorage.setItem(this.key, JSON.stringify(data));
    } catch (e) {
      console.warn("Failed to save settings:", e);
    }
  },

  update(fields: Record<string, unknown>) {
    const current = this.load({});
    this.save({ ...current, ...fields });
  },
};

function debounce<T extends (...args: unknown[]) => unknown>(fn: T, delay = 300) {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

function escapeXml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&apos;", '"': "&quot;" };
    return entities[character];
  });
}

const defaultSettings = {
  username: "",
  token: "",
  useLocalFile: false,
  selectedPreset: "1y",
  accentColor: "emerald",
  activityGroupMode: "daily",
  expandedGroups: {},
  customDateFrom: null as string | null,
  customDateTo: null as string | null,
  customTitle: "",
};

interface Repo {
  name: string;
  fullName: string;
  isPrivate: boolean;
  commits: number;
}

interface DashboardData {
  totalContributions: number;
  heatmapDays: CalendarHeatmapDay[];
  maxCount: number;
  bestDay: string | null;
  dailyAverage: number;
  percentiles: { p25: number; p50: number; p75: number };
  repos: Repo[];
  repositoryCreations: RepositoryMonth[];
  monthlyTotals: Record<string, number>;
  activityDays: ContributionDay[];
  fetchedAt: string;
}

interface DataRequest {
  id: number;
  username: string;
  token: string;
  useLocalFile: boolean;
  range: { from: Date; to: Date };
  cacheKey: string;
  sourceKey: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

function isDashboardData(value: unknown): value is DashboardData {
  if (!isRecord(value) || !isRecord(value.percentiles) || !isRecord(value.monthlyTotals)) return false;

  return (
    typeof value.totalContributions === "number" &&
    Array.isArray(value.heatmapDays) &&
    typeof value.maxCount === "number" &&
    typeof value.dailyAverage === "number" &&
    typeof value.percentiles.p25 === "number" &&
    typeof value.percentiles.p50 === "number" &&
    typeof value.percentiles.p75 === "number" &&
    Array.isArray(value.repos) &&
    Array.isArray(value.repositoryCreations) &&
    Array.isArray(value.activityDays) &&
    typeof value.fetchedAt === "string"
  );
}

export function dashboard() {
  return {
    username: "",
    token: "",
    useLocalFile: false,
    accentColor: "emerald",
    accentColors: accentColors,
    isLocal: location.protocol === "file:" || ["localhost", "127.0.0.1"].includes(location.hostname),
    avatarUrl: "",
    data: null as DashboardData | null,
    loading: false,
    error: null as string | null,
    requestId: 0,
    dataSourceKey: "",
    showSettings: false,
    activityGroupMode: "daily" as "daily" | "weekly" | "monthly",
    expandedGroups: {} as Record<string, boolean>,
    settingsForm: {
      username: "",
      token: "",
      useLocalFile: false,
      accentColor: "emerald",
    },
    selectedPreset: "1y",
    customDateFrom: null as Date | null,
    customDateTo: null as Date | null,
    customTitle: "",
    editingTitle: false,
    originalTitle: "",
    dateFromPicker: null as flatpickr.Instance | null,
    dateToPickerInstance: null as flatpickr.Instance | null,
    datePresets: [
      { label: "This Week", value: "1w" },
      { label: "This Month", value: "1m" },
      { label: "3 Months", value: "3m" },
      { label: "6 Months", value: "6m" },
      { label: "1 Year", value: "1y" },
      { label: "2 Years", value: "2y" },
      { label: "3 Years", value: "3y" },
      { label: "5 Years", value: "5y" },
      { label: "10 Years", value: "10y" },
    ],

    init() {
      this.$nextTick(() => {
        registerIcons();
        this.initDatePickers();
      });

      const saved = storage.load(defaultSettings);
      this.username = (saved.username as string) || "";
      this.token = (saved.token as string) || "";
      this.useLocalFile = (saved.useLocalFile as boolean) || false;
      this.selectedPreset = (saved.selectedPreset as string) || "1y";
      this.accentColor = (saved.accentColor as string) || "emerald";
      this.activityGroupMode = (saved.activityGroupMode as "daily" | "weekly" | "monthly") || "daily";
      this.expandedGroups = (saved.expandedGroups as Record<string, boolean>) || {};
      this.customTitle = (saved.customTitle as string) || "";

      if (saved.customDateFrom) {
        this.customDateFrom = new Date(saved.customDateFrom as string);
        this.$nextTick(() => {
          this.dateFromPicker?.setDate(this.customDateFrom!, false);
        });
      }
      if (saved.customDateTo) {
        this.customDateTo = new Date(saved.customDateTo as string);
        this.$nextTick(() => {
          this.dateToPickerInstance?.setDate(this.customDateTo!, false);
        });
      }

      this.settingsForm = {
        username: this.username,
        token: this.token,
        useLocalFile: this.useLocalFile,
        accentColor: this.accentColor,
      };

      if ((this.username && this.token) || this.useLocalFile) {
        this.fetchData();
      }

      this.setupAutoSave();

      this.$watch("data", () => {
        this.$nextTick(() => registerIcons());
      });
      this.$watch("showSettings", () => {
        this.$nextTick(() => registerIcons());
      });
      this.$watch("error", () => {
        this.$nextTick(() => registerIcons());
      });
      this.$watch("activityGroupMode", () => {
        this.expandedGroups = { [this.getCurrentGroupKey()]: true };
      });
    },

    initDatePickers() {
      const commonConfig = {
        dateFormat: "Y-m-d",
        maxDate: "today" as const,
        disableMobile: true,
      };

      this.dateFromPicker = flatpickr(this.$refs.dateFromInput as HTMLElement, {
        ...commonConfig,
        onChange: (dates: Date[]) => {
          this.customDateFrom = dates[0];
          this.selectedPreset = "custom";
        },
      });

      this.dateToPickerInstance = flatpickr(this.$refs.dateToInput as HTMLElement, {
        ...commonConfig,
        onChange: (dates: Date[]) => {
          this.customDateTo = dates[0];
          this.selectedPreset = "custom";
        },
      });
    },

    setupAutoSave() {
      const saveExpandedGroups = debounce(() => {
        storage.update({ expandedGroups: this.expandedGroups });
      }, 500);

      this.$watch("expandedGroups", saveExpandedGroups, { deep: true });
      this.$watch("activityGroupMode", (v: string) => storage.update({ activityGroupMode: v }));
      this.$watch("selectedPreset", (v: string) => storage.update({ selectedPreset: v }));
      this.$watch("customDateFrom", (v: Date | null) => storage.update({ customDateFrom: v?.toISOString() || null }));
      this.$watch("customDateTo", (v: Date | null) => storage.update({ customDateTo: v?.toISOString() || null }));
    },

    getPlaceholderData() {
      const dateRange = this.getDateRange();
      const formatDate = (d: Date | null) =>
        d instanceof Date
          ? d.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : "";

      return {
        "user.name": this.username,
        "user.avatar": this.avatarUrl,
        "stats.total": this.data?.totalContributions,
        "stats.repos": this.data?.repos?.length,
        "stats.bestDay": this.data?.maxCount,
        "stats.bestDayDate": this.data?.bestDay ? formatDate(new Date(this.data.bestDay)) : "",
        "stats.dailyAvg": this.data?.dailyAverage?.toFixed(1),
        "date.from": formatDate(dateRange.from),
        "date.to": formatDate(dateRange.to),
      };
    },

    getDisplayTitle() {
      if (!this.customTitle) return "GitHub Contributions";
      const data = this.getPlaceholderData();
      return escapeXml(this.customTitle).replace(/\[([^\]]+)\]/g, (_match: string, key: string) => {
        const value = data[key as keyof typeof data];
        if (Object.hasOwn(data, key)) {
          return `<span data-placeholder="${key}">${escapeXml(String(value ?? ""))}</span>`;
        }
        return key;
      });
    },

    startEditTitle() {
      this.editingTitle = true;
      this.originalTitle = this.customTitle;
      this.$nextTick(() => (this.$refs.titleInput as HTMLInputElement)?.focus());
    },

    stopEditTitle() {
      this.editingTitle = false;
      storage.update({ customTitle: this.customTitle });
    },

    cancelEditTitle() {
      this.customTitle = this.originalTitle;
      this.editingTitle = false;
    },

    getDateRange() {
      return getDateRange(this.selectedPreset, this.customDateFrom, this.customDateTo);
    },

    selectPreset(preset: string) {
      this.selectedPreset = preset;
      this.savePreference();
      this.fetchData();
    },

    applyCustomRange() {
      if (this.customDateFrom && this.customDateTo) {
        this.selectedPreset = "custom";
        this.fetchData();
      }
    },

    savePreference() {
      storage.update({
        username: this.username,
        token: this.token,
        useLocalFile: this.useLocalFile,
        selectedPreset: this.selectedPreset,
        accentColor: this.accentColor,
      });
    },

    async saveSettings() {
      this.username = this.settingsForm.username;
      this.token = this.settingsForm.token;
      this.useLocalFile = this.settingsForm.useLocalFile;
      const colorChanged = this.accentColor !== this.settingsForm.accentColor;
      this.accentColor = this.settingsForm.accentColor;

      this.savePreference();
      this.showSettings = false;

      if (colorChanged) {
        location.reload();
      } else {
        await this.fetchData();
      }
    },

    async fetchData() {
      const cacheIdentity = {
        username: this.username,
        useLocalFile: this.useLocalFile,
        selectedPreset: this.selectedPreset,
        customDateFrom: this.customDateFrom,
        customDateTo: this.customDateTo,
      };
      const request: DataRequest = {
        id: ++this.requestId,
        username: this.username,
        token: this.token,
        useLocalFile: this.useLocalFile,
        range: this.getDateRange(),
        cacheKey: getDashboardCacheKey(cacheIdentity),
        sourceKey: getDashboardSourceKey(cacheIdentity),
      };
      this.error = null;

      const cached = loadDashboardCache(localStorage, request.cacheKey, isDashboardData);
      if (cached) {
        this.data = cached.data;
        this.avatarUrl = cached.avatarUrl;
        this.dataSourceKey = request.sourceKey;
        this.expandedGroups = { [this.getCurrentGroupKey()]: true };
      } else if (this.data && this.dataSourceKey && this.dataSourceKey !== request.sourceKey) {
        this.data = null;
        this.avatarUrl = "";
        this.dataSourceKey = "";
      }

      this.loading = true;

      try {
        if (request.useLocalFile) {
          await this.fetchFromFile(request);
        } else {
          await this.fetchFromAPI(request);
        }
        if (request.id !== this.requestId || !this.data) return;

        this.dataSourceKey = request.sourceKey;
        saveDashboardCache(localStorage, request.cacheKey, request.sourceKey, this.data, this.avatarUrl);
      } catch (err) {
        if (request.id !== this.requestId) return;
        this.error = (err as Error).message;
      } finally {
        if (request.id !== this.requestId) return;
        this.loading = false;
        this.$nextTick(() => registerIcons());
      }
    },

    async fetchFromFile(request: DataRequest) {
      const response = await fetch("/data.json");
      if (!response.ok) {
        throw new Error("Could not load data.json. Run fetch-data.sh first.");
      }
      const json = (await response.json()) as GitHubResponse;
      if (request.id !== this.requestId) return;
      const selectedResponse = filterResponseToRange(json, request.range.from, request.range.to);
      const heatmapSourceDays = json.data.user.contributionsCollection.contributionCalendar.weeks.flatMap(
        (week) => week.contributionDays,
      );
      this.processData(selectedResponse, request.range, heatmapSourceDays);
    },

    async fetchFromAPI(request: DataRequest) {
      if (!request.username || !request.token) {
        throw new Error("Username and token are required");
      }

      const { from, to } = request.range;
      const chunks = getDateChunks(from, to);
      const results: GitHubResponse[] = [];

      for (let index = 0; index < chunks.length; index += 3) {
        results.push(
          ...(await Promise.all(
            chunks
              .slice(index, index + 3)
              .map((chunk) => this.fetchChunk(chunk.from, chunk.to, request.username, request.token)),
          )),
        );
        if (request.id !== this.requestId) return;
      }

      const merged = mergeContributionResponses(results);
      const extensionChunks = getCalendarYearExtensions(from, to).flatMap((extension) =>
        getDateChunks(extension.from, extension.to),
      );
      const [extensionResults, repositories] = await Promise.all([
        Promise.all(
          extensionChunks.map((chunk) => this.fetchChunk(chunk.from, chunk.to, request.username, request.token)),
        ),
        this.fetchRepositories(request.username, request.token),
      ]);
      if (request.id !== this.requestId) return;

      merged.data.user.repositories = {
        nodes: repositories,
        pageInfo: { hasNextPage: false, endCursor: null },
      };
      const heatmapSourceDays = [...results, ...extensionResults].flatMap((response) =>
        response.data.user.contributionsCollection.contributionCalendar.weeks.flatMap((week) => week.contributionDays),
      );
      this.processData(merged, request.range, heatmapSourceDays);
    },

    async fetchChunk(from: Date, to: Date, username: string, token: string) {
      const query = `
        query($username: String!, $from: DateTime!, $to: DateTime!) {
          user(login: $username) {
            avatarUrl
            contributionsCollection(from: $from, to: $to) {
              contributionCalendar {
                totalContributions
                weeks {
                  contributionDays {
                    date
                    contributionCount
                  }
                }
              }
              commitContributionsByRepository(maxRepositories: 100) {
                repository {
                  name
                  nameWithOwner
                  isPrivate
                }
                contributions {
                  totalCount
                }
              }
            }
          }
        }
      `;

      const response = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          variables: {
            username,
            from: from.toISOString(),
            to: to.toISOString(),
          },
        }),
      });

      if (!response.ok) throw new Error(`GitHub request failed (${response.status})`);
      const json = (await response.json()) as GitHubResponse & { errors?: { message: string }[] };

      if (json.errors) {
        throw new Error(json.errors[0].message);
      }

      if (!json.data?.user) {
        throw new Error(`User "${username}" not found`);
      }

      return json;
    },

    async fetchRepositories(username: string, token: string) {
      const repositories: RepositoryNode[] = [];
      let cursor: string | null = null;
      let hasNextPage = true;

      const query = `
        query($username: String!, $cursor: String) {
          user(login: $username) {
            repositories(
              first: 100
              after: $cursor
              ownerAffiliations: OWNER
              orderBy: { field: CREATED_AT, direction: DESC }
            ) {
              nodes {
                name
                nameWithOwner
                createdAt
                isFork
                isPrivate
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        }
      `;

      while (hasNextPage) {
        const response = await fetch("https://api.github.com/graphql", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query, variables: { username, cursor } }),
        });
        if (!response.ok) throw new Error(`GitHub repository request failed (${response.status})`);
        const json = (await response.json()) as {
          data?: {
            user?: {
              repositories: { nodes: RepositoryNode[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } };
            };
          };
          errors?: { message: string }[];
        };
        if (json.errors) throw new Error(json.errors[0].message);
        if (!json.data?.user) throw new Error(`User "${username}" not found`);

        repositories.push(...json.data.user.repositories.nodes);
        ({ hasNextPage, endCursor: cursor } = json.data.user.repositories.pageInfo);
      }

      return repositories;
    },

    processData(
      json: GitHubResponse,
      range: { from: Date; to: Date },
      heatmapSourceDays: ContributionDay[] = json.data.user.contributionsCollection.contributionCalendar.weeks.flatMap(
        (week) => week.contributionDays,
      ),
    ) {
      if (json.data.user.avatarUrl) {
        this.avatarUrl = json.data.user.avatarUrl;
      }

      const collection = json.data.user.contributionsCollection;
      const calendar = collection.contributionCalendar;

      const days = calendar.weeks.flatMap((w) => w.contributionDays);

      let maxCount = 0;
      let bestDay: string | null = null;
      days.forEach((d) => {
        if (d.contributionCount > maxCount) {
          maxCount = d.contributionCount;
          bestDay = d.date;
        }
      });

      const totalDays = days.length || 1;
      const dailyAverage = calendar.totalContributions / totalDays;

      const nonZeroCounts = days
        .map((d) => d.contributionCount)
        .filter((c) => c > 0)
        .sort((a, b) => a - b);
      const p25 = nonZeroCounts[Math.floor(nonZeroCounts.length * 0.25)] || 1;
      const p50 = nonZeroCounts[Math.floor(nonZeroCounts.length * 0.5)] || 2;
      const p75 = nonZeroCounts[Math.floor(nonZeroCounts.length * 0.75)] || 3;

      const repos = collection.commitContributionsByRepository
        .map((r) => ({
          name: r.repository.name,
          fullName: r.repository.nameWithOwner || r.repository.name,
          isPrivate: r.repository.isPrivate,
          commits: r.contributions.totalCount,
        }))
        .filter((r) => r.commits > 0)
        .sort((a, b) => b.commits - a.commits);

      const monthlyTotals: Record<string, number> = {};
      days.forEach((d) => {
        const month = d.date.substring(0, 7);
        monthlyTotals[month] = (monthlyTotals[month] || 0) + d.contributionCount;
      });

      const activityDays = [...days].reverse();
      const repositoryCreations = groupRepositoriesByMonth(
        json.data.user.repositories?.nodes ?? [],
        range.from,
        range.to,
      );

      this.data = {
        totalContributions: calendar.totalContributions,
        heatmapDays: expandDaysToCalendarYears(heatmapSourceDays, range.from, range.to),
        maxCount,
        bestDay,
        dailyAverage,
        percentiles: { p25, p50, p75 },
        repos,
        repositoryCreations,
        monthlyTotals,
        activityDays,
        fetchedAt: new Date().toISOString(),
      };

      this.expandedGroups = { [this.getCurrentGroupKey()]: true };
    },

    formatDate(dateStr: string) {
      const date = new Date(dateStr + "T00:00:00");
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    },

    formatDateTime(dateStr: string) {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    },

    getDayOfWeek(dateStr: string) {
      const date = new Date(dateStr + "T00:00:00");
      return date.toLocaleDateString("en-US", { weekday: "short" });
    },

    getCurrentMonthKey() {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    },

    getCurrentWeekKey() {
      const now = new Date();
      const weekNum = this.getWeekNumber(now);
      return `${now.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
    },

    getCurrentYearKey() {
      return String(new Date().getFullYear());
    },

    getCurrentGroupKey() {
      switch (this.activityGroupMode) {
        case "weekly":
          return this.getCurrentWeekKey();
        case "monthly":
          return this.getCurrentYearKey();
        default:
          return this.getCurrentMonthKey();
      }
    },

    groupDaysByMonth() {
      if (!this.data?.activityDays) return [];

      const groups: Record<string, { key: string; label: string; items: ContributionDay[]; total: number }> = {};
      this.data.activityDays.forEach((day) => {
        const monthKey = day.date.substring(0, 7);
        if (!groups[monthKey]) {
          const date = new Date(monthKey + "-01");
          groups[monthKey] = {
            key: monthKey,
            label: date.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            }),
            items: [],
            total: 0,
          };
        }
        groups[monthKey].items.push(day);
        groups[monthKey].total += day.contributionCount;
      });

      return Object.values(groups).sort((a, b) => b.key.localeCompare(a.key));
    },

    getActivityGroups() {
      switch (this.activityGroupMode) {
        case "weekly":
          return this.groupDaysByWeek();
        case "monthly":
          return this.groupMonthsByYear();
        default:
          return this.groupDaysByMonth();
      }
    },

    groupDaysByWeek() {
      if (!this.data?.activityDays) return [];
      const groups: Record<string, { key: string; label: string; items: ContributionDay[]; total: number }> = {};
      this.data.activityDays.forEach((day) => {
        const date = new Date(day.date + "T00:00:00");
        const year = date.getFullYear();
        const weekNum = this.getWeekNumber(date);
        const weekKey = `${year}-W${String(weekNum).padStart(2, "0")}`;
        if (!groups[weekKey]) {
          groups[weekKey] = {
            key: weekKey,
            label: `Week ${weekNum}, ${year}`,
            items: [],
            total: 0,
          };
        }
        groups[weekKey].items.push(day);
        groups[weekKey].total += day.contributionCount;
      });
      return Object.values(groups).sort((a, b) => b.key.localeCompare(a.key));
    },

    groupMonthsByYear() {
      if (!this.data?.activityDays) return [];
      const monthTotals: Record<string, { count: number; days: number }> = {};
      this.data.activityDays.forEach((day) => {
        const monthKey = day.date.substring(0, 7);
        if (!monthTotals[monthKey]) {
          monthTotals[monthKey] = { count: 0, days: 0 };
        }
        monthTotals[monthKey].count += day.contributionCount;
        monthTotals[monthKey].days++;
      });

      const groups: Record<
        string,
        {
          key: string;
          label: string;
          items: { key: string; label: string; count: number; days: number }[];
          total: number;
        }
      > = {};
      Object.entries(monthTotals).forEach(([monthKey, data]) => {
        const year = monthKey.substring(0, 4);
        if (!groups[year]) {
          groups[year] = { key: year, label: year, items: [], total: 0 };
        }
        const date = new Date(monthKey + "-01");
        groups[year].items.push({
          key: monthKey,
          label: date.toLocaleDateString("en-US", { month: "long" }),
          count: data.count,
          days: data.days,
        });
        groups[year].total += data.count;
      });

      Object.values(groups).forEach((g) => g.items.sort((a, b) => b.key.localeCompare(a.key)));
      return Object.values(groups).sort((a, b) => b.key.localeCompare(a.key));
    },

    getWeekNumber(date: Date) {
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    },

    areAllGroupsExpanded() {
      const groups = this.getActivityGroups();
      if (groups.length === 0) return false;
      return groups.every((g) => this.expandedGroups[g.key]);
    },

    toggleAllGroups() {
      const groups = this.getActivityGroups();
      if (this.areAllGroupsExpanded()) {
        groups.forEach((g) => (this.expandedGroups[g.key] = false));
      } else {
        groups.forEach((g) => (this.expandedGroups[g.key] = true));
      }
    },

    toggleGroup(key: string) {
      this.expandedGroups[key] = !this.expandedGroups[key];
    },

    getColorLevel(count: number) {
      if (count === 0) return 0;
      const { p25, p50, p75 } = this.data!.percentiles;
      if (count <= p25) return 1;
      if (count <= p50) return 2;
      if (count <= p75) return 3;
      return 4;
    },

    getColorClass(level: number) {
      const accent = this.accentColors[this.accentColor as keyof typeof accentColors] || this.accentColors.emerald;
      const colors = ["#27272a", accent[900], accent[700], accent[500], accent[400]];
      return colors[level];
    },

    getGrayscaleColor(level: number) {
      return ["#18181b", "#27272a", "#3f3f46", "#52525b", "#71717a"][level];
    },

    heatmapHover(event: MouseEvent) {
      const cell = (event.target as Element)?.closest?.("rect[data-date]");
      if (!cell) return;
      window.showChartTooltip(
        event,
        Number(cell.getAttribute("data-contribution-count")),
        this.formatDate(cell.getAttribute("data-date") ?? ""),
      );
    },

    heatmapLeave(event: MouseEvent) {
      window.hideChartTooltip(event);
    },

    renderHeatmap() {
      if (!this.data) return "";

      const cellSize = 10;
      const step = 13;
      const width = 744;
      const height = 124;
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const years = new Map<number, CalendarHeatmapDay[]>();

      this.data.heatmapDays.forEach((day) => {
        const year = Number(day.date.slice(0, 4));
        const yearDays = years.get(year) ?? [];
        yearDays.push(day);
        years.set(year, yearDays);
      });

      const dayLabels = ["", "Mon", "", "Wed", "", "Fri", ""];
      const labels = dayLabels
        .map((label, index) => `<text x="0" y="${38 + index * step}" fill="#71717a" font-size="10">${label}</text>`)
        .join("");

      return [...years.entries()]
        .sort(([a], [b]) => a - b)
        .map(([year, days]) => {
          const calendarStart = new Date(Date.UTC(year, 0, 1));
          calendarStart.setUTCDate(calendarStart.getUTCDate() - calendarStart.getUTCDay());
          const seenMonths = new Set<number>();
          let monthLabels = "";
          let cells = "";

          days.forEach((day) => {
            const date = new Date(`${day.date}T00:00:00Z`);
            const weekIndex = Math.floor((date.getTime() - calendarStart.getTime()) / (7 * 86400000));
            const x = 42 + weekIndex * step;
            const y = 29 + date.getUTCDay() * step;
            const month = date.getUTCMonth();
            if (!seenMonths.has(month)) {
              monthLabels += `<text x="${x}" y="24" fill="#71717a" font-size="10">${months[month]}</text>`;
              seenMonths.add(month);
            }
            const tooltip = escapeXml(
              `${day.contributionCount} contribution${day.contributionCount === 1 ? "" : "s"} on ${this.formatDate(day.date)}`,
            );
            const fill = day.outsideSelectedRange
              ? this.getGrayscaleColor(this.getColorLevel(day.contributionCount))
              : this.getColorClass(this.getColorLevel(day.contributionCount));
            const outline = day.outsideSelectedRange ? ' stroke="#27272a" stroke-width="1"' : "";
            cells += `<rect data-date="${day.date}" data-contribution-count="${day.contributionCount}" data-outside-range="${day.outsideSelectedRange}" x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="2" fill="${fill}"${outline} aria-label="${tooltip}"></rect>`;
          });

          return `<svg data-year="${year}" width="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMinYMin meet" role="img" aria-label="Contribution activity for ${year}">
            <text x="0" y="12" fill="#a1a1aa" font-size="12" font-weight="500">${year}</text>
            ${monthLabels}${labels}${cells}
          </svg>`;
        })
        .join("");
    },

    renderBarChart() {
      if (!this.data || !this.data.repos.length) {
        return `<div class="flex flex-col items-center justify-center h-64 text-zinc-500">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mb-3 opacity-50"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
          <p class="text-sm">No repository data available</p>
        </div>`;
      }

      const repos = this.data.repos.slice(0, 10);
      const maxCommits = repos[0].commits;
      const barHeight = 24;
      const gap = 8;
      const height = repos.length * (barHeight + gap) + 8;

      let bars = repos
        .map((repo, i) => {
          const y = i * (barHeight + gap) + 4;
          const barWidth = Math.max(4, (repo.commits / maxCommits) * 100);
          const privateIcon = repo.isPrivate
            ? `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#71717a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" x="130" y="${y + 6}"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
            : "";

          const accentColor = this.accentColors[this.accentColor as keyof typeof accentColors]?.[500] || "#10b981";
          const displayName = escapeXml(repo.name.length > 18 ? repo.name.substring(0, 18) + "…" : repo.name);
          const fullName = escapeXml(repo.fullName);
          return `
            <g>
              <text x="0" y="${y + barHeight / 2 + 5}" fill="#d4d4d8" style="font-size: 13px; font-family: system-ui, sans-serif">
                ${displayName}
              </text>
              ${privateIcon}
              <rect x="150" y="${y}" width="${barWidth}%" height="${barHeight}" rx="4" fill="${accentColor}" opacity="0.8">
                <title>${fullName}: ${repo.commits} commits</title>
              </rect>
              <text x="155" y="${y + barHeight / 2 + 5}" fill="#fff" style="font-size: 12px; font-weight: 500; font-family: system-ui, sans-serif">${repo.commits}</text>
            </g>
          `;
        })
        .join("");

      return `<svg width="100%" height="${height}" viewBox="0 0 380 ${height}" preserveAspectRatio="xMinYMin meet">
        ${bars}
      </svg>`;
    },

    renderRepositoryCreationsChart() {
      if (!this.data?.repositoryCreations.length) {
        return `<div class="flex h-56 items-center justify-center text-sm text-zinc-500">No repository creation data available</div>`;
      }

      const values = this.data.repositoryCreations;
      const width = 900;
      const height = 230;
      const padding = { top: 16, right: 12, bottom: 38, left: 34 };
      const chartWidth = width - padding.left - padding.right;
      const chartHeight = height - padding.top - padding.bottom;
      const slot = chartWidth / values.length;
      const barWidth = Math.max(1, slot * 0.72);
      const maxTotal = Math.max(1, ...values.map((value) => value.total));
      const accent = this.accentColors[this.accentColor as keyof typeof accentColors]?.[500] || "#10b981";
      const labelEvery = Math.max(1, Math.ceil(values.length / 10));
      let originals = "";
      let forks = "";
      let labels = "";

      values.forEach((value, index) => {
        const x = padding.left + index * slot + (slot - barWidth) / 2;
        const originalHeight = (value.original / maxTotal) * chartHeight;
        const forkHeight = (value.forks / maxTotal) * chartHeight;
        const baseline = padding.top + chartHeight;
        const tooltip = escapeXml(
          `${value.month}: ${value.original} original, ${value.forks} fork${value.forks === 1 ? "" : "s"}, ${value.total} total`,
        );
        originals += `<rect x="${x}" y="${baseline - originalHeight}" width="${barWidth}" height="${originalHeight}" fill="${accent}"><title>${tooltip}</title></rect>`;
        forks += `<rect x="${x}" y="${baseline - originalHeight - forkHeight}" width="${barWidth}" height="${forkHeight}" fill="#71717a"><title>${tooltip}</title></rect>`;

        if (index % labelEvery === 0 || index === values.length - 1) {
          labels += `<text x="${x + barWidth / 2}" y="${height - 14}" fill="#71717a" font-size="10" text-anchor="middle">${value.month}</text>`;
        }
      });

      const grid = [0, 0.5, 1]
        .map((ratio) => {
          const y = padding.top + chartHeight * (1 - ratio);
          return `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#3f3f46" stroke-dasharray="2,4"/><text x="${padding.left - 7}" y="${y + 3}" fill="#71717a" font-size="10" text-anchor="end">${Math.round(maxTotal * ratio)}</text>`;
        })
        .join("");

      return `<svg width="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Repositories created per month">
        ${grid}<g data-series="original">${originals}</g><g data-series="fork">${forks}</g>${labels}
      </svg>`;
    },

    renderTrendChart() {
      if (!this.data || !Object.keys(this.data.monthlyTotals).length) {
        return `<div class="flex flex-col items-center justify-center h-64 text-zinc-500">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mb-3 opacity-50"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          <p class="text-sm">No monthly data available</p>
        </div>`;
      }

      const months = Object.entries(this.data.monthlyTotals).sort(([a], [b]) => a.localeCompare(b));

      if (months.length < 2) {
        const [month, count] = months[0];
        const date = new Date(month + "-01");
        const monthName = date.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        });
        return `<div class="flex flex-col items-center justify-center h-64 text-zinc-400">
          <p class="text-3xl font-semibold text-zinc-200">${count}</p>
          <p class="text-sm mt-1">contributions in ${monthName}</p>
        </div>`;
      }

      const values = months.map(([, v]) => v);
      const maxVal = Math.max(...values);

      const width = 500;
      const height = 220;
      const padding = { top: 30, right: 20, bottom: 60, left: 50 };
      const chartWidth = width - padding.left - padding.right;
      const chartHeight = height - padding.top - padding.bottom;

      const points = months.map(([month, count], i) => {
        const x = padding.left + (i / Math.max(1, months.length - 1)) * chartWidth;
        const y = padding.top + chartHeight - (count / (maxVal || 1)) * chartHeight;
        return { x, y, month, count };
      });

      const areaPath =
        `M ${points[0].x} ${padding.top + chartHeight} ` +
        points.map((p) => `L ${p.x} ${p.y}`).join(" ") +
        ` L ${points[points.length - 1].x} ${padding.top + chartHeight} Z`;

      const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

      const yearLabels = points
        .map((p, i) => {
          const [year, monthNum] = months[i][0].split("-");
          const isJanuary = parseInt(monthNum) === 1;
          const isFirst = i === 0;
          if (!isJanuary && !isFirst) return "";

          return `<text x="${p.x}" y="${height - 38}" fill="#a1a1aa" style="font-size: 10px; font-family: system-ui, sans-serif" text-anchor="middle">${year}</text>`;
        })
        .join("");

      const xLabels = points
        .map((p, i) => {
          const [, monthNum] = months[i][0].split("-");
          const monthLabel = monthNames[parseInt(monthNum) - 1];

          return `<text x="${p.x}" y="${height - 18}" fill="#71717a" style="font-size: 8px; font-family: system-ui, sans-serif" text-anchor="end" transform="rotate(-45, ${p.x}, ${height - 18})">${monthLabel}</text>`;
        })
        .join("");

      const yTicks = [0, 0.25, 0.5, 0.75, 1];
      const yLabelsHtml = yTicks
        .map((ratio) => {
          const val = Math.round(maxVal * ratio);
          const y = padding.top + chartHeight * (1 - ratio);
          return `
            <text x="${padding.left - 8}" y="${y + 4}" fill="#71717a" style="font-size: 11px; font-family: system-ui, sans-serif" text-anchor="end">${val}</text>
            <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#3f3f46" stroke-dasharray="2,4" opacity="0.5"/>
          `;
        })
        .join("");

      const accentColor = this.accentColors[this.accentColor as keyof typeof accentColors]?.[500] || "#10b981";
      const dots = points
        .map((p) => {
          const date = new Date(p.month + "-01");
          const monthName = date.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          });
          return `
            <circle cx="${p.x}" cy="${p.y}" r="5" fill="#18181b" stroke="${accentColor}" stroke-width="2"
              style="cursor: pointer; transition: r 0.15s, stroke-width 0.15s"
              onmouseenter="showChartTooltip(event, ${p.count}, '${monthName}')"
              onmouseleave="hideChartTooltip(event)"
            />
          `;
        })
        .join("");

      return `<svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${accentColor}" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="${accentColor}" stop-opacity="0.02"/>
          </linearGradient>
        </defs>
        ${yLabelsHtml}
        <path d="${areaPath}" fill="url(#areaGradient)"/>
        <path d="${linePath}" fill="none" stroke="${accentColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        ${dots}
        ${yearLabels}
        ${xLabels}
      </svg>`;
    },
  };
}
