import { daysUntil, verdict } from "../lib/engine";
import type { Profile } from "../lib/profiles";
import type { AppData, SettingsApi } from "../state";
import { go } from "../state";
import { ranked, type Model } from "../model";
import { Empty, GameCard, Section, VerdictPill, fmtDate, relDays } from "../components/bits";

export function Home({ data, model, api }: { data: AppData; model: Model; api: SettingsApi }) {
  const p = api.active;
  const pace = api.paceFor(p);
  const hide = api.settings.hidePlayed;
  const all = ranked(model, p, () => true, hide);
  const good = (s: (typeof all)[number]) => s.m.score >= 55;

  const leaving = ranked(model, p, (s) => s.g.status === "leaving" && s.m.score >= 50, hide).sort((a, b) => (a.g.exitDate ?? "9").localeCompare(b.g.exitDate ?? "9"));
  const coming = ranked(model, p, (s) => s.g.status === "coming" && s.m.score >= 50, hide).sort((a, b) => (a.g.entryDate ?? "9").localeCompare(b.g.entryDate ?? "9"));
  const fresh = all.filter((s) => s.g.status !== "coming" && s.g.entryDate && Date.now() - Date.parse(s.g.entryDate) < 30 * 864e5 && good(s)).slice(0, 12);
  const listed = all.filter((s) => s.m.backlog && (s.m.backlog.backlog || s.m.backlog.wishlist || s.m.backlog.playing) && s.g.status !== "coming");
  const picks = all.filter((s) => s.g.status !== "coming" && !listed.includes(s)).slice(0, 18);
  const ownDevice =
    p.showOwnDeviceOption
      ? ranked(model, { ...p, kind: "online" }, (s) => s.g.platforms.cloud && s.g.online.coop && s.g.online.crossPlatform && s.g.couch.supported !== true, hide).slice(0, 8)
      : [];

  return (
    <div className="home">
      <Section
        title="Leaving soon"
        sub={leaving.length ? `Games that suit ${p.who}, checked against your pace of ${pace} h/week.` : undefined}
        action={<button className="link-btn" onClick={() => go("leaving")}>All leaving games</button>}
      >
        {leaving.length ? (
          <div className="leave-strip">
            {leaving.map((s) => {
              const v = verdict(s.g, pace, api.settings.goal);
              return (
                <GameCard
                  key={s.g.id}
                  g={s.g}
                  match={s.m}
                  extra={
                    <div className="leave-foot">
                      <span className="mono">Leaves {fmtDate(s.g.exitDate)} · {relDays(s.g.exitDate)}</span>
                      <VerdictPill v={v} />
                    </div>
                  }
                />
              );
            })}
          </div>
        ) : (
          <Empty>Nothing that suits {p.who} is leaving in the announced window. Microsoft usually announces departures about two weeks ahead.</Empty>
        )}
      </Section>

      {coming.length ? (
        <Section title="Coming soon" sub="Joining Game Pass and likely to suit this profile." action={<button className="link-btn" onClick={() => go("coming")}>Everything coming</button>}>
          <div className="grid">
            {coming.map((s) => (
              <GameCard key={s.g.id} g={s.g} match={s.m} extra={<span className="mono date-chip">{s.g.entryDate ? `${fmtDate(s.g.entryDate)} · ${relDays(s.g.entryDate)}` : "Date TBA"}</span>} />
            ))}
          </div>
        </Section>
      ) : null}

      {listed.length ? (
        <Section title="From your Backloggd" sub="On your backlog, wishlist or currently playing, and included with Game Pass right now.">
          <div className="grid">
            {listed.slice(0, 12).map((s) => (
              <GameCard key={s.g.id} g={s.g} match={s.m} extra={s.g.status === "leaving" ? <span className="mono date-chip warn">Leaves {fmtDate(s.g.exitDate)}</span> : null} />
            ))}
          </div>
        </Section>
      ) : null}

      {fresh.length ? (
        <Section title="New in the last month" sub="Recently added and a decent fit.">
          <div className="grid">
            {fresh.map((s) => (
              <GameCard key={s.g.id} g={s.g} match={s.m} extra={<span className="mono date-chip">Added {fmtDate(s.g.entryDate)}</span>} />
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="Top picks" sub={pickSub(p)} action={<button className="link-btn" onClick={() => go("browse")}>Browse with filters</button>}>
        {picks.length ? (
          <div className="grid">
            {picks.map((s) => (
              <GameCard key={s.g.id} g={s.g} match={s.m} />
            ))}
          </div>
        ) : (
          <Empty>No games fit this profile yet. Try fewer dealbreakers in Settings.</Empty>
        )}
      </Section>

      {ownDevice.length ? (
        <Section
          title="Each on your own device"
          sub="A secondary option: one of you on the Xbox, the other streaming on a Mac through xbox.com/play, playing together online. The second player needs their own Game Pass plan that includes cloud gaming."
        >
          <div className="grid">
            {ownDevice.map((s) => (
              <GameCard key={s.g.id} g={s.g} match={s.m} />
            ))}
          </div>
        </Section>
      ) : null}

      <p className="fineprint">
        Catalog updated {fmtDate(data.catalog.generatedAt, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.{" "}
        {daysUntil(data.catalog.generatedAt) === 0 ? "" : ""}
        <button className="link-btn inline" onClick={() => go("about")}>Where the data comes from</button>
      </p>
    </div>
  );
}

function pickSub(p: Profile) {
  switch (p.kind) {
    case "couch":
      return `Local co-op for ${p.players} on one Xbox, ranked by how well they match your favorites.`;
    case "party":
      return `Supports at least ${p.players} players on one console. Change the player count above.`;
    case "online":
      return "Online play with friends, leaning cooperative and low-pressure.";
    default:
      return "Ranked by your favorites and stated tastes.";
  }
}
