import { Cache, fetchJson, sleep } from "./util.ts";

export interface SteamInfo {
  categories: number[];
  tags: string[];
  positive: number;
  negative: number;
}

// Steam store category ids
export const STEAM_CAT = {
  sharedSplit: 24,
  sharedSplitPvp: 37,
  sharedSplitCoop: 39,
  onlineCoop: 38,
  onlinePvp: 36,
  remotePlayTogether: 44,
  singlePlayer: 2,
};

const cache = new Cache<SteamInfo | null>("data/cache/steam.json");

/** Pulls categories from Steam's store API and community tags + review counts from SteamSpy. Cached ~30 days. */
export async function steamInfo(appId: number): Promise<SteamInfo | null> {
  const key = String(appId);
  const hit = cache.get(key, 30);
  if (hit !== undefined) return hit;
  let info: SteamInfo | null = null;
  try {
    const details = await fetchJson<any>(`https://store.steampowered.com/api/appdetails?appids=${appId}&cc=us&l=en&filters=categories`);
    await sleep(1600); // stay well under Steam's ~200 requests / 5 min
    const spy = await fetchJson<any>(`https://steamspy.com/api.php?request=appdetails&appid=${appId}`);
    await sleep(1100); // SteamSpy asks for 1 request per second
    const tags = spy?.tags && !Array.isArray(spy.tags) ? Object.entries(spy.tags as Record<string, number>).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([t]) => t) : [];
    info = {
      categories: (details?.[key]?.data?.categories ?? []).map((c: any) => c.id),
      tags,
      positive: spy?.positive ?? 0,
      negative: spy?.negative ?? 0,
    };
  } catch {
    return null; // try again next run
  }
  cache.set(key, info);
  return info;
}

export const saveSteamCache = () => cache.save();
