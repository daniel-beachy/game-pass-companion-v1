import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_PROFILES, type Profile } from "./lib/profiles";
import type { BackloggdFile, BlurbFile, CatalogFile } from "./lib/types";

const KEY = "gpc-settings-v1";

export interface Settings {
  activeProfile: string;
  /** Edited profiles; anything missing falls back to the defaults */
  profiles: Profile[] | null;
  pace: Record<string, number>;
  hidePlayed: boolean;
  goal: "main" | "complete";
  /** A Backloggd import done in this browser, overriding the shipped one */
  backloggd: BackloggdFile | null;
  dismissed: string[];
}

const DEFAULTS: Settings = { activeProfile: "couch", profiles: null, pace: {}, hidePlayed: true, goal: "main", backloggd: null, dismissed: [] };

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      /* private mode: settings last for this visit */
    }
  }, [settings]);
  const update = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), []);
  const profiles = settings.profiles ?? DEFAULT_PROFILES;
  const active = profiles.find((p) => p.id === settings.activeProfile) ?? profiles[0];
  const paceFor = (p: Profile) => settings.pace[p.id] ?? p.pace;
  return { settings, update, profiles, active, paceFor, reset: () => setSettings(DEFAULTS) };
}
export type SettingsApi = ReturnType<typeof useSettings>;

export interface AppData {
  catalog: CatalogFile;
  blurbs: BlurbFile;
  backloggd: BackloggdFile | null;
}

export function useData() {
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const base = import.meta.env.BASE_URL + "data/";
    const get = (f: string) => fetch(base + f).then((r) => (r.ok ? r.json() : null));
    Promise.all([get("catalog.json"), get("blurbs.json").catch(() => ({})), get("backloggd.json").catch(() => null)])
      .then(([catalog, blurbs, backloggd]) => {
        if (!catalog) throw new Error("The game catalog didn't load.");
        setData({ catalog, blurbs: blurbs ?? {}, backloggd });
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, []);
  return { data, error };
}

export function useHashRoute() {
  const parse = () => {
    const h = location.hash.replace(/^#\/?/, "");
    const [path, query = ""] = h.split("?");
    return { view: path || "home", params: new URLSearchParams(query) };
  };
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return useMemo(() => route, [route]);
}

export function go(view: string, params?: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) if (v) q.set(k, v);
  const s = q.toString();
  location.hash = `/${view}${s ? "?" + s : ""}`;
}

export function openGame(id: string) {
  const h = location.hash.replace(/^#\/?/, "");
  const [path, query = ""] = h.split("?");
  const q = new URLSearchParams(query);
  q.set("game", id);
  location.hash = `/${path || "home"}?${q}`;
}

export function closeGame() {
  const h = location.hash.replace(/^#\/?/, "");
  const [path, query = ""] = h.split("?");
  const q = new URLSearchParams(query);
  q.delete("game");
  const s = q.toString();
  location.hash = `/${path || "home"}${s ? "?" + s : ""}`;
}
