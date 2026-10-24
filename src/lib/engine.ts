// Recommendation + "should I start this?" logic. Pure functions, shared by the app and the digest.
import type { BackloggdFile, Game, Seed } from "./types";
import type { Profile } from "./profiles";
import { tagLabel } from "./tags";

const DAY = 864e5;

// Tags that say little about taste on their own.
const WEAK = new Set(["action", "adventure", "co-op", "local-multiplayer", "online-co-op", "colorful", "great-soundtrack", "short", "female-protagonist", "early-access"]);

export interface BacklogStatus {
  played: boolean;
  playing: boolean;
  backlog: boolean;
  wishlist: boolean;
  rating: number | null;
}

export function backlogIndex(bl: BackloggdFile | null) {
  const map = new Map<number, BacklogStatus>();
  if (!bl) return map;
  const get = (id: number) => {
    let s = map.get(id);
    if (!s) map.set(id, (s = { played: false, playing: false, backlog: false, wishlist: false, rating: null }));
    return s;
  };
  for (const e of bl.lists.played) Object.assign(get(e.igdbId), { played: true, rating: e.rating });
  for (const e of bl.lists.playing) Object.assign(get(e.igdbId), { playing: true, rating: e.rating ?? get(e.igdbId).rating });
  for (const e of bl.lists.backlog) get(e.igdbId).backlog = true;
  for (const e of bl.lists.wishlist) get(e.igdbId).wishlist = true;
  return map;
}

/** Does this game fit how the profile plays at all? */
export function eligible(g: Game, p: Profile, players = p.players): { ok: boolean; why?: string } {
  if (p.dealbreakers.some((t) => g.tags.includes(t))) return { ok: false, why: "dealbreaker" };
  if (g.igdb && p.skip?.includes(g.igdb.slug)) return { ok: false, why: "skipped" };
  switch (p.kind) {
    case "couch":
    case "party": {
      if (!g.platforms.console) return { ok: false, why: "not on console" };
      if (g.couch.supported !== true) return { ok: false, why: "no local play" };
      if ((g.couch.max ?? 2) < players) return { ok: false, why: `max ${g.couch.max} players` };
      if (p.coopOnly && g.couch.coop === false) return { ok: false, why: "versus only" };
      return { ok: true };
    }
    case "online":
      if (!g.online.coop && !g.online.pvp) return { ok: false, why: "no online play" };
      return { ok: true };
    case "solo":
      if (!g.singlePlayer && (g.tags.includes("online-only") || g.tags.includes("mmo") || g.online.pvp)) return { ok: false, why: "multiplayer only" };
      if (!g.singlePlayer && !g.tags.length) return { ok: false, why: "unknown" };
      return { ok: true };
  }
}

export interface Match {
  score: number; // 0-100
  label: "Great match" | "Good match" | "Worth a look" | "Probably not";
  likeFavorites: string[]; // favorite titles it resembles
  sharedTags: string[];
  cautions: string[];
  backlog?: BacklogStatus;
  reason: string; // one plain sentence
}

export function seedsFor(p: Profile, seeds: Record<string, Seed>, bl: BackloggdFile | null): { seed: Seed; weight: number }[] {
  const out: { seed: Seed; weight: number }[] = [];
  for (const f of p.favorites) {
    const s = f.slug ? seeds[f.slug] : Object.values(seeds).find((x) => x.title.toLowerCase() === f.title.toLowerCase());
    if (s) out.push({ seed: { ...s, title: f.title }, weight: 1 });
  }
  // Dan's own top-rated Backloggd games sharpen his solo profile.
  if (p.useBackloggd && p.kind === "solo" && bl) {
    const have = new Set(out.map((x) => x.seed.igdbId));
    for (const e of bl.lists.played) {
      if ((e.rating ?? 0) < 9 || have.has(e.igdbId)) continue;
      const s = Object.values(seeds).find((x) => x.igdbId === e.igdbId);
      if (s) out.push({ seed: s, weight: 0.6 });
    }
  }
  return out;
}

