import { useMemo, useState } from "react";
import type { AppData, SettingsApi } from "../state";
import type { Model } from "../model";
import { quality } from "../lib/engine";
import { tagLabel } from "../lib/tags";
import { Empty, GameCard, Icon, Section, fmtDate } from "../components/bits";

type Sort = "match" | "quality" | "newest" | "shortest" | "leaving" | "title";

const LENGTHS = [
  ["any", "Any length"],
  ["5", "Under 5 h"],
  ["10", "Under 10 h"],
  ["20", "Under 20 h"],
  ["40", "Under 40 h"],
] as const;

export function Browse({ data, model, api }: { data: AppData; model: Model; api: SettingsApi }) {
  const p = api.active;
  const [q, setQ] = useState("");
  const [players, setPlayers] = useState(0);
  const [coopOnly, setCoopOnly] = useState(false);
  const [online, setOnline] = useState(false);
  const [platform, setPlatform] = useState<"any" | "console" | "pc" | "cloud">("any");
  const [length, setLength] = useState<string>("any");
  const [tags, setTags] = useState<string[]>([]);
  const [fitOnly, setFitOnly] = useState(true);
  const [sort, setSort] = useState<Sort>("match");
  const [status, setStatus] = useState<"all" | "available" | "leaving" | "coming">("all");

  const tagCounts = useMemo(() => {
    const c = new Map<string, number>();
    for (const g of data.catalog.games) for (const t of g.tags) c.set(t, (c.get(t) ?? 0) + 1);
    return [...c.entries()].filter(([, n]) => n >= 4).sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [data]);

  const scored = model.byProfile.get(p.id)!;
  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = [...scored.values()].filter(({ g, fits, m }) => {
      if (fitOnly && !fits) return false;
      if (api.settings.hidePlayed && m.backlog?.played) return false;
      if (needle && !(g.title.toLowerCase().includes(needle) || g.developer.toLowerCase().includes(needle))) return false;
      if (status !== "all" && g.status !== status) return false;
      if (platform !== "any" && !g.platforms[platform]) return false;
      if (players && !(g.couch.supported && (g.couch.max ?? 2) >= players && g.platforms.console)) return false;
      if (coopOnly && !(g.couch.supported && g.couch.coop)) return false;
      if (online && !g.online.coop) return false;
      if (length !== "any" && !(g.ttb?.main && g.ttb.main <= Number(length))) return false;
      if (tags.length && !tags.every((t) => g.tags.includes(t))) return false;
      return true;
    });
    const by: Record<Sort, (a: (typeof list)[number], b: (typeof list)[number]) => number> = {
      match: (a, b) => b.m.score - a.m.score,
      quality: (a, b) => (quality(b.g) ?? 0) - (quality(a.g) ?? 0),
      newest: (a, b) => (b.g.entryDate ?? "").localeCompare(a.g.entryDate ?? ""),
      shortest: (a, b) => (a.g.ttb?.main ?? 999) - (b.g.ttb?.main ?? 999),
      leaving: (a, b) => (a.g.exitDate ?? "9").localeCompare(b.g.exitDate ?? "9"),
      title: (a, b) => a.g.title.localeCompare(b.g.title),
    };
    list = list.sort(by[sort]);
    return list;
  }, [scored, q, fitOnly, status, platform, players, coopOnly, online, length, tags, sort, api.settings.hidePlayed]);

  const toggleTag = (t: string) => setTags((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t]));
  const [showAllTags, setShowAllTags] = useState(false);

  return (
    <Section title="Browse the catalog" sub={`${data.catalog.games.length} games across console, PC, cloud and EA Play. Scores are for ${p.name}.`}>
      <div className="filters">
        <label className="search">
          <Icon name="search" />
          <input id="browse-q" type="search" placeholder="Search titles or studios" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="filter-row">
          <Seg label="Local players" value={String(players)} onChange={(v) => setPlayers(Number(v))} options={[["0", "Any"], ["2", "2+"], ["3", "3+"], ["4", "4+"], ["6", "6+"], ["8", "8"]]} />
          <Seg label="Platform" value={platform} onChange={(v) => setPlatform(v as typeof platform)} options={[["any", "Any"], ["console", "Console"], ["pc", "PC"], ["cloud", "Cloud"]]} />
          <Seg label="Status" value={status} onChange={(v) => setStatus(v as typeof status)} options={[["all", "All"], ["available", "Available"], ["leaving", "Leaving"], ["coming", "Coming"]]} />
        </div>
        <div className="filter-row">
          <Seg label="Length" value={length} onChange={setLength} options={LENGTHS.map(([a, b]) => [a, b])} />
          <label className="check">
            <input id="f-coop" type="checkbox" checked={coopOnly} onChange={(e) => setCoopOnly(e.target.checked)} /> Couch co-op only
          </label>
          <label className="check">
            <input id="f-online" type="checkbox" checked={online} onChange={(e) => setOnline(e.target.checked)} /> Online co-op
          </label>
          <label className="check">
            <input id="f-fit" type="checkbox" checked={fitOnly} onChange={(e) => setFitOnly(e.target.checked)} /> Only games that fit {p.name}
          </label>
          <label className="check">
            <input id="f-played" type="checkbox" checked={api.settings.hidePlayed} onChange={(e) => api.update({ hidePlayed: e.target.checked })} /> Hide played
          </label>
          <label className="sort">
            Sort
            <select id="f-sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="match">Best match</option>
              <option value="quality">Review scores</option>
              <option value="newest">Recently added</option>
              <option value="shortest">Shortest</option>
              <option value="leaving">Leaving soonest</option>
              <option value="title">A–Z</option>
            </select>
          </label>
        </div>
        <div className="tag-cloud">
          {(showAllTags ? tagCounts : tagCounts.slice(0, 24)).map((t) => (
            <button key={t} className="tag" aria-pressed={tags.includes(t)} onClick={() => toggleTag(t)}>
              {tagLabel(t)}
            </button>
          ))}
          <button className="link-btn" onClick={() => setShowAllTags((x) => !x)}>
            {showAllTags ? "Fewer tags" : `All ${tagCounts.length} tags`}
          </button>
        </div>
      </div>
      <p className="muted small results-count">
        {results.length} {results.length === 1 ? "game" : "games"}
        {tags.length ? ` tagged ${tags.map(tagLabel).join(" + ")}` : ""}
      </p>
      {results.length ? (
        <div className="grid">
          {results.slice(0, 120).map(({ g, m }) => (
            <GameCard key={g.id} g={g} match={m} extra={g.status !== "available" ? <span className={"mono date-chip" + (g.status === "leaving" ? " warn" : "")}>{g.status === "leaving" ? `Leaves ${fmtDate(g.exitDate)}` : `Arrives ${fmtDate(g.entryDate)}`}</span> : null} />
          ))}
        </div>
      ) : (
        <Empty>Nothing matches all of those filters. Try removing a tag or turning off “Only games that fit”.</Empty>
      )}
      {results.length > 120 ? <p className="muted small">Showing the first 120. Narrow the filters to see the rest.</p> : null}
    </Section>
  );
}

function Seg({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: (readonly [string, string])[] | [string, string][] }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      <span className="seg-label">{label}</span>
      {options.map(([v, l]) => (
        <button key={v} aria-pressed={value === v} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}
