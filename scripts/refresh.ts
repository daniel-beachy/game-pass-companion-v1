// Nightly data refresh: Game Pass catalog + IGDB + Steam -> public/data/catalog.json
import { fetchAllLists, fetchProducts, img, attrMax, PASS_EA_PLAY } from "./lib/microsoft.ts";
import { igdbEnabled, mapStoreIds, searchByTitle, fetchGames, fetchTimeToBeat, XBOX_PLATFORMS } from "./lib/igdb.ts";
import { steamInfo, saveSteamCache, STEAM_CAT, type SteamInfo } from "./lib/steam.ts";
import { Cache, loadEnv, normTitle, readJson, writeJson } from "./lib/util.ts";
import { canonicalTags } from "../src/lib/tags.ts";
import { DEFAULT_PROFILES } from "../src/lib/profiles.ts";
import type { BackloggdFile, CatalogFile, CouchInfo, Game, Seed } from "../src/lib/types.ts";

loadEnv();
const warnings: string[] = [];
const now = Date.now();
const DAY = 864e5;

interface Override {
  title?: string;
  couch?: { supported: boolean; max?: number; splitScreen?: boolean; coop?: boolean; note?: string };
  ttb?: { main: number; complete?: number };
  addTags?: string[];
  removeTags?: string[];
}
const overrides = readJson<Record<string, Override>>("data/overrides.json", {});
const overrideFor = (id: string, title: string) => overrides[id] ?? overrides[normTitle(title)];

async function main() {
  console.log("Fetching Game Pass lists…");
  const lists = await fetchAllLists();
  const inList = (name: keyof typeof lists) => new Set(lists[name]);
  const consoleSet = new Set([...lists.console, ...lists.eaConsole, ...lists.comingConsole, ...lists.leavingConsole, ...lists.recentConsole]);
  const pcSet = new Set([...lists.pc, ...lists.pcAll, ...lists.eaPc, ...lists.comingPc, ...lists.leavingPc, ...lists.recentPc]);
  const cloudSet = inList("cloud");
  const eaSet = new Set([...lists.eaConsole, ...lists.eaPc]);
  const leavingSet = new Set([...lists.leavingConsole, ...lists.leavingPc]);
  const comingSet = new Set([...lists.comingConsole, ...lists.comingPc]);
  const allIds = [...new Set([...consoleSet, ...pcSet, ...cloudSet])];
  console.log(`  ${allIds.length} products`);

  console.log("Fetching product details…");
  const products = await fetchProducts(allIds);

  // ---------- IGDB ----------
  const igdbIdByStore: Record<string, number> = {};
  const igdbGames: Record<number, any> = {};
  let ttb: Record<number, any> = {};
  const titleCache = new Cache<number | null>("data/cache/igdb-title-matches.json");
  if (igdbEnabled()) {
    console.log("Matching with IGDB…");
    Object.assign(igdbIdByStore, await mapStoreIds(allIds));
    for (const id of allIds) {
      if (igdbIdByStore[id] || !products[id]) continue;
      const title = products[id].ProductTitle as string;
      const key = normTitle(title);
      let hit = titleCache.get(key, 30);
      if (hit === undefined) {
        const results = await searchByTitle(key);
        hit = results.find((r) => normTitle(r.name) === key)?.id ?? null;
        titleCache.set(key, hit);
      }
      if (hit) igdbIdByStore[id] = hit;
    }
    titleCache.save();
    const ids = [...new Set(Object.values(igdbIdByStore))];
    for (const g of await fetchGames(ids)) igdbGames[g.id] = g;
    ttb = await fetchTimeToBeat(ids);
    console.log(`  matched ${Object.keys(igdbIdByStore).length}/${allIds.length}`);
  } else {
    warnings.push("IGDB credentials missing: no time-to-beat, critic scores, or IGDB co-op data this run.");
  }

  // ---------- Steam ----------
  console.log("Fetching Steam data (cached)…");
  const steamByIgdb: Record<number, { appId: number; info: SteamInfo | null }> = {};
  let fetched = 0;
  for (const g of Object.values(igdbGames)) {
    const ext = (g.external_games ?? []).find((e: any) => e.external_game_source === 1 && /^\d+$/.test(e.uid));
    if (!ext) continue;
    const appId = Number(ext.uid);
    steamByIgdb[g.id] = { appId, info: await steamInfo(appId) };
    if (++fetched % 50 === 0) {
      console.log(`  ${fetched} steam apps`);
      saveSteamCache();
    }
  }
  saveSteamCache();

  // ---------- Build games ----------
  const games: Game[] = [];
  for (const id of allIds) {
    const p = products[id];
    if (!p) continue;
    const g = buildGame(id, p, {
      console: consoleSet.has(id),
      pc: pcSet.has(id),
      cloud: cloudSet.has(id),
      ea: eaSet.has(id),
      leavingList: leavingSet.has(id),
      comingList: comingSet.has(id),
      igdb: igdbGames[igdbIdByStore[id]],
      ttb: ttb[igdbIdByStore[id]],
      steam: steamByIgdb[igdbIdByStore[id]],
    });
    if (g) games.push(g);
  }
  const deduped = dedupe(games);

  // ---------- Taste seeds: profile favorites + Dan's highly rated Backloggd games ----------
  const seeds = await buildSeeds();

  const history = readJson<Record<string, { firstSeen: string }>>("data/history.json", {});
  for (const g of deduped) history[g.id] ??= { firstSeen: new Date().toISOString() };
  writeJson("data/history.json", history);

  const out: CatalogFile = {
    generatedAt: new Date().toISOString(),
    games: deduped.sort((a, b) => a.title.localeCompare(b.title)),
    seeds,
    stats: {
      games: deduped.length,
      coming: deduped.filter((g) => g.status === "coming").length,
      leaving: deduped.filter((g) => g.status === "leaving").length,
      couch: deduped.filter((g) => g.couch.supported).length,
      withTimeToBeat: deduped.filter((g) => g.ttb?.main).length,
      matchedIgdb: deduped.filter((g) => g.igdb).length,
      onSteam: deduped.filter((g) => g.steam).length,
    },
    warnings,
  };
  writeJson("public/data/catalog.json", out);
  console.log("Done.", out.stats);
  if (warnings.length) console.log("Warnings:\n  " + warnings.join("\n  "));
}

