export const DASHBOARD_CACHE_STORAGE_KEY = "github-dashboard-data-cache-v1";
export const DASHBOARD_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const DASHBOARD_CACHE_MAX_ENTRIES = 5;

const DASHBOARD_CACHE_VERSION = 2;

export interface DashboardCacheIdentity {
  username: string;
  useLocalFile: boolean;
  selectedPreset: string;
  customDateFrom: Date | null;
  customDateTo: Date | null;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface StoredDashboardEntry<T> {
  cacheKey: string;
  sourceKey: string;
  savedAt: number;
  avatarUrl: string;
  data: T;
}

interface StoredDashboardCache<T> {
  version: number;
  entries: StoredDashboardEntry<T>[];
}

export interface DashboardCacheValue<T> {
  sourceKey: string;
  savedAt: number;
  avatarUrl: string;
  data: T;
}

function calendarDateKey(date: Date | null) {
  if (!date || Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDashboardSourceKey(identity: Pick<DashboardCacheIdentity, "username" | "useLocalFile">) {
  return identity.useLocalFile ? "local-file" : `github:${identity.username.trim().toLowerCase()}`;
}

export function getDashboardCacheKey(identity: DashboardCacheIdentity) {
  const customRange =
    identity.selectedPreset === "custom"
      ? `${calendarDateKey(identity.customDateFrom)}:${calendarDateKey(identity.customDateTo)}`
      : "";
  return [DASHBOARD_CACHE_VERSION, getDashboardSourceKey(identity), identity.selectedPreset, customRange].join("|");
}

function removeInvalidCache(storage: StorageLike) {
  try {
    storage.removeItem(DASHBOARD_CACHE_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

function isValidEntry(value: unknown): value is StoredDashboardEntry<unknown> {
  const entry = value as Partial<StoredDashboardEntry<unknown>> | null;
  return Boolean(
    entry &&
    typeof entry === "object" &&
    typeof entry.cacheKey === "string" &&
    typeof entry.sourceKey === "string" &&
    typeof entry.savedAt === "number" &&
    typeof entry.avatarUrl === "string",
  );
}

function readEntries(storage: StorageLike, now: number): StoredDashboardEntry<unknown>[] | null {
  const raw = storage.getItem(DASHBOARD_CACHE_STORAGE_KEY);
  if (!raw) return null;

  const cached = JSON.parse(raw) as Partial<StoredDashboardCache<unknown>>;
  if (cached.version !== DASHBOARD_CACHE_VERSION || !Array.isArray(cached.entries)) {
    removeInvalidCache(storage);
    return null;
  }

  const entries = cached.entries.filter(isValidEntry);
  const fresh = entries.filter((entry) => now - entry.savedAt <= DASHBOARD_CACHE_MAX_AGE_MS);
  if (fresh.length !== cached.entries.length) {
    if (fresh.length === 0) removeInvalidCache(storage);
    else writeEntries(storage, fresh);
  }
  return fresh;
}

function writeEntries(storage: StorageLike, entries: StoredDashboardEntry<unknown>[]) {
  const cached: StoredDashboardCache<unknown> = { version: DASHBOARD_CACHE_VERSION, entries };
  storage.setItem(DASHBOARD_CACHE_STORAGE_KEY, JSON.stringify(cached));
}

export function loadDashboardCache<T>(
  storage: StorageLike,
  cacheKey: string,
  isValidData: (value: unknown) => value is T,
  now = Date.now(),
): DashboardCacheValue<T> | null {
  try {
    const entries = readEntries(storage, now);
    const entry = entries?.find((candidate) => candidate.cacheKey === cacheKey);
    if (!entry) return null;

    if (!isValidData(entry.data)) {
      writeEntries(
        storage,
        entries!.filter((candidate) => candidate !== entry),
      );
      return null;
    }

    return {
      sourceKey: entry.sourceKey,
      savedAt: entry.savedAt,
      avatarUrl: entry.avatarUrl,
      data: entry.data,
    };
  } catch {
    removeInvalidCache(storage);
    return null;
  }
}

export function saveDashboardCache<T>(
  storage: StorageLike,
  cacheKey: string,
  sourceKey: string,
  data: T,
  avatarUrl: string,
  savedAt = Date.now(),
) {
  const entry: StoredDashboardEntry<T> = { cacheKey, sourceKey, savedAt, avatarUrl, data };

  let existing: StoredDashboardEntry<unknown>[] = [];
  try {
    existing = readEntries(storage, savedAt) ?? [];
  } catch {
    removeInvalidCache(storage);
  }

  const entries = [entry as StoredDashboardEntry<unknown>, ...existing.filter((it) => it.cacheKey !== cacheKey)].slice(
    0,
    DASHBOARD_CACHE_MAX_ENTRIES,
  );

  try {
    writeEntries(storage, entries);
    return true;
  } catch {
    // Most likely a quota error: keep only the newest entry and try once more.
    try {
      writeEntries(storage, [entry as StoredDashboardEntry<unknown>]);
      return true;
    } catch {
      return false;
    }
  }
}