export function scoreGame(g: Game, p: Profile, seeds: { seed: Seed; weight: number }[], blIndex?: Map<number, BacklogStatus>): Match {
  const tags = new Set(g.tags);
  // 1. Stated likes and dislikes
  let taste = 0;
  const liked: [string, number][] = [];
  for (const [t, w] of Object.entries(p.likes)) if (tags.has(t)) (taste += w, liked.push([t, w]));
  const cautions: string[] = [];
  let worstAvoid = 0;
  for (const [t, w] of Object.entries(p.avoid)) {
    if (!tags.has(t)) continue;
    worstAvoid = Math.max(worstAvoid, w);
    taste -= w * 1.3;
    if (w >= 2) cautions.push(tagLabel(t));
  }
  const likeMax = Object.values(p.likes).sort((a, b) => b - a).slice(0, 6).reduce((a, b) => a + b, 0) || 1;
  const tasteScore = Math.max(-1, Math.min(1, taste / (likeMax * 0.6)));

  // 2. Resemblance to favorites
  const sims = seeds
    .map(({ seed, weight }) => {
      const st = seed.tags.filter((t) => !WEAK.has(t));
      const gt = g.tags.filter((t) => !WEAK.has(t));
      const inter = st.filter((t) => gt.includes(t));
      const union = new Set([...st, ...gt]).size || 1;
      let s = inter.length / union;
      const sameFranchise = seed.franchises.some((f) => g.franchises.includes(f)) || (seed.tags.includes("lego") && g.tags.includes("lego"));
      if (sameFranchise) s += 0.5;
      if (g.similarIgdb.includes(seed.igdbId)) s += 0.25;
      return { title: seed.title, s: s * weight, inter, sameFranchise, same: g.igdb?.id === seed.igdbId };
    })
    .filter((x) => !x.same)
    .sort((a, b) => b.s - a.s);
  const top = sims.slice(0, 3);
  const simScore = top.length ? Math.min(1, (top[0].s * 0.6 + (top[1]?.s ?? 0) * 0.25 + (top[2]?.s ?? 0) * 0.15) / 0.45) : 0;

  // 3. Quality signal (small)
  const q = quality(g);
  const qScore = q === null ? 0 : (q - 75) / 25;

  // 4. Extras
  let extra = 0;
  if (p.wantsEasyModes && g.adjustableDifficulty) extra += 0.3;
  const bl = g.igdb && blIndex ? blIndex.get(g.igdb.id) : undefined;
  if (bl?.wishlist || bl?.backlog) extra += 0.35;
  if (g.gamePreview) extra -= 0.2;

  const raw = 0.4 * tasteScore + 0.37 * simScore + 0.2 * qScore + 0.12 * extra;
  let score = Math.round(Math.max(0, Math.min(100, 50 + raw * 48)));
  // Don't call something a great match while warning about a strong dislike.
  if (worstAvoid >= 3) score = Math.min(score, 59);
  else if (worstAvoid >= 2) score = Math.min(score, 71);
  const label = score >= 72 ? "Great match" : score >= 60 ? "Good match" : score >= 48 ? "Worth a look" : "Probably not";

  const likeFavorites = top.filter((x) => x.s >= 0.22).slice(0, 2).map((x) => x.title);
  const sharedTags = [...new Set([...liked.sort((a, b) => b[1] - a[1]).map(([t]) => t), ...(top[0]?.inter ?? [])])].filter((t) => !WEAK.has(t)).slice(0, 4);

  return { score, label, likeFavorites, sharedTags, cautions, backlog: bl, reason: explain(g, p, likeFavorites, sharedTags, cautions, bl) };
}

/**
 * Labels are relative within a profile's eligible games, so "Great match" stays rare even when
 * a profile's tastes overlap with much of the catalog. The fixed floors still apply.
 */
export function relabel(ms: Match[]) {
  const sorted = ms.map((m) => m.score).sort((a, b) => b - a);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 100;
  const great = Math.max(72, at(0.08));
  const good = Math.max(60, at(0.25));
  const maybe = Math.max(48, at(0.5));
  for (const m of ms) m.label = m.score >= great ? "Great match" : m.score >= good ? "Good match" : m.score >= maybe ? "Worth a look" : "Probably not";
}

function explain(g: Game, p: Profile, favs: string[], shared: string[], cautions: string[], bl?: BacklogStatus) {
  const parts: string[] = [];
  const traits = shared.map((t) => tagLabel(t).toLowerCase());
  if (favs.length && traits.length) parts.push(`Shares ${list(traits.slice(0, 3))} with ${list(favs)}.`);
  else if (favs.length) parts.push(`In the same vein as ${list(favs)}.`);
  else if (traits.length) parts.push(`Hits ${list(traits.slice(0, 3))}, which you like.`);
  else parts.push("Few overlaps with your favorites.");
  if ((p.kind === "couch" || p.kind === "party") && g.couch.max) parts.push(`Up to ${g.couch.max} on one console${g.couch.splitScreen ? " (split-screen)" : ""}.`);
  if (p.wantsEasyModes && g.adjustableDifficulty) parts.push("Has adjustable difficulty.");
  if (bl?.wishlist) parts.push("It's on your Backloggd wishlist.");
  else if (bl?.backlog) parts.push("It's on your Backloggd backlog.");
  if (cautions.length) parts.push(`Heads up: ${list(cautions.map((c) => c.toLowerCase()))}.`);
  return parts.join(" ");
}