function buildGame(
  id: string,
  p: any,
  ctx: { console: boolean; pc: boolean; cloud: boolean; ea: boolean; leavingList: boolean; comingList: boolean; igdb?: any; ttb?: any; steam?: { appId: number; info: SteamInfo | null } },
): Game | null {
  if (p.ProductType && p.ProductType !== "Game") return null;
  const title: string = p.ProductTitle;
  const passes: Record<string, { EntryDateUTC?: string; ExitDateUTC?: string }> = p.PassMetadataByPassProductId ?? {};
  const entries = Object.values(passes).map((x) => x.EntryDateUTC).filter(Boolean) as string[];
  const exits = Object.values(passes).map((x) => x.ExitDateUTC).filter(Boolean) as string[];
  const entryDate = entries.sort()[0] ?? null;
  // A game leaves Ultimate only when every pass it's in has an exit date.
  const allExit = Object.keys(passes).length > 0 && exits.length === Object.keys(passes).length;
  const exitDate = allExit ? exits.sort().reverse()[0] : null;
  if (exitDate && Date.parse(exitDate) < now) return null; // already gone

  let status: Game["status"] = "available";
  if (entryDate && Date.parse(entryDate) > now) status = "coming";
  else if (ctx.comingList && !entryDate) status = "coming";
  else if (exitDate || ctx.leavingList) status = "leaving";

  const attrs: { Name: string; LocalizedName: string }[] = p.Attributes ?? [];
  const attr = (n: string) => attrs.find((a) => a.Name === n);
  const platforms = p.AvailablePlatforms ?? [];

  const igdb = ctx.igdb;
  const steam = ctx.steam?.info ?? null;
  const ov = overrideFor(id, title);

  const rawTags = [
    ...(p.Categories ?? []),
    ...(igdb?.genres ?? []).map((x: any) => x.name),
    ...(igdb?.themes ?? []).map((x: any) => x.name),
    ...(igdb?.keywords ?? []).slice(0, 40).map((x: any) => x.name),
    ...(steam?.tags ?? []),
  ];
  const franchises = [...(igdb?.franchises ?? []), ...(igdb?.collections ?? [])].map((x: any) => x.name as string);
  let tags = canonicalTags([...rawTags, ...franchises]);
  if (/\(game preview\)/i.test(title)) tags.push("early-access");
  if (ov?.addTags) tags.push(...ov.addTags);
  if (ov?.removeTags) tags = tags.filter((t) => !ov.removeTags!.includes(t));

  const couch = buildCouch(attrs, igdb, steam, ov);
  if (couch.supported) {
    tags.push("local-multiplayer");
    if (couch.coop) tags.push("local-co-op");
    if (couch.splitScreen) tags.push("split-screen");
  }
  const onlineCoop = Boolean(attr("XblOnlineCoop")) || Boolean(steam?.categories.includes(STEAM_CAT.onlineCoop));
  if (onlineCoop) tags.push("online-co-op", "co-op");

  const t = ctx.ttb;
  const hours = (s?: number) => (s ? Math.round((s / 3600) * 10) / 10 : null);
  const ttbOut: Game["ttb"] = ov?.ttb
    ? { main: ov.ttb.main, extra: null, complete: ov.ttb.complete ?? null, count: 0, source: "Hand-checked" }
    : t && (t.normally || t.hastily)
      ? { main: hours(t.normally ?? t.hastily), extra: hours(t.hastily), complete: hours(t.completely), count: t.count ?? 0, source: "IGDB" }
      : null;
  if (ttbOut?.main && ttbOut.main <= 5) tags.push("short");

  const accessibility: string[] = [];
  let adjustableDifficulty = false;
  for (const group of Object.values(p.AccessibilityFeatures ?? {})) {
    if (!group || typeof group !== "object") continue;
    for (const [k, v] of Object.entries(group as Record<string, any>)) {
      if (k === "AdjustableDifficulty") adjustableDifficulty = true;
      if (v?.Tag) accessibility.push(v.Tag);
    }
  }

  const price = p.AnonymousPrice?.MSRP?.value
    ? { msrp: p.AnonymousPrice.MSRP.value, sale: p.AnonymousPrice.SalePrice?.value ?? null }
    : null;

  return {
    id,
    title: title.replace(/[™®]/g, "").trim(),
    developer: p.DeveloperName ?? "",
    publisher: p.PublisherName ?? "",
    description: (p.ProductDescriptionShort && p.ProductDescriptionShort.length > 40 ? p.ProductDescriptionShort : p.ProductDescription ?? "").slice(0, 600),
    releaseDate: p.OriginalReleaseDate ?? null,
    images: { poster: img(p.Image_Poster), hero: img(p.Image_Hero), tile: img(p.Image_Tile), titledHero: img(p.Image_TitledHero) },
    screenshots: (p.Screenshots ?? []).slice(0, 4).map((s: any) => img(s)).filter(Boolean),
    trailerPreview: p.Trailers?.[0]?.PreviewImageURL ?? null,
    platforms: {
      console: ctx.console,
      pc: ctx.pc || platforms.includes("PC"),
      cloud: ctx.cloud || platforms.includes("XCloud"),
      handheld: platforms.includes("Handheld"),
    },
    catalogs: [
      "gamepass",
      ...(ctx.ea || PASS_EA_PLAY in passes ? (["eaplay"] as const) : []),
      ...(/ubisoft/i.test(p.PublisherName ?? "") ? (["ubisoft"] as const) : []),
    ],
    entryDate,
    exitDate,
    status,
    gamePreview: /game preview/i.test(title),
    price,
    categories: p.Categories ?? [],
    couch,
    online: {
      coop: onlineCoop,
      coopMax: attr("XblOnlineCoop") ? attrMax(attr("XblOnlineCoop")!.LocalizedName) : null,
      pvp: Boolean(attr("XblOnlineMultiPlayer")) || Boolean(steam?.categories.includes(STEAM_CAT.onlinePvp)),
      crossPlatform: Boolean(attr("XblCrossPlatformCoop") || attr("XblCrossPlatformMultiPlayer")),
    },
    singlePlayer: Boolean(attr("SinglePlayer")) || Boolean(steam?.categories.includes(STEAM_CAT.singlePlayer)),
    accessibility: [...new Set(accessibility)],
    adjustableDifficulty,
    igdb: igdb
      ? {
          id: igdb.id,
          slug: igdb.slug,
          criticScore: igdb.aggregated_rating ? Math.round(igdb.aggregated_rating) : null,
          criticCount: igdb.aggregated_rating_count ?? 0,
          userScore: igdb.rating && (igdb.rating_count ?? 0) >= 10 ? Math.round(igdb.rating) : null,
        }
      : null,
    ttb: ttbOut,
    steam: ctx.steam ? { appId: ctx.steam.appId, positive: steam?.positive ?? 0, negative: steam?.negative ?? 0 } : null,
    tags: [...new Set(tags)],
    franchises,
    similarIgdb: (igdb?.similar_games ?? []).slice(0, 10),
    xcloudId: p.XCloudTitleId ?? null,
  };
}

