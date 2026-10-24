// Writes short "why this game" notes with Claude Code (Dan's Pro plan, via CLAUDE_CODE_OAUTH_TOKEN).
// Runs nightly and from the manual "Write Claude notes" workflow. Only games that rank well for a
// profile get one, each is written once, and Claude is only called when a note is missing or the
// game meaningfully changed (see `fingerprint`). Nightly runs are capped at 30 notes.
// `--status` just counts what's missing, with no Claude calls.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { DEFAULT_PROFILES, type Profile } from "../src/lib/profiles.ts";
import { backlogIndex, eligible, scoreGame, seedsFor } from "../src/lib/engine.ts";
import { tagLabel } from "../src/lib/tags.ts";
import type { BackloggdFile, BlurbFile, CatalogFile, Game } from "../src/lib/types.ts";
import { chunk, loadEnv, readJson, writeJson } from "./lib/util.ts";

loadEnv();
const MODEL = "claude-sonnet-5-5";
const PER_PROFILE = 30; // top matches per profile that get a note
const MAX_PER_RUN = Number(process.env.BLURB_LIMIT ?? 100);
const BATCH = 25;
const HASH_VERSION = 2;

const catalog = readJson<CatalogFile | null>("public/data/catalog.json", null);
const blurbs = readJson<BlurbFile & Record<string, { hash?: string }>>("public/data/blurbs.json", {});
const bl = readJson<BackloggdFile | null>("data/backloggd.json", null);

function cliAvailable() {
  const r = spawnSync("claude", ["--version"], { encoding: "utf8" });
  return r.status === 0;
}

function describe(g: Game, p: Profile, reason: string, cautions: string[]) {
  return {
    title: g.title,
    tags: g.tags.slice(0, 12).map(tagLabel),
    hoursMain: g.ttb?.main ?? null,
    hoursComplete: g.ttb?.complete ?? null,
    criticScore: g.igdb?.criticScore ? Math.round(g.igdb.criticScore) : null,
    steamPositive: g.steam && g.steam.positive + g.steam.negative >= 50 ? Math.round((100 * g.steam.positive) / (g.steam.positive + g.steam.negative)) + "%" : null,
    localPlay: p.kind === "couch" || p.kind === "party" ? (g.couch.supported ? `${g.couch.coop ? "co-op" : "versus"} up to ${g.couch.max ?? "?"}${g.couch.splitScreen ? ", split-screen" : ""} (${g.couch.confidence})` : "none") : undefined,
    adjustableDifficulty: g.adjustableDifficulty,
    leavingOn: g.status === "leaving" ? g.exitDate?.slice(0, 10) : undefined,
    storeDescription: g.description.slice(0, 500),
    matchedOn: reason,
    possibleConcerns: cautions,
  };
}

// What decides whether a note is out of date. Leaves out things that drift night to night (exact
// review percentages, ranking wording) so a note is only rewritten when the game really changed.
function fingerprint(g: Game, p: Profile, data: ReturnType<typeof describe>) {
  const band = (n: number | null | undefined, step: number) => (n == null ? null : Math.round(n / step) * step);
  const pos = g.steam && g.steam.positive + g.steam.negative >= 50 ? (100 * g.steam.positive) / (g.steam.positive + g.steam.negative) : null;
  const stable = {
    title: g.title,
    tags: [...data.tags].sort(),
    hours: band(g.ttb?.main, 5),
    critic: band(g.igdb?.criticScore, 10),
    steam: band(pos, 10),
    localPlay: data.localPlay,
    leaving: data.leavingOn ?? null,
    description: data.storeDescription.slice(0, 200),
    notes: p.notes,
  };
  return createHash("sha1").update(JSON.stringify(stable)).digest("hex").slice(0, 10);
}

function prompt(p: Profile, items: { key: string; data: unknown }[]) {
  return `You write one short note per game for a private Game Pass recommendation site.
The note is for this player profile:
${p.name} (${p.who}). ${p.description}
${p.notes}

For each game, write:
- "text": 1–2 plain sentences (max 45 words) on why it could suit this profile, tied to specific things they like. Be concrete about what you actually do in the game.
- "caveat": 1 sentence on the most likely reason it might not click for them, or null only if there's genuinely nothing.

Rules: be honest and grounded. Never hype ("masterpiece", "you'll love", "perfect"). Don't claim facts not supported by the data or well known about the game; if unsure, say less. Don't repeat the title or the numbers shown elsewhere. No emoji.

Reply with only a JSON array of objects {"key", "text", "caveat"}, one per game, same keys as given.

Games:
${JSON.stringify(items, null, 1)}`;
}

