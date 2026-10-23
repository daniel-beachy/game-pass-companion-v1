import fs from "node:fs";
import path from "node:path";

export const ROOT = path.resolve(import.meta.dirname, "../..");
export const UA = "GamePassCompanion/1.0 (+https://github.com/daniel-beachy/game-pass-companion-v1)";

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function loadEnv() {
  const file = path.join(ROOT, ".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]] && m[2]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

export async function fetchJson<T = any>(url: string, init: RequestInit = {}, tries = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { ...init, headers: { "User-Agent": UA, ...(init.headers || {}) } });
      if (res.status === 429) {
        await sleep(5000 * (i + 1));
        continue;
      }
      if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
      return (await res.json()) as T;
    } catch (e) {
      lastErr = e;
      await sleep(1000 * (i + 1));
    }
  }
  throw lastErr;
}

export function readJson<T>(rel: string, fallback: T): T {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

export function writeJson(rel: string, data: unknown, pretty = false) {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, pretty ? 1 : 0) + "\n");
}

/** A small on-disk cache with per-entry timestamps, committed to the repo so nightly runs stay cheap. */
export class Cache<T> {
  data: Record<string, { at: number; v: T }>;
  constructor(private rel: string) {
    this.data = readJson(rel, {});
  }
  get(key: string, maxAgeDays: number): T | undefined {
    const e = this.data[key];
    if (!e) return undefined;
    // Stagger expiry by key so refreshes spread across nights.
    const jitter = (hash(key) % 1000) / 1000;
    const maxAge = maxAgeDays * (0.75 + 0.5 * jitter) * 864e5;
    return Date.now() - e.at < maxAge ? e.v : undefined;
  }
  set(key: string, v: T) {
    this.data[key] = { at: Date.now(), v };
  }
  save() {
    writeJson(this.rel, this.data);
  }
}

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export function normTitle(s: string) {
  return s
    .toLowerCase()
    .replace(/[™®©]/g, "")
    .replace(/\((game preview|pc|windows|xbox series x\|s|xbox one)\)/g, "")
    .replace(/\b(xbox series x\|s|xbox one|for windows( 10)?|windows edition|pc edition|game preview)\b/g, "")
    .replace(/\b(standard|deluxe|definitive|complete|game of the year|goty|anniversary|enhanced|remastered|ultimate) edition\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
