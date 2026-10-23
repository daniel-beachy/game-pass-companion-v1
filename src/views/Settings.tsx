import { useEffect, useRef, useState } from "react";
import type { AppData, SettingsApi } from "../state";
import type { BackloggdFile } from "../lib/types";
import type { Profile } from "../lib/profiles";
import { TAG_LABELS, tagLabel } from "../lib/tags";
import { BOOKMARKLET } from "../lib/bookmarklet";
import { Section, fmtDate } from "../components/bits";

const ALL_TAGS = Object.keys(TAG_LABELS);

export function SettingsView({ data, api }: { data: AppData; api: SettingsApi }) {
  const [editing, setEditing] = useState(api.active.id);
  const p = api.profiles.find((x) => x.id === editing) ?? api.profiles[0];
  const setProfile = (patch: Partial<Profile>) => api.setProfile(p.id, patch);
  const edited = Boolean(api.settings.profileEdits[p.id]);

  return (
    <div className="settings">
      <Section title="Profiles" sub="Changes save in this browser only. Export them below to move them to another device.">
        <div className="seg" role="group" aria-label="Profile to edit">
          {api.profiles.map((x) => (
            <button key={x.id} aria-pressed={x.id === p.id} onClick={() => setEditing(x.id)}>
              {x.name}
            </button>
          ))}
        </div>

        <div className="form">
          <label>
            Name
            <input id="pf-name" value={p.name} onChange={(e) => setProfile({ name: e.target.value })} />
          </label>
          <label>
            Who plays
            <input id="pf-who" value={p.who} onChange={(e) => setProfile({ who: e.target.value })} />
          </label>
          {p.kind === "couch" || p.kind === "party" ? (
            <label>
              Players on one console
              <input id="pf-players" type="number" min={1} max={8} value={p.players} onChange={(e) => setProfile({ players: Math.max(1, Math.min(8, Number(e.target.value) || 1)) })} />
            </label>
          ) : null}
          <label>
            Default pace (hours per week)
            <input id="pf-pace" type="number" min={1} max={20} value={p.pace} onChange={(e) => setProfile({ pace: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })} />
          </label>
          <label className="wide">
            About this profile (used for the written explanations)
            <textarea id="pf-notes" rows={4} value={p.notes} onChange={(e) => setProfile({ notes: e.target.value })} />
          </label>
        </div>

        <TagWeights title="Likes" hint="Click to cycle: a little, a lot, love it, off." value={p.likes} onChange={(likes) => setProfile({ likes })} />
        <TagWeights title="Avoid" hint="Lowers the score. Dealbreakers below hide games entirely." value={p.avoid} onChange={(avoid) => setProfile({ avoid })} />

        <div className="field">
          <h3>Dealbreakers</h3>
          <p className="muted small">Games with these tags never show up for this profile.</p>
          <div className="tag-cloud">
            {ALL_TAGS.map((t) => (
              <button key={t} className="tag" aria-pressed={p.dealbreakers.includes(t)} onClick={() => setProfile({ dealbreakers: p.dealbreakers.includes(t) ? p.dealbreakers.filter((x) => x !== t) : [...p.dealbreakers, t] })}>
                {tagLabel(t)}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <h3>Favorite games</h3>
          <p className="muted small">Recommendations lean toward games similar to these. Use the Backloggd/IGDB name from the game's URL for the best match, e.g. it-takes-two.</p>
          <ul className="fav-list">
            {p.favorites.map((f, i) => (
              <li key={i}>
                <span>{f.title}</span>
                <span className="mono muted small">{f.slug}</span>
                <button className="link-btn" onClick={() => setProfile({ favorites: p.favorites.filter((_, j) => j !== i) })} aria-label={`Remove ${f.title}`}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <AddFavorite onAdd={(f) => setProfile({ favorites: [...p.favorites, f] })} />
          <p className="muted small">New favorites only count once the nightly update has looked them up, unless the game is already in the catalog.</p>
        </div>

        <div className="checks">
          <label className="check">
            <input id="pf-bl" type="checkbox" checked={p.useBackloggd} onChange={(e) => setProfile({ useBackloggd: e.target.checked })} /> Use Dan's Backloggd lists (flags played games, boosts backlog)
          </label>
          <label className="check">
            <input id="pf-easy" type="checkbox" checked={!!p.wantsEasyModes} onChange={(e) => setProfile({ wantsEasyModes: e.target.checked })} /> Point out difficulty options
          </label>
        </div>

        {edited ? (
          <button className="btn ghost" onClick={() => api.setProfile(p.id, null)}>
            Reset {p.name} to the default
          </button>
        ) : null}
      </Section>

      <ClaudeNotes data={data} />
      <BackloggdImport data={data} api={api} />
      <Backup api={api} />
    </div>
  );
}

function TagWeights({ title, hint, value, onChange }: { title: string; hint: string; value: Record<string, number>; onChange: (v: Record<string, number>) => void }) {
  const [all, setAll] = useState(false);
  const shown = all ? ALL_TAGS : ALL_TAGS.filter((t) => value[t]);
  const cycle = (t: string) => {
    const n = ((value[t] ?? 0) + 1) % 4;
    const next = { ...value };
    if (n) next[t] = n;
    else delete next[t];
    onChange(next);
  };
  return (
    <div className="field">
      <h3>{title}</h3>
      <p className="muted small">{hint}</p>
      <div className="tag-cloud">
        {shown.map((t) => (
          <button key={t} className={"tag w" + (value[t] ?? 0)} aria-pressed={!!value[t]} onClick={() => cycle(t)}>
            {tagLabel(t)}
            {value[t] ? <span className="mono tag-w">{"●".repeat(value[t])}</span> : null}
          </button>
        ))}
        <button className="link-btn" onClick={() => setAll((x) => !x)}>
          {all ? "Show only selected" : "Add more"}
        </button>
      </div>
    </div>
  );
}

function AddFavorite({ onAdd }: { onAdd: (f: { title: string; slug?: string }) => void }) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  return (
    <form
      className="inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        onAdd({ title: title.trim(), slug: slug.trim() || title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") });
        setTitle("");
        setSlug("");
      }}
    >
      <input id="fav-title" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input id="fav-slug" placeholder="backloggd-name (optional)" value={slug} onChange={(e) => setSlug(e.target.value)} />
      <button className="btn" type="submit">
        Add
      </button>
    </form>
  );
}

