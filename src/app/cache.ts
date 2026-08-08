export const DASHBOARD_CACHE_STORAGE_KEY = "github-dashboard-data-cache-v1";
export const DASHBOARD_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const DASHBOARD_CACHE_VERSION = 1;

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

interface StoredDashboardCache<T> {
  version: number;
  cacheKey: string;
  sourceKey: string;
  savedAt: number;
  avatarUrl: string;
  data: T;
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

export function loadDashboardCache<T>(
  storage: StorageLike,
  cacheKey: string,
  isValidData: (value: unknown) => value is T,
  now = Date.now(),
): DashboardCacheValue<T> | null {
  try {
    const raw = storage.getItem(DASHBOARD_CACHE_STORAGE_KEY);
    if (!raw) return null;

    const cached = JSON.parse(raw) as Partial<StoredDashboardCache<unknown>>;
    if (
      cached.version !== DASHBOARD_CACHE_VERSION ||
      typeof cached.cacheKey !== "string" ||
      typeof cached.sourceKey !== "string" ||
      typeof cached.savedAt !== "number" ||
      typeof cached.avatarUrl !== "string" ||
      !isValidData(cached.data)
    ) {
      removeInvalidCache(storage);
      return null;
    }

    if (now - cached.savedAt > DASHBOARD_CACHE_MAX_AGE_MS) {
      removeInvalidCache(storage);
      return null;
    }
    if (cached.cacheKey !== cacheKey) return null;

    return {
      sourceKey: cached.sourceKey,
      savedAt: cached.savedAt,
      avatarUrl: cached.avatarUrl,
      data: cached.data,
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
  try {
    const cached: StoredDashboardCache<T> = {
      version: DASHBOARD_CACHE_VERSION,
      cacheKey,
      sourceKey,
      savedAt,
      avatarUrl,
      data,
    };
    storage.setItem(DASHBOARD_CACHE_STORAGE_KEY, JSON.stringify(cached));
    return true;
  } catch {
    return false;
  }
}
