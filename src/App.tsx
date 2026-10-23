import { useEffect } from "react";
import { go, useData, useHashRoute, useSettings } from "./state";
import { useModel } from "./model";
import type { Profile } from "./lib/profiles";
import { Icon } from "./components/bits";
import { Home } from "./views/Home";
import { Leaving } from "./views/Leaving";
import { Coming } from "./views/Coming";
import { Browse } from "./views/Browse";
import { GameDetail } from "./views/GameDetail";
import { SettingsView } from "./views/Settings";
import { About } from "./views/About";

const NAV = [
  ["home", "For you"],
  ["leaving", "Leaving"],
  ["coming", "Coming"],
  ["browse", "Browse"],
  ["settings", "Settings"],
  ["about", "About"],
] as const;

export default function App() {
  const api = useSettings();
  const { data, error } = useData();
  const model = useModel(data, api);
  const route = useHashRoute();
  const gameId = route.params.get("game");
  const p = api.active;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.view]);

  const setProfile = (patch: Partial<Profile>) => api.setProfile(p.id, patch);
  const pace = api.paceFor(p);
  const counts = data
    ? {
        leaving: data.catalog.games.filter((g) => g.status === "leaving").length,
        coming: data.catalog.games.filter((g) => g.status === "coming").length,
      }
    : null;

  return (
    <div className="app">
      <header className="top">
        <div className="top-inner">
          <a className="brand" href="#/home" aria-label="Game Pass Companion home">
            <span className="brand-mark" aria-hidden="true" />
            <span className="brand-name">Game Pass Companion</span>
          </a>
          <nav className="nav" aria-label="Main">
            {NAV.map(([id, label]) => (
              <a key={id} href={`#/${id}`} aria-current={route.view === id ? "page" : undefined}>
                {label}
                {counts && (id === "leaving" || id === "coming") && counts[id] ? <span className="nav-count mono">{counts[id]}</span> : null}
              </a>
            ))}
          </nav>
        </div>
      </header>

      {route.view !== "about" && route.view !== "settings" ? (
        <div className="controls">
          <div className="controls-inner">
            <div className="profiles" role="tablist" aria-label="Who's playing">
              {api.profiles.map((x) => (
                <button key={x.id} role="tab" aria-selected={x.id === p.id} onClick={() => api.update({ activeProfile: x.id })}>
                  <span className="pf-name">{x.name}</span>
                  <span className="pf-who">{x.who}</span>
                </button>
              ))}
            </div>
            <div className="knobs">
              {p.kind === "party" ? (
                <div className="stepper" aria-label="Players on the couch">
                  <span className="knob-label">Players</span>
                  <button onClick={() => setProfile({ players: Math.max(2, p.players - 1) })} aria-label="Fewer players" disabled={p.players <= 2}>
                    −
                  </button>
                  <span className="mono stepper-val">{p.players}</span>
                  <button onClick={() => setProfile({ players: Math.min(8, p.players + 1) })} aria-label="More players" disabled={p.players >= 8}>
                    +
                  </button>
                </div>
              ) : null}
              <label className="pace">
                <span className="knob-label">
                  Pace <span className="mono">{pace} h/week</span>
                </span>
                <input
                  id="pace"
                  type="range"
                  min={1}
                  max={20}
                  value={pace}
                  onChange={(e) => api.update({ pace: { ...api.settings.pace, [p.id]: Number(e.target.value) } })}
                  aria-label={`Hours per week for ${p.name}`}
                />
              </label>
            </div>
          </div>
        </div>
      ) : null}

      <main className="main">
        {error ? (
          <div className="empty">
            <strong>The game data didn't load.</strong> {error} Try reloading; if it keeps happening the nightly update may have failed.
          </div>
        ) : !data || !model ? (
          <div className="loading" aria-live="polite">
            <span className="spinner" /> Loading the catalog…
          </div>
        ) : route.view === "leaving" ? (
          <Leaving data={data} model={model} api={api} />
        ) : route.view === "coming" ? (
          <Coming data={data} model={model} api={api} />
        ) : route.view === "browse" ? (
          <Browse data={data} model={model} api={api} />
        ) : route.view === "settings" ? (
          <SettingsView data={data} api={api} />
        ) : route.view === "about" ? (
          <About data={data} />
        ) : (
          <Home data={data} model={model} api={api} />
        )}
      </main>

      {data && model && gameId ? <GameDetail id={gameId} data={data} model={model} api={api} /> : null}

      <footer className="foot">
        <p>
          Unofficial fan-made tool, not affiliated with Microsoft or Xbox. Data from Microsoft's public Game Pass catalog, IGDB and Steam.{" "}
          <button className="link-btn inline" onClick={() => go("about")}>
            How it works and its limits
          </button>
        </p>
        <a className="foot-gear" href="#/settings" aria-label="Settings">
          <Icon name="gear" />
        </a>
      </footer>
    </div>
  );
}
