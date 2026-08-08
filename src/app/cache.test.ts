import { describe, expect, test } from "bun:test";
import {
  DASHBOARD_CACHE_MAX_AGE_MS,
  DASHBOARD_CACHE_STORAGE_KEY,
  getDashboardCacheKey,
  getDashboardSourceKey,
  loadDashboardCache,
  saveDashboardCache,
} from "./cache";

class MemoryStorage {
  values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

const identity = {
  username: "Sample-Developer",
  useLocalFile: false,
  selectedPreset: "3m",
  customDateFrom: null,
  customDateTo: null,
};

describe("dashboard cache identity", () => {
  test("normalizes GitHub usernames without including credentials", () => {
    expect(getDashboardSourceKey(identity)).toBe("github:sample-developer");
    expect(getDashboardCacheKey(identity)).toBe("1|github:sample-developer|3m|");
  });

  test("keys custom ranges by calendar date", () => {
    const first = getDashboardCacheKey({
      ...identity,
      selectedPreset: "custom",
      customDateFrom: new Date(2026, 0, 1),
      customDateTo: new Date(2026, 1, 1),
    });
    const second = getDashboardCacheKey({
      ...identity,
      selectedPreset: "custom",
      customDateFrom: new Date(2026, 0, 1),
      customDateTo: new Date(2026, 2, 1),
    });

    expect(first).toContain("2026-01-01:2026-02-01");
    expect(first).not.toBe(second);
  });

  test("uses one source for local fixture data regardless of username", () => {
    expect(getDashboardSourceKey({ username: "one", useLocalFile: true })).toBe("local-file");
    expect(getDashboardSourceKey({ username: "two", useLocalFile: true })).toBe("local-file");
  });
});

describe("dashboard cache storage", () => {
  const isData = (value: unknown): value is { total: number } =>
    Boolean(value && typeof value === "object" && typeof (value as { total?: unknown }).total === "number");

  test("round-trips a valid entry", () => {
    const storage = new MemoryStorage();
    const key = getDashboardCacheKey(identity);

    expect(saveDashboardCache(storage, key, "github:sample-developer", { total: 42 }, "avatar", 1_000)).toBe(true);
    expect(loadDashboardCache(storage, key, isData, 2_000)).toEqual({
      sourceKey: "github:sample-developer",
      savedAt: 1_000,
      avatarUrl: "avatar",
      data: { total: 42 },
    });
  });

  test("ignores entries for another range without deleting them", () => {
    const storage = new MemoryStorage();
    const key = getDashboardCacheKey(identity);
    saveDashboardCache(storage, key, "github:sample-developer", { total: 42 }, "", 1_000);

    expect(loadDashboardCache(storage, `${key}-other`, isData, 2_000)).toBeNull();
    expect(storage.getItem(DASHBOARD_CACHE_STORAGE_KEY)).not.toBeNull();
  });

  test("expires and removes old entries", () => {
    const storage = new MemoryStorage();
    const key = getDashboardCacheKey(identity);
    saveDashboardCache(storage, key, "github:sample-developer", { total: 42 }, "", 1_000);

    expect(loadDashboardCache(storage, key, isData, 1_000 + DASHBOARD_CACHE_MAX_AGE_MS + 1)).toBeNull();
    expect(storage.getItem(DASHBOARD_CACHE_STORAGE_KEY)).toBeNull();
  });

  test("removes corrupt or invalid entries", () => {
    const storage = new MemoryStorage();
    storage.setItem(DASHBOARD_CACHE_STORAGE_KEY, JSON.stringify({ data: "invalid" }));

    expect(loadDashboardCache(storage, getDashboardCacheKey(identity), isData)).toBeNull();
    expect(storage.getItem(DASHBOARD_CACHE_STORAGE_KEY)).toBeNull();
  });
});
