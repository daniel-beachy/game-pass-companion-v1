import { useEffect, useRef } from "react";
import type { AppData, SettingsApi } from "../state";
import { closeGame } from "../state";
import type { Model } from "../model";
import { fmtH, quality, steamScore, verdict } from "../lib/engine";
import { gameLinks, type LinkItem } from "../lib/links";
import { tagLabel } from "../lib/tags";
import { CouchBadge, Icon, MatchPill, Platforms, TimeBar, VerdictPill, fmtDate, relDays } from "../components/bits";

const GROUPS: [LinkItem["group"], string][] = [
  ["play", "Play"],
  ["watch", "Watch"],
  ["reviews", "Reviews"],
  ["track", "Track"],
];

const CONFIDENCE: Record<string, string> = {
  verified: "Hand-checked",
  agree: "Sources agree",
  single: "One source only",
  conflict: "Sources disagree",
  unknown: "Not enough information",
};

export function GameDetail({ id, data, model, api }: { id: string; data: AppData; model: Model; api: SettingsApi }) {
  const g = data.catalog.games.find((x) => x.id === id);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeGame();
    document.addEventListener("keydown", onKey);
    document.body.classList.add("modal-open");
    ref.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("modal-open");
    };
  }, [id]);

  if (!g) {
    return (
      <div className="modal-backdrop" onClick={closeGame}>
        <div className="modal" role="dialog" aria-modal="true" aria-label="Game not found" onClick={(e) => e.stopPropagation()}>
          <button className="modal-close" onClick={closeGame} aria-label="Close">
            <Icon name="x" />
          </button>
          <div className="modal-body">
            <p>That game isn't in the current catalog. It may have left Game Pass.</p>
          </div>
        </div>
      </div>
    );
  }

  const p = api.active;
  const pace = api.paceFor(p);
  const v = verdict(g, pace, api.settings.goal);
  const bl = g.igdb ? model.blIndex.get(g.igdb.id) : undefined;
  const q = quality(g);
  const st = steamScore(g);
  const links = gameLinks(g);
  const hero = g.images.hero ?? g.images.titledHero ?? g.images.tile ?? g.images.poster;
  const c = g.couch;

  return (
    <div className="modal-backdrop" onClick={closeGame}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="gd-title" tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={closeGame} aria-label="Close">
          <Icon name="x" />
        </button>
        <div className="gd-hero">{hero ? <img src={`${hero}?w=1200&format=jpg`} alt="" /> : null}</div>
        <div className="modal-body">
          <h2 id="gd-title" className="gd-title">
            {g.title}
          </h2>
          <p className="muted small">
            {[g.developer, g.publisher !== g.developer ? g.publisher : null, g.releaseDate ? new Date(g.releaseDate).getFullYear() : null].filter(Boolean).join(" · ")}
          </p>
          <div className="card-meta gd-meta">
            <Platforms g={g} />
            <CouchBadge g={g} />
            {g.catalogs.includes("eaplay") ? <span className="badge">EA Play</span> : g.catalogs.includes("ubisoft") ? <span className="badge">Ubisoft+</span> : null}
            {g.gamePreview ? <span className="flag">Game Preview</span> : null}
            {bl?.playing ? <span className="flag hot">You're playing this</span> : bl?.played ? <span className="flag">Played{bl.rating ? ` · ${bl.rating / 2}★` : ""}</span> : bl?.backlog ? <span className="flag hot">On your backlog</span> : bl?.wishlist ? <span className="flag hot">On your wishlist</span> : null}
          </div>
          <p className="gd-dates mono small">
            {g.status === "coming" ? `Arrives ${fmtDate(g.entryDate, { month: "long", day: "numeric" })} · ${relDays(g.entryDate)}` : g.status === "leaving" ? `Leaves ${fmtDate(g.exitDate, { month: "long", day: "numeric" })} · ${relDays(g.exitDate)}` : g.entryDate ? `On Game Pass since ${fmtDate(g.entryDate, { month: "short", day: "numeric", year: "numeric" })}` : "On Game Pass"}
          </p>

          <div className="gd-grid">
            <div className="gd-col">
              <h3>For each of you</h3>
              <ul className="gd-profiles">
                {api.profiles.map((x) => {
                  const s = model.byProfile.get(x.id)?.get(g.id);
                  if (!s) return null;
                  const blurb = data.blurbs[`${g.id}:${x.id}`];
                  return (
                    <li key={x.id} className={x.id === p.id ? "current" : ""}>
                      <div className="gdp-head">
                        <strong>{x.name}</strong>
                        {s.fits ? <MatchPill m={s.m} /> : <span className="match no">Doesn't fit</span>}
                      </div>
                      {s.fits ? (
                        <>
                          <p className="small">{blurb?.text ?? s.m.reason}</p>
                          {blurb?.caveat ? <p className="small caveat">{blurb.caveat}</p> : null}
                        </>
                      ) : (
                        <p className="small muted">{s.m.cautions[0] ?? s.m.reason}</p>
                      )}
                    </li>
                  );
                })}
              </ul>

              {g.status !== "coming" ? (
                <>
                  <h3>Should {p.name === "Taylor solo" ? "Taylor" : "you"} start it?</h3>
                  <div className="gd-verdict">
                    <VerdictPill v={v} />
                    <p className="small">{v.detail}</p>
                    <TimeBar v={v} />
                    <p className="muted small">At {pace} h/week, aiming for the {api.settings.goal === "main" ? "main story" : "completionist run"}.</p>
                  </div>
                </>
              ) : null}

              <h3>Can we play it together?</h3>
              <div className="gd-couch">
                <p className="small">
                  <strong>
                    {c.supported === true ? `Yes, ${c.max ? `up to ${c.max} players` : "local multiplayer"} on one console` : c.supported === false ? "No local multiplayer" : "Unclear"}
                    {c.supported ? (c.coop ? ", co-op" : ", versus only") : ""}
                    {c.supported && c.splitScreen ? ", split-screen" : ""}.
                  </strong>{" "}
                  <span className={"conf " + c.confidence}>{CONFIDENCE[c.confidence]}</span>
                </p>
                {c.note ? <p className="small">{c.note}</p> : null}
                {c.sources.length ? (
                  <ul className="sources small">
                    {c.sources.map((s) => (
                      <li key={s.name}>
                        <span className="muted">{s.name}:</span> {s.says}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="small">
                  Online: {g.online.coop ? `co-op${g.online.coopMax ? ` up to ${g.online.coopMax}` : ""}` : "no co-op listed"}
                  {g.online.pvp ? ", versus" : ""}
                  {g.online.crossPlatform ? ", cross-platform" : ""}.
                </p>
              </div>
            </div>

            <div className="gd-col">
              <h3>The numbers</h3>
              <dl className="stats">
                <div>
                  <dt>Main story</dt>
                  <dd className="mono">{g.ttb?.main ? fmtH(g.ttb.main) : "—"}</dd>
                </div>
                <div>
                  <dt>Main + extras</dt>
                  <dd className="mono">{g.ttb?.extra ? fmtH(g.ttb.extra) : "—"}</dd>
                </div>
                <div>
                  <dt>Completionist</dt>
                  <dd className="mono">{g.ttb?.complete ? fmtH(g.ttb.complete) : "—"}</dd>
                </div>
                <div>
                  <dt>Critics</dt>
                  <dd className="mono">{g.igdb?.criticScore ? `${Math.round(g.igdb.criticScore)}` : "—"}</dd>
                </div>
                <div>
                  <dt>Steam players</dt>
                  <dd className="mono">{st ? `${st.pct}%` : "—"}</dd>
                </div>
                <div>
                  <dt>Overall</dt>
                  <dd className="mono">{q ? Math.round(q) : "—"}</dd>
                </div>
              </dl>
              <p className="muted small">
                {g.ttb?.count ? `Play times from ${g.ttb.count} IGDB player ${g.ttb.count === 1 ? "report" : "reports"}. ` : "No play-time data yet. "}
                {g.igdb?.criticCount ? `Critic score averages ${g.igdb.criticCount} reviews. ` : ""}
                {st ? `${st.label} on Steam (${st.total.toLocaleString()} reviews).` : ""}
              </p>

              {g.price ? (
                <p className="small price">
                  {g.price.sale ? (
                    <>
                      To keep it: <strong>${g.price.sale.toFixed(2)}</strong> <s>${g.price.msrp.toFixed(2)}</s> right now.
                    </>
                  ) : (
                    <>To keep it: ${g.price.msrp.toFixed(2)}. Members usually get a discount on games in the catalog, often up to 20%.</>
                  )}
                </p>
              ) : null}

              {g.adjustableDifficulty || g.accessibility.length ? (
                <>
                  <h3>Difficulty and accessibility</h3>
                  <p className="small">
                    {g.adjustableDifficulty ? "Has adjustable difficulty. " : ""}
                    {g.accessibility.length ? g.accessibility.slice(0, 8).join(", ") + (g.accessibility.length > 8 ? "…" : "") : ""}
                  </p>
                </>
              ) : null}

              {g.tags.length ? (
                <div className="tag-cloud static">
                  {g.tags.slice(0, 14).map((t) => (
                    <span key={t} className="tag">
                      {tagLabel(t)}
                    </span>
                  ))}
                </div>
              ) : null}

              <h3>Decide quickly</h3>
              <div className="links">
                {GROUPS.map(([grp, label]) => {
                  const items = links.filter((l) => l.group === grp);
                  return items.length ? (
                    <div key={grp} className="link-group">
                      <span className="seg-label">{label}</span>
                      {items.map((l) => (
                        <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="link-item">
                          <span>{l.label}</span>
                          <span className="muted small">{l.hint}</span>
                          <Icon name="ext" size={13} />
                        </a>
                      ))}
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          </div>

          {g.description ? (
            <details className="gd-desc">
              <summary>Store description</summary>
              <p className="small">{g.description}</p>
            </details>
          ) : null}
        </div>
      </div>
    </div>
  );
}
