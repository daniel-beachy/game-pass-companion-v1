import type { AppData, SettingsApi } from "../state";
import { openGame } from "../state";
import { fitsFor, type Model } from "../model";
import { CouchBadge, Empty, MatchPill, Platforms, Poster, Section, fmtDate, relDays } from "../components/bits";

export function Coming({ data, model, api }: { data: AppData; model: Model; api: SettingsApi }) {
  const p = api.active;
  const games = data.catalog.games.filter((g) => g.status === "coming").sort((a, b) => (a.entryDate ?? "9").localeCompare(b.entryDate ?? "9") || a.title.localeCompare(b.title));
  const groups = new Map<string, typeof games>();
  for (const g of games) {
    const k = g.entryDate ? g.entryDate.slice(0, 10) : "TBA";
    groups.set(k, [...(groups.get(k) ?? []), g]);
  }
  return (
    <Section title="Coming to Game Pass" sub="Announced arrivals with dates from Microsoft's catalog. Chips show which of your profiles each one suits.">
      {games.length === 0 ? <Empty>No announced arrivals right now.</Empty> : null}
      {[...groups.entries()].map(([date, list]) => (
        <div key={date} className="date-group">
          <h3 className="date-head">
            {date === "TBA" ? "Date not announced" : fmtDate(date + "T12:00:00Z", { weekday: "long", month: "long", day: "numeric" })}
            {date !== "TBA" ? <span className="mono muted"> · {relDays(list[0].entryDate)}</span> : null}
          </h3>
          <div className="rows">
            {list.map((g) => {
              const s = model.byProfile.get(p.id)?.get(g.id);
              const fits = fitsFor(model, api.profiles, g.id);
              return (
                <button key={g.id} className="row" onClick={() => openGame(g.id)}>
                  <Poster g={g} className="sm" />
                  <div className="row-main">
                    <div className="row-title">
                      {g.title}
                      {g.gamePreview ? <span className="flag">Game Preview</span> : null}
                      {g.announced ? <span className="flag" title={g.announced}>Added by hand</span> : null}
                    </div>
                    <div className="card-meta">
                      <Platforms g={g} />
                      <CouchBadge g={g} />
                      {s?.fits ? <MatchPill m={s.m} /> : null}
                    </div>
                    <p className="small muted clamp2">{s?.fits ? s.m.reason : g.description}</p>
                    <div className="fit-chips">
                      {fits.map((f) => (
                        <span key={f.p.id} className="chip-sm">{f.p.name}</span>
                      ))}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </Section>
  );
}