function buildCouch(attrs: { Name: string; LocalizedName: string }[], igdb: any, steam: SteamInfo | null, ov?: Override): CouchInfo {
  const sources: CouchInfo["sources"] = [];
  const attr = (n: string) => attrs.find((a) => a.Name === n);

  if (ov?.couch) {
    const c = ov.couch;
    sources.push({ name: "Hand-checked", says: c.supported ? `Yes, up to ${c.max ?? "?"} players${c.splitScreen ? ", split-screen" : ""}` : "No local play on one console" });
    return { supported: c.supported, max: c.max ?? null, splitScreen: c.splitScreen ?? null, coop: c.coop ?? c.supported, confidence: "verified", sources, note: c.note };
  }

  // Xbox store
  const msCoop = attr("XblLocalCoop");
  const msMp = attr("XblLocalMultiPlayer");
  const msShared = attr("SharedSplitScreen");
  const msYes = Boolean(msCoop || msMp || msShared);
  const msMax = Math.max(msCoop ? attrMax(msCoop.LocalizedName) ?? 0 : 0, msMp ? attrMax(msMp.LocalizedName) ?? 0 : 0) || null;
  if (msYes) sources.push({ name: "Xbox store", says: `Local ${msCoop ? "co-op" : "multiplayer"}${msMax ? ` up to ${msMax}` : ""}${msShared ? ", shared/split screen" : ""}` });

  // IGDB: prefer Xbox platform rows
  let igYes: boolean | null = null;
  let igMax: number | null = null;
  let igCoop: boolean | null = null;
  let igSplit: boolean | null = null;
  const modes: any[] = igdb?.multiplayer_modes ?? [];
  const rows = modes.some((m) => XBOX_PLATFORMS.has(m.platform)) ? modes.filter((m) => XBOX_PLATFORMS.has(m.platform)) : modes;
  if (rows.length) {
    igCoop = rows.some((m) => m.offlinecoop);
    const offMax = Math.max(0, ...rows.map((m) => Math.max(m.offlinecoopmax ?? 0, m.offlinemax ?? 0)));
    igSplit = rows.some((m) => m.splitscreen);
    igYes = igCoop || offMax > 1 || igSplit;
    igMax = offMax > 1 ? offMax : null;
    sources.push({ name: "IGDB", says: igYes ? `Local ${igCoop ? "co-op" : "multiplayer"}${igMax ? ` up to ${igMax}` : ""}${igSplit ? ", split-screen" : ""}` : "No local multiplayer listed" });
  } else if ((igdb?.game_modes ?? []).some((m: any) => m.name === "Split screen")) {
    igYes = true;
    igSplit = true;
    sources.push({ name: "IGDB", says: "Split-screen mode" });
  }

  // Steam (PC version)
  let stYes: boolean | null = null;
  let stCoop = false;
  if (steam) {
    const c = steam.categories;
    stCoop = c.includes(STEAM_CAT.sharedSplitCoop);
    stYes = stCoop || c.includes(STEAM_CAT.sharedSplit) || c.includes(STEAM_CAT.sharedSplitPvp);
    if (c.length) sources.push({ name: "Steam", says: stYes ? `Shared/split screen ${stCoop ? "co-op" : c.includes(STEAM_CAT.sharedSplitPvp) ? "versus" : ""}`.trim() : "No shared/split screen listed" });
    else stYes = null;
  }

  const yes = [msYes || null, igYes, stYes].filter((x) => x === true).length;
  const no = [igYes, stYes].filter((x) => x === false).length; // the store's silence isn't a "no"
  let supported: boolean | null = null;
  let confidence: CouchInfo["confidence"] = "unknown";
  if (yes >= 2 && no === 0) [supported, confidence] = [true, "agree"];
  else if (yes >= 1 && no >= 1) [supported, confidence] = [true, "conflict"];
  else if (yes === 1) [supported, confidence] = [true, "single"];
  else if (no >= 1) [supported, confidence] = [false, no >= 2 ? "agree" : "single"];

  const max = msMax ?? igMax ?? (supported ? 2 : null);
  const coop = supported ? Boolean(msCoop) || Boolean(igCoop) || stCoop || null : supported === false ? false : null;
  return { supported, max, splitScreen: igSplit ?? (msShared ? true : null), coop, confidence, sources };
}

