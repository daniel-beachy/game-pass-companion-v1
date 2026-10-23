import type { ReactNode } from "react";
import type { Game } from "../lib/types";
import type { Match, Verdict } from "../lib/engine";
import { daysUntil, fmtH } from "../lib/engine";
import { openGame } from "../state";

export const fmtDate = (iso: string | null, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) =>
  iso ? new Date(iso).toLocaleDateString("en-US", opts) : "TBA";

export function relDays(iso: string | null) {
  const d = daysUntil(iso);
  if (d === null) return "date TBA";
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  return `in ${d} days`;
}

export function Icon({ name, size = 16 }: { name: "tv" | "pc" | "cloud" | "users" | "clock" | "star" | "ext" | "check" | "warn" | "x" | "search" | "gear" | "handheld" | "split"; size?: number }) {
  const p: Record<string, ReactNode> = {
    tv: <><rect x="3" y="5" width="18" height="12" rx="2" /><path d="M8 21h8" /></>,
    pc: <><rect x="3" y="4" width="18" height="12" rx="1.5" /><path d="M9 20h6M12 16v4" /></>,
    cloud: <path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9.5a4.25 4.25 0 0 1-.5 8.5Z" />,
    users: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6S13.9 16 14.5 19" /><circle cx="17" cy="9" r="2.5" /><path d="M16 14.5c2.5 0 4 1.5 4.5 4" /></>,
    clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
    star: <path d="m12 4 2.4 5 5.4.7-4 3.7 1 5.4L12 16.2 7.2 18.8l1-5.4-4-3.7 5.4-.7Z" />,
    ext: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>,
    check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
    warn: <><path d="M12 4 2.8 19.5h18.4Z" /><path d="M12 10v4.5M12 17.2v.3" /></>,
    x: <path d="M6 6l12 12M18 6 6 18" />,
    search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
    gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2.8v2.6M12 18.6v2.6M4.2 7.5l2.2 1.3M17.6 15.2l2.2 1.3M4.2 16.5l2.2-1.3M17.6 8.8l2.2-1.3" /></>,
    handheld: <><rect x="2.5" y="7" width="19" height="10" rx="4" /><path d="M7 10.5v3M5.5 12h3" /><circle cx="16.5" cy="11" r=".6" /><circle cx="18" cy="13" r=".6" /></>,
    split: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M12 5v14" /></>,
  };
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {p[name]}
    </svg>
  );
}

export function Platforms({ g }: { g: Game }) {
  const items: [boolean, "tv" | "pc" | "cloud" | "handheld", string][] = [
    [g.platforms.console, "tv", "Console"],
    [g.platforms.pc, "pc", "PC"],
    [g.platforms.cloud, "cloud", "Cloud"],
  ];
  return (
    <span className="platforms" aria-label={"Available on " + items.filter((i) => i[0]).map((i) => i[2]).join(", ")}>
      {items.map(([on, icon, label]) => (
        <span key={label} className={on ? "plat on" : "plat"} title={`${label}${on ? "" : " (not included)"}`}>
          <Icon name={icon} size={14} />
        </span>
      ))}
    </span>
  );
}

export function CouchBadge({ g }: { g: Game }) {
  const c = g.couch;
  if (!c.supported) return null;
  const conf = c.confidence === "conflict" ? " conflict" : c.confidence === "single" ? " single" : "";
  return (
    <span className={"badge couch" + conf} title={c.confidence === "conflict" ? "Sources disagree; check details" : c.confidence === "single" ? "Only one source says so" : "Local play on one console"}>
      <Icon name="users" size={13} />
      {c.max ? `1–${c.max}` : "Local"}
      {c.splitScreen ? <Icon name="split" size={12} /> : null}
      {c.confidence === "conflict" ? <Icon name="warn" size={12} /> : null}
    </span>
  );
}

export function MatchPill({ m }: { m: Match }) {
  const cls = m.label === "Great match" ? "great" : m.label === "Good match" ? "good" : m.label === "Worth a look" ? "maybe" : "no";
  return (
    <span className={"match " + cls} title={`Match score ${m.score}/100`}>
      <span className="match-dot" />
      {m.label}
    </span>
  );
}

export function VerdictPill({ v }: { v: Verdict }) {
  return <span className={"verdict " + v.kind}>{v.kind === "comfortable" ? "Comfortable" : v.kind === "tight" ? "Tight" : v.kind === "dont" ? "Don't start" : v.kind === "endless" ? "No end" : "Unknown length"}</span>;
}

export function TimeBar({ v }: { v: Verdict }) {
  if (!v.hoursNeeded) return null;
  const max = Math.max(v.hoursNeeded, v.hoursAvailable) || 1;
  return (
    <div className={"timebar " + v.kind} aria-label={`Needs ${fmtH(v.hoursNeeded)}, you have about ${fmtH(v.hoursAvailable)}`}>
      <div className="tb-track">
        <div className="tb-have" style={{ width: `${(100 * v.hoursAvailable) / max}%` }} />
        <div className="tb-need" style={{ left: `${(100 * v.hoursNeeded) / max}%` }} />
      </div>
      <div className="tb-legend">
        <span>You have ~{fmtH(v.hoursAvailable)}</span>
        <span>Needs ~{fmtH(v.hoursNeeded)}</span>
      </div>
    </div>
  );
}

export function Poster({ g, className = "" }: { g: Game; className?: string }) {
  const src = g.images.poster ?? g.images.tile ?? g.images.hero;
  return (
    <div className={"poster " + className}>
      {src ? <img src={`${src}?w=360&format=jpg`} alt="" loading="lazy" /> : <span className="poster-fallback">{g.title}</span>}
    </div>
  );
}

export function GameCard({ g, match, extra }: { g: Game; match?: Match; extra?: ReactNode }) {
  return (
    <button className="card" onClick={() => openGame(g.id)} aria-label={`${g.title}. ${match?.label ?? ""}`}>
      <Poster g={g} />
      <div className="card-body">
        <div className="card-title">{g.title}</div>
        <div className="card-meta">
          <Platforms g={g} />
          <CouchBadge g={g} />
          {g.ttb?.main ? (
            <span className="badge mono" title="Time to finish the main story">
              <Icon name="clock" size={12} />
              {fmtH(g.ttb.main)}
            </span>
          ) : null}
        </div>
        {match ? <MatchPill m={match} /> : null}
        {match?.backlog?.played ? <span className="flag">Played</span> : match?.backlog?.playing ? <span className="flag">Playing</span> : match?.backlog?.backlog || match?.backlog?.wishlist ? <span className="flag hot">On your list</span> : null}
        {extra}
      </div>
    </button>
  );
}

export function Section({ title, sub, children, action }: { title: string; sub?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="section">
      <div className="section-head">
        <div>
          <h2>{title}</h2>
          {sub ? <p className="sub">{sub}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}