function BackloggdImport({ data, api }: { data: AppData; api: SettingsApi }) {
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const link = useRef<HTMLAnchorElement>(null);
  const current = api.settings.backloggd ?? data.backloggd;
  // React strips javascript: URLs from href, so set it directly.
  useEffect(() => {
    link.current?.setAttribute("href", BOOKMARKLET);
  }, []);

  const doImport = () => {
    try {
      const f = JSON.parse(text) as BackloggdFile;
      if (!f.lists || !Array.isArray(f.lists.played)) throw new Error("That doesn't look like the bookmarklet's output.");
      api.update({ backloggd: f });
      const n = Object.values(f.lists).reduce((a, l) => a + l.length, 0);
      setMsg(`Imported ${n} games for ${f.user}.`);
      setText("");
    } catch (e) {
      setMsg(`Couldn't import: ${(e as Error).message}`);
    }
  };

  return (
    <Section title="Backloggd" sub="Marks games you've played, boosts your backlog and wishlist, and uses your highly rated games as taste signals.">
      {current ? (
        <p className="small">
          Using <strong>{current.user}</strong>'s lists from {fmtDate(current.importedAt, { month: "short", day: "numeric", year: "numeric" })}: {current.lists.played.length} played, {current.lists.playing.length} playing, {current.lists.backlog.length} backlog, {current.lists.wishlist.length} wishlist
          {api.settings.backloggd ? " (imported in this browser)" : " (shipped with the site)"}.
        </p>
      ) : (
        <p className="small">No Backloggd lists yet.</p>
      )}
      <ol className="steps small">
        <li>
          Drag this to your bookmarks bar:{" "}
          <a ref={link} className="btn bookmarklet" onClick={(e) => e.preventDefault()}>
            Copy my Backloggd
          </a>
        </li>
        <li>Open your profile on backloggd.com (signed in or not) and click the bookmark. It reads your Played, Playing, Backlog and Wishlist pages and copies them.</li>
        <li>Paste the result here.</li>
      </ol>
      <textarea id="bl-paste" rows={3} placeholder='{"user": "...", "lists": {...}}' value={text} onChange={(e) => setText(e.target.value)} />
      <div className="btn-row">
        <button className="btn" onClick={doImport} disabled={!text.trim()}>
          Import
        </button>
        {api.settings.backloggd ? (
          <button className="btn ghost" onClick={() => api.update({ backloggd: null })}>
            Go back to the shipped lists
          </button>
        ) : null}
      </div>
      {msg ? <p className="small" role="status">{msg}</p> : null}
      <p className="muted small">
        Backloggd has no public API and blocks automated requests, so the site can't refresh this on its own. A browser import only lives in this browser; to update the version everyone sees, send Dan the copied text to commit as data/backloggd.json.
      </p>
    </Section>
  );
}

