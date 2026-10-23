import { verdict } from "../lib/engine";
import type { AppData, SettingsApi } from "../state";
import { openGame } from "../state";
import { fitsFor, type Model } from "../model";
import { CouchBadge, Empty, MatchPill, Platforms, Poster, Section, TimeBar, VerdictPill, fmtDate, relDays } from "../components/bits";

export function Leaving({ data, model, api }: { data: AppData; model: Model; api: SettingsApi }) {
  const p = api.active;
  const pace = api.paceFor(p);
  const games = data.catalog.games.filter((g) => g.status === "leaving").sort((a, b) => (a.exitDate ?? "9").localeCompare(b.exitDate ?? "9") || a.title.localeCompare(b.title));
  const groups = new Map<string, typeof games>();
  for (const g of games) {
    const k = g.exitDate ? g.exitDate.slice(0, 10) : "TBA";
    groups.set(k, [...(groups.get(k) ?? []), g]);
  }
  return (
    <div>
      <Section
        title="Leaving Game Pass"
        sub={`Every announced departure. Verdicts use ${p.name}'s pace of ${pace} h/week and the ${api.settings.goal === "main" ? "main story" : "completionist"} length. Change either above.`}
      >
        <div className="goal-toggle" role="group" aria-label="Finish goal">
          <button aria-pressed={api.settings.goal === "main"} onClick={() => api.update({ goal: "main" })}>
            Main story
          </button>
          <button aria-pressed={api.settings.goal === "complete"} onClick={() => api.update({ goal: "complete" })}>
            Completionist
          </button>
        </div>
        {games.length === 0 ? <Empty>No departures announced right now.</Empty> : null}
        {[...groups.entries()].map(([date, list]) => (
          <div key={date} className="date-group">
            <h3 className="date-head">
              {date === "TBA" ? "Leaving, date not announced" : `Leaving ${fmtDate(date + "T12:00:00Z", { weekday: "long", month: "long", day: "numeric" })}`}
              {date !== "TBA" ? <span className="mono muted"> · {relDays(list[0].exitDate)}</span> : null}
            </h3>
            <div className="rows">
              {list.map((g) => {
                const v = verdict(g, pace, api.settings.goal);
                const s = model.byProfile.get(p.id)?.get(g.id);
                const fits = fitsFor(model, api.profiles, g.id);
                const bl = g.igdb ? model.blIndex.get(g.igdb.id) : undefined;
                const off = g.price?.sale && g.price.msrp ? Math.round(100 - (100 * g.price.sale) / g.price.msrp) : 0;
                return (
                  <button key={g.id} className="row" onClick={() => openGame(g.id)}>
                    <Poster g={g} className="sm" />
                    <div className="row-main">
                      <div className="row-title">
                        {g.title}
                        {bl?.playing ? <span className="flag hot">You're playing this</span> : bl?.played ? <span className="flag">Played</span> : null}
                      </div>
                      <div className="card-meta">
                        <Platforms g={g} />
                        <CouchBadge g={g} />
                        {s?.fits ? <MatchPill m={s.m} /> : <span className="muted small">Not a fit for {p.name}</span>}
                      </div>
                      <div className="fit-chips">
                        {fits.map((f) => (
                          <span key={f.p.id} className="chip-sm">{f.p.name}</span>
                        ))}
                      </div>
                    </div>
                    <div className="row-verdict">
                      <VerdictPill v={v} />
                      <p className="small">{v.detail}</p>
                      <TimeBar v={v} />
                      {g.price ? (
                        <p className="small price">
                          {g.price.sale ? (
                            <>
                              <strong>On sale ${g.price.sale.toFixed(2)}</strong> <s>${g.price.msrp.toFixed(2)}</s> ({off}% off)
                            </>
                          ) : (
                            <>Keep it: ${g.price.msrp.toFixed(2)}, and members usually get up to 20% off before it leaves</>
                          )}
                        </p>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </Section>
    </div>
  );
}
