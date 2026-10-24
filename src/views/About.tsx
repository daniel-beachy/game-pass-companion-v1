import type { AppData } from "../state";
import { Section, fmtDate } from "../components/bits";

export function About({ data }: { data: AppData }) {
  const s = data.catalog.stats;
  const n = (k: string) => Number(s[k] ?? 0);
  const pct = (k: string) => (n("games") ? Math.round((100 * n(k)) / n("games")) : 0);
  const blurbCount = Object.keys(data.blurbs).length;
  return (
    <div className="about prose">
      <Section title="How this works" sub={`Catalog last updated ${fmtDate(data.catalog.generatedAt, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}. It refreshes itself every night.`}>
        <dl className="stats wide">
          <div>
            <dt>Games</dt>
            <dd className="mono">{n("games")}</dd>
          </div>
          <div>
            <dt>Leaving</dt>
            <dd className="mono">{n("leaving")}</dd>
          </div>
          <div>
            <dt>Coming</dt>
            <dd className="mono">{n("coming")}</dd>
          </div>
          <div>
            <dt>Local multiplayer</dt>
            <dd className="mono">{n("couch")}</dd>
          </div>
          <div>
            <dt>With play times</dt>
            <dd className="mono">{pct("withTimeToBeat")}%</dd>
          </div>
          <div>
            <dt>Matched on IGDB</dt>
            <dd className="mono">{pct("matchedIgdb")}%</dd>
          </div>
        </dl>
      </Section>

      <Section title="Where the data comes from">
        <ul>
          <li>
            <strong>The catalog, dates and platforms</strong> come straight from Microsoft's public Game Pass catalog: what's included with Ultimate on console, PC and cloud, plus EA Play and Ubisoft+ Classics titles. Leaving and coming dates are Microsoft's own scheduled dates, not guesses.
          </li>
          <li>
            <strong>Local co-op</strong> is cross-checked across three sources: the Xbox store's feature list, IGDB's multiplayer data and Steam's split-screen flags. Every game shows how sure that is: hand-checked, sources agree, one source only, or sources disagree. A store page that doesn't mention co-op isn't treated as a "no".
          </li>
          <li>
            <strong>Time to beat</strong> comes from IGDB player reports (main story, main plus extras, completionist). HowLongToBeat doesn't offer a public API, so it's a link only.
          </li>
          <li>
            <strong>Critic scores and similar games</strong> come from IGDB. <strong>Player reviews and tags</strong> come from Steam and SteamSpy where the game is on Steam.
          </li>
          <li>
            <strong>Your history</strong> comes from Dan's Backloggd lists, imported with a bookmarklet because Backloggd has no API.
          </li>
          <li>
            <strong>The "why this game" notes</strong> {blurbCount ? `(${blurbCount} so far)` : ""} are written by Claude from the same data, told to be plain and honest and to say when a game might not click. Each is written once; the nightly update only asks Claude for new ones when a game newly ranks well or meaningfully changes. Where there isn't one yet, you'll see a simpler rule-based explanation.
          </li>
        </ul>
      </Section>

      <Section title="Limits worth knowing">
        <ul>
          <li>Microsoft announces departures roughly two weeks ahead, so "Leaving" can't see further than that. Arrivals are often announced closer to the date too.</li>
          <li>Match scores are a ranking aid, not a promise. They're built from tags, favorites and review scores, and they can't know a game's feel. Use the trailer and review links before committing.</li>
          <li>Play times are averages from players who reported them. A game with only a handful of reports can be off by a lot, and some games have none.</li>
          <li>Co-op data is the shakiest part. Store listings sometimes describe online play as local, and some games only support local co-op on some platforms. If it matters tonight, check the Co-Optimus link.</li>
          <li>PC-only and cloud-only games are included with their platforms shown. Couch profiles only count games that run on the Xbox console.</li>
          <li>Prices are Microsoft's US list and sale prices on the day of the update. The member discount isn't shown by the public catalog.</li>
          <li>Profile edits live in this browser. Clearing site data resets them, so export a backup if you've changed a lot.</li>
        </ul>
      </Section>

      {data.catalog.warnings.length ? (
        <Section title="Notes from the last update" sub="Things the nightly update couldn't do or wasn't sure about.">
          <ul className="small mono warnings">
            {data.catalog.warnings.slice(0, 40).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      <p className="fineprint">
        Unofficial and not affiliated with Microsoft, Xbox, IGDB, Valve or Backloggd. Game data from IGDB.com. <a href="https://github.com/daniel-beachy/game-pass-companion-v1">Source on GitHub</a>.
      </p>
    </div>
  );
}