function Backup({ api }: { api: SettingsApi }) {
  const [msg, setMsg] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const exportIt = () => {
    const blob = new Blob([JSON.stringify(api.settings, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "game-pass-companion-settings.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importIt = async (f: File) => {
    try {
      const s = JSON.parse(await f.text());
      if (typeof s !== "object" || !s) throw new Error("not a settings file");
      api.update(s);
      setMsg("Settings imported.");
    } catch (e) {
      setMsg(`Couldn't import: ${(e as Error).message}`);
    }
  };
  return (
    <Section title="Backup" sub="Move your profile edits, paces and Backloggd import between browsers.">
      <div className="btn-row">
        <button className="btn" onClick={exportIt}>
          Export settings
        </button>
        <button className="btn" onClick={() => file.current?.click()}>
          Import settings
        </button>
        <input ref={file} id="settings-file" type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importIt(e.target.files[0])} />
        <button
          className="btn ghost danger"
          onClick={() => {
            if (confirm("Reset all profiles and settings in this browser to the defaults?")) {
              api.reset();
              setMsg("Everything is back to the defaults.");
            }
          }}
        >
          Reset everything
        </button>
      </div>
      {msg ? <p className="small" role="status">{msg}</p> : null}
    </Section>
  );
}

const NOTES_WORKFLOW = "https://github.com/daniel-beachy/game-pass-companion-v1/actions/workflows/blurbs.yml";

function ClaudeNotes({ data }: { data: AppData }) {
  const st = data.blurbStatus;
  const written = Object.keys(data.blurbs).length;
  return (
    <Section title="Claude notes" sub="Short “why this game” notes written by Claude (Sonnet 5.5) on Dan's Pro plan. They only run when you ask, so they never use the plan in the background.">
      <p className="small">
        {written} {written === 1 ? "note" : "notes"} written.{" "}
        {st ? (st.pending ? `${st.pending} top matches don't have one yet or have changed (checked ${fmtDate(st.checkedAt, { month: "short", day: "numeric" })}).` : "Everything that ranks well has a note.") : ""}
      </p>
      <div className="btn-row">
        <a className="btn" href={NOTES_WORKFLOW} target="_blank" rel="noopener noreferrer">
          Generate notes with Claude
        </a>
      </div>
      <p className="muted small">
        Opens GitHub. Click <strong>Run workflow</strong> (you need to be signed in as Dan). It writes notes only for games that are missing one or whose details changed, then republishes the site in a few minutes. Without a note, the site shows a simpler rule-based explanation.
      </p>
    </Section>
  );
}
