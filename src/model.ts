import { useMemo } from "react";
import { backlogIndex, eligible, scoreGame, seedsFor, type Match } from "./lib/engine";
import type { Profile } from "./lib/profiles";
import type { Game } from "./lib/types";
import type { AppData, SettingsApi } from "./state";

export interface Scored {
  g: Game;
  m: Match;
  fits: boolean;
}

/** Scores every game for every profile once per data/settings change. */
export function useModel(data: AppData | null, api: SettingsApi) {
  const bl = api.settings.backloggd ?? data?.backloggd ?? null;
  return useMemo(() => {
    if (!data) return null;
    const blIndex = backlogIndex(bl);
    const byProfile = new Map<string, Map<string, Scored>>();
    for (const p of api.profiles) {
      const seeds = seedsFor(p, data.catalog.seeds, bl);
      const map = new Map<string, Scored>();
      for (const g of data.catalog.games) {
        const fits = eligible(g, p).ok;
        map.set(g.id, { g, m: scoreGame(g, p, seeds, p.useBackloggd ? blIndex : undefined), fits });
      }
      byProfile.set(p.id, map);
    }
    return { byProfile, blIndex, bl };
  }, [data, api.profiles, bl]);
}
export type Model = NonNullable<ReturnType<typeof useModel>>;

export function ranked(model: Model, p: Profile, filter: (s: Scored) => boolean = () => true, hidePlayed = true) {
  const map = model.byProfile.get(p.id);
  if (!map) return [];
  return [...map.values()]
    .filter((s) => s.fits && filter(s) && !(hidePlayed && s.m.backlog?.played))
    .sort((a, b) => b.m.score - a.m.score);
}

/** Which profiles a game suits (for chips on Leaving / Coming lists). */
export function fitsFor(model: Model, profiles: Profile[], gameId: string) {
  return profiles
    .map((p) => ({ p, s: model.byProfile.get(p.id)?.get(gameId) }))
    .filter((x) => x.s && x.s.fits && x.s.m.score >= 60)
    .map((x) => ({ p: x.p, m: x.s!.m }));
}