function ask(text: string): { key: string; text: string; caveat: string | null }[] {
  const r = spawnSync("claude", ["-p", "--model", MODEL, "--output-format", "json", "--max-turns", "1"], { input: text, encoding: "utf8", maxBuffer: 1 << 24, timeout: 300_000 });
  if (r.status !== 0) throw new Error(`claude exited ${r.status}: ${(r.stderr || r.stdout).slice(0, 300)}`);
  const out = JSON.parse(r.stdout);
  if (out.is_error) throw new Error(`claude error: ${String(out.result).slice(0, 300)}`);
  const raw: string = out.result ?? "";
  const json = raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1);
  return JSON.parse(json);
}

const STATUS_ONLY = process.argv.includes("--status");

async function main() {
  if (!catalog) return console.log("No catalog yet; skipping blurbs.");
  if (!STATUS_ONLY) {
    if (!process.env.CLAUDE_CODE_OAUTH_TOKEN && !process.env.BLURBS_LOCAL) return console.log("No CLAUDE_CODE_OAUTH_TOKEN; skipping blurbs (the app uses rule-based explanations).");
    if (!cliAvailable()) return console.log("Claude Code CLI not installed; skipping blurbs.");
  }

  const blIndex = backlogIndex(bl);
  const live = new Set(catalog.games.map((g) => g.id));
  // Drop notes for games that have left.
  for (const k of Object.keys(blurbs)) if (!live.has(k.split(":")[0])) delete blurbs[k];

  const todo: { p: Profile; key: string; hash: string; data: unknown }[] = [];
  for (const p of DEFAULT_PROFILES) {
    const seeds = seedsFor(p, catalog.seeds, bl);
    const ranked = catalog.games
      .filter((g) => eligible(g, p).ok)
      .map((g) => ({ g, m: scoreGame(g, p, seeds, p.useBackloggd ? blIndex : undefined) }))
      .filter(({ m }) => m.score >= 60 && !m.backlog?.played)
      .sort((a, b) => b.m.score - a.m.score);
    // Top picks, plus anything leaving or coming that fits.
    const pick = [...ranked.slice(0, PER_PROFILE), ...ranked.filter(({ g }) => g.status !== "available")];
    for (const { g, m } of pick) {
      const key = `${g.id}:${p.id}`;
      const data = describe(g, p, m.reason, m.cautions);
      const hash = fingerprint(g, p, data);
      const have = blurbs[key] as { hash?: string; hv?: number } | undefined;
      // Notes from before the fingerprint change are kept as they are, not rewritten.
      if (have && have.hv !== HASH_VERSION) Object.assign(have, { hash, hv: HASH_VERSION });
      if (have?.hash === hash || todo.some((t) => t.key === key)) continue;
      todo.push({ p, key, hash, data });
    }
  }
  const status = (pending: number) =>
    writeJson("public/data/blurbs-status.json", { pending, written: Object.keys(blurbs).length, checkedAt: new Date().toISOString() });
  if (STATUS_ONLY) {
    writeJson("public/data/blurbs.json", blurbs); // drops notes for games that left
    status(todo.length);
    return console.log(`${todo.length} notes missing or out of date.`);
  }
  const run = todo.slice(0, MAX_PER_RUN);
  console.log(`${todo.length} notes needed; writing ${run.length} this run.`);

  let written = 0;
  for (const p of DEFAULT_PROFILES) {
    for (const batch of chunk(run.filter((t) => t.p.id === p.id), BATCH)) {
      try {
        const res = ask(prompt(p, batch.map(({ key, data }) => ({ key, data }))));
        for (const r of res) {
          const t = batch.find((b) => b.key === r.key);
          if (!t || !r.text) continue;
          blurbs[t.key] = { text: r.text.trim(), caveat: r.caveat?.trim() || undefined, generatedAt: new Date().toISOString(), hash: t.hash, hv: HASH_VERSION } as never;
          written++;
        }
        writeJson("public/data/blurbs.json", blurbs);
      } catch (e) {
        // Most likely the plan's usage limit; keep what we have and try again tomorrow.
        console.warn(`Stopping early: ${(e as Error).message}`);
        writeJson("public/data/blurbs.json", blurbs);
        status(todo.length - written);
        console.log(`Wrote ${written} notes.`);
        return;
      }
    }
  }
  writeJson("public/data/blurbs.json", blurbs);
  status(todo.length - written);
  console.log(`Wrote ${written} notes.`);
}

main();
