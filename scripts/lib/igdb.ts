import { chunk, sleep, UA } from "./util.ts";

let token: string | null = null;

export function igdbEnabled() {
  return Boolean(process.env.IGDB_CLIENT_ID && process.env.IGDB_CLIENT_SECRET);
}

async function auth() {
  if (token) return token;
  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${process.env.IGDB_CLIENT_ID}&client_secret=${process.env.IGDB_CLIENT_SECRET}&grant_type=client_credentials`,
    { method: "POST" },
  );
  if (!res.ok) throw new Error(`IGDB auth failed: ${res.status}`);
  token = (await res.json()).access_token;
  return token!;
}

export async function igdb<T = any>(endpoint: string, body: string): Promise<T[]> {
  for (let i = 0; i < 4; i++) {
    const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
      method: "POST",
      headers: { "Client-ID": process.env.IGDB_CLIENT_ID!, Authorization: `Bearer ${await auth()}`, "User-Agent": UA },
      body,
    });
    await sleep(300); // IGDB allows 4 requests per second
    if (res.status === 429) {
      await sleep(2000);
      continue;
    }
    if (!res.ok) throw new Error(`IGDB ${endpoint} ${res.status}: ${await res.text()}`);
    return (await res.json()) as T[];
  }
  throw new Error(`IGDB ${endpoint} rate limited`);
}

const q = (s: string) => JSON.stringify(s);

/** Microsoft Store id -> IGDB game id, via IGDB's own store links. */
export async function mapStoreIds(storeIds: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const batch of chunk(storeIds, 200)) {
    const rows = await igdb<{ uid: string; game: number }>(
      "external_games",
      `fields uid,game; where external_game_source = (11,31,54) & uid = (${batch.map(q).join(",")}); limit 500;`,
    );
    for (const r of rows) if (r.game) out[r.uid] ??= r.game;
  }
  return out;
}

export async function searchByTitle(title: string): Promise<{ id: number; name: string }[]> {
  return igdb("games", `search ${q(title)}; fields id,name; where version_parent = null; limit 5;`);
}

export const GAME_FIELDS = [
  "name", "slug", "aggregated_rating", "aggregated_rating_count", "rating", "rating_count",
  "genres.name", "themes.name", "game_modes.name", "player_perspectives.name", "keywords.name",
  "franchises.name", "collections.name", "similar_games",
  "multiplayer_modes.offlinecoop", "multiplayer_modes.offlinecoopmax", "multiplayer_modes.offlinemax",
  "multiplayer_modes.splitscreen", "multiplayer_modes.onlinecoop", "multiplayer_modes.onlinecoopmax",
  "multiplayer_modes.platform", "multiplayer_modes.campaigncoop",
  "external_games.uid", "external_games.external_game_source",
].join(",");

export async function fetchGames(ids: number[]): Promise<any[]> {
  const out: any[] = [];
  for (const batch of chunk(ids, 200)) {
    out.push(...(await igdb("games", `fields ${GAME_FIELDS}; where id = (${batch.join(",")}); limit 500;`)));
  }
  return out;
}

export async function fetchTimeToBeat(ids: number[]): Promise<Record<number, any>> {
  const out: Record<number, any> = {};
  for (const batch of chunk(ids, 400)) {
    const rows = await igdb<any>("game_time_to_beats", `fields game_id,hastily,normally,completely,count; where game_id = (${batch.join(",")}); limit 500;`);
    for (const r of rows) out[r.game_id] = r;
  }
  return out;
}

// IGDB platform ids for Xbox consoles; multiplayer_modes rows are per platform.
export const XBOX_PLATFORMS = new Set([49, 169, 12, 11]); // Xbox One, Series X|S, 360, Xbox