/** Same game listed twice (Xbox One + Series X|S, or PC + console SKUs): keep one, merge platforms. */
function dedupe(games: Game[]): Game[] {
  const byKey = new Map<string, Game>();
  for (const g of games) {
    const key = g.igdb ? `igdb:${g.igdb.id}` : `t:${normTitle(g.title)}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, g);
      continue;
    }
    const keep = /xbox one/i.test(prev.title) && !/xbox one/i.test(g.title) ? g : prev;
    const other = keep === prev ? g : prev;
    keep.platforms = {
      console: keep.platforms.console || other.platforms.console,
      pc: keep.platforms.pc || other.platforms.pc,
      cloud: keep.platforms.cloud || other.platforms.cloud,
      handheld: keep.platforms.handheld || other.platforms.handheld,
    };
    keep.title = keep.title.replace(/\s*(Xbox Series X\|S|Xbox One|for Windows( 10)?)\s*$/i, "").trim();
    byKey.set(key, keep);
  }
  return [...byKey.values()];
}

async function buildSeeds(): Promise<Record<string, Seed>> {
  if (!igdbEnabled()) return readJson<CatalogFile | null>("public/data/catalog.json", null)?.seeds ?? {};
  const bl = readJson<BackloggdFile | null>("data/backloggd.json", null);
  const slugs = new Set<string>();
  for (const p of DEFAULT_PROFILES) for (const f of p.favorites) if (f.slug) slugs.add(f.slug);
  const extraIds: number[] = [];
  if (bl) for (const e of [...bl.lists.played, ...bl.lists.playing]) if ((e.rating ?? 0) >= 8 || bl.lists.playing.includes(e)) extraIds.push(e.igdbId);

  const { igdb } = await import("./lib/igdb.ts");
  const { GAME_FIELDS } = await import("./lib/igdb.ts");
  const bySlug = await igdb<any>("games", `fields ${GAME_FIELDS}; where slug = (${[...slugs].map((s) => JSON.stringify(s)).join(",")}); limit 500;`);
  const byId = extraIds.length ? await igdb<any>("games", `fields ${GAME_FIELDS}; where id = (${extraIds.join(",")}); limit 500;`) : [];
  const out: Record<string, Seed> = {};
  for (const g of [...bySlug, ...byId]) {
    const steam = (g.external_games ?? []).find((e: any) => e.external_game_source === 1 && /^\d+$/.test(e.uid));
    const st = steam ? await steamInfo(Number(steam.uid)) : null;
    const franchises = [...(g.franchises ?? []), ...(g.collections ?? [])].map((x: any) => x.name);
    const tags = canonicalTags([...(g.genres ?? []).map((x: any) => x.name), ...(g.themes ?? []).map((x: any) => x.name), ...(g.keywords ?? []).slice(0, 40).map((x: any) => x.name), ...(st?.tags ?? []), ...franchises]);
    const modes: any[] = g.multiplayer_modes ?? [];
    if (modes.some((m) => m.offlinecoop)) tags.push("local-co-op", "local-multiplayer");
    if (modes.some((m) => m.splitscreen)) tags.push("split-screen");
    if (modes.some((m) => m.onlinecoop)) tags.push("online-co-op", "co-op");
    out[g.slug] = { igdbId: g.id, slug: g.slug, title: g.name, tags: [...new Set(tags)], franchises };
  }
  saveSteamCache();
  for (const s of slugs) if (!out[s]) warnings.push(`Favorite not found on IGDB: ${s}`);
  return out;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