const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1]);

/** 0-100 blend of critic and Steam user scores, or null when there isn't enough data. */
export function quality(g: Game): number | null {
  const vals: number[] = [];
  if (g.igdb?.criticScore && g.igdb.criticCount >= 3) vals.push(g.igdb.criticScore);
  const st = steamScore(g);
  if (st && st.total >= 200) vals.push(st.pct);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

export function steamScore(g: Game): { pct: number; total: number; label: string } | null {
  if (!g.steam) return null;
  const total = g.steam.positive + g.steam.negative;
  if (total < 20) return null;
  const pct = Math.round((100 * g.steam.positive) / total);
  const label =
    pct >= 95 && total >= 500 ? "Overwhelmingly Positive" : pct >= 80 ? (total >= 50 ? "Very Positive" : "Positive") : pct >= 70 ? "Mostly Positive" : pct >= 40 ? "Mixed" : pct >= 20 ? "Mostly Negative" : "Negative";
  return { pct, total, label };
}

// ---------- Leaving soon ----------

export type VerdictKind = "comfortable" | "tight" | "dont" | "unknown" | "endless" | "nodeadline";
export interface Verdict {
  kind: VerdictKind;
  headline: string;
  detail: string;
  daysLeft: number;
  hoursAvailable: number;
  hoursNeeded: number | null;
  perWeekNeeded: number | null;
}

const ENDLESS = new Set(["sandbox", "mmo", "battle-royale", "sports", "party", "pvp"]);

export function daysUntil(iso: string | null, now = Date.now()) {
  return iso ? Math.max(0, Math.ceil((Date.parse(iso) - now) / DAY)) : null;
}

export function verdict(g: Game, pace: number, goal: "main" | "complete" = "main", now = Date.now()): Verdict {
  const daysLeft = daysUntil(g.exitDate, now) ?? 0;
  const hoursAvailable = Math.round(((daysLeft / 7) * pace) * 10) / 10;
  const need = goal === "complete" ? g.ttb?.complete ?? g.ttb?.main ?? null : g.ttb?.main ?? null;
  const base = { daysLeft, hoursAvailable, hoursNeeded: need };
  if (!need) {
    if (g.tags.some((t) => ENDLESS.has(t)))
      return { ...base, kind: "endless", perWeekNeeded: null, headline: "No ending to race", detail: "This is a play-whenever game. Enjoy it while it's here." };
    return { ...base, kind: "unknown", perWeekNeeded: null, headline: "Length unknown", detail: "No reliable time-to-beat data. Check HowLongToBeat before starting." };
  }
  // Not announced as leaving: there's no deadline to race, just how long it'll take.
  if (!g.exitDate) {
    const weeks = Math.ceil(need / Math.max(pace, 1));
    return { ...base, kind: "nodeadline", perWeekNeeded: null, headline: "No rush", detail: `Not announced as leaving, so there's no deadline. About ${fmtH(need)} to finish, roughly ${weeks} ${weeks === 1 ? "week" : "weeks"} at your pace.` };
  }
  const perWeekNeeded = daysLeft > 0 ? Math.round((need / (daysLeft / 7)) * 10) / 10 : Infinity;
  const ratio = hoursAvailable / need;
  if (ratio >= 1.4)
    return { ...base, kind: "comfortable", perWeekNeeded, headline: "You can comfortably finish this", detail: `About ${fmtH(need)} to finish; you'll have about ${fmtH(hoursAvailable)} at your pace.` };
  if (ratio >= 0.9)
    return { ...base, kind: "tight", perWeekNeeded, headline: "Tight", detail: `About ${fmtH(need)} to finish and about ${fmtH(hoursAvailable)} at your pace. Doable if you prioritize it (${fmtH(perWeekNeeded)}/week).` };
  return {
    ...base,
    kind: "dont",
    perWeekNeeded,
    headline: "Don't start it",
    detail: `About ${fmtH(need)} to finish, but only about ${fmtH(hoursAvailable)} at your pace. You'd need ${fmtH(perWeekNeeded)}/week.`,
  };
}

export const fmtH = (h: number) => (!isFinite(h) ? "∞" : h < 1 ? `${Math.round(h * 60)} min` : `${Math.round(h * 10) / 10} h`.replace(".0 h", " h"));
