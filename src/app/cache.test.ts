import { describe, expect, test } from "bun:test";
import {
  DASHBOARD_CACHE_MAX_AGE_MS,
  DASHBOARD_CACHE_MAX_ENTRIES,
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
    expect(getDashboardCacheKey(identity)).toBe("2|github:sample-developer|3m|");
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

  test("keeps several ranges retrievable at once", () => {
    const storage = new MemoryStorage();
    saveDashboardCache(storage, "key-a", "github:sample-developer", { total: 1 }, "", 1_000);
    saveDashboardCache(storage, "key-b", "github:sample-developer", { total: 2 }, "", 1_000);

    expect(loadDashboardCache(storage, "key-a", isData, 2_000)?.data).toEqual({ total: 1 });
    expect(loadDashboardCache(storage, "key-b", isData, 2_000)?.data).toEqual({ total: 2 });
  });

  test("evicts the oldest entry beyond the cap", () => {
    const storage = new MemoryStorage();
    for (let index = 0; index < DASHBOARD_CACHE_MAX_ENTRIES + 1; index++) {
      saveDashboardCache(storage, `key-${index}`, "github:sample-developer", { total: index }, "", 1_000);
    }

    expect(loadDashboardCache(storage, "key-0", isData, 2_000)).toBeNull();
    expect(loadDashboardCache(storage, "key-1", isData, 2_000)?.data).toEqual({ total: 1 });
    expect(loadDashboardCache(storage, `key-${DASHBOARD_CACHE_MAX_ENTRIES}`, isData, 2_000)?.data).toEqual({
      total: DASHBOARD_CACHE_MAX_ENTRIES,
    });
  });

  test("discards payloads written by an older cache version", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      DASHBOARD_CACHE_STORAGE_KEY,
      JSON.stringify({ version: 1, cacheKey: "key-a", sourceKey: "s", savedAt: 1_000, avatarUrl: "", data: {} }),
    );

    expect(loadDashboardCache(storage, "key-a", isData, 2_000)).toBeNull();
    expect(storage.getItem(DASHBOARD_CACHE_STORAGE_KEY)).toBeNull();
  });

  test("removes corrupt or invalid entries", () => {
    const storage = new MemoryStorage();
    storage.setItem(DASHBOARD_CACHE_STORAGE_KEY, JSON.stringify({ data: "invalid" }));

    expect(loadDashboardCache(storage, getDashboardCacheKey(identity), isData)).toBeNull();
    expect(storage.getItem(DASHBOARD_CACHE_STORAGE_KEY)).toBeNull();
  });
});
