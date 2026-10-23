// Weekly email to Dan: what's leaving (with verdicts), what's coming, and new arrivals worth a look.
// Always writes public/digest/latest.html; sends only when Gmail credentials are present.
import nodemailer from "nodemailer";
import { DEFAULT_PROFILES } from "../src/lib/profiles.ts";
import { backlogIndex, eligible, fmtH, scoreGame, seedsFor, verdict } from "../src/lib/engine.ts";
import type { BackloggdFile, BlurbFile, CatalogFile, Game } from "../src/lib/types.ts";
import { loadEnv, readJson, ROOT } from "./lib/util.ts";
import fs from "node:fs";
import path from "node:path";

loadEnv();
const SITE = "https://daniel-beachy.github.io/game-pass-companion-v1/";
const TO = process.env.DIGEST_TO ?? process.env.GMAIL_USER;

const catalog = readJson<CatalogFile | null>("public/data/catalog.json", null);
const blurbs = readJson<BlurbFile>("public/data/blurbs.json", {});
const bl = readJson<BackloggdFile | null>("data/backloggd.json", null);
if (!catalog) {
  console.log("No catalog; nothing to send.");
  process.exit(0);
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }) : "TBA");
const link = (g: Game) => `${SITE}#/home?game=${g.id}`;
const blIndex = backlogIndex(bl);

const scored = DEFAULT_PROFILES.map((p) => {
  const seeds = seedsFor(p, catalog.seeds, bl);
  const map = new Map(catalog.games.map((g) => [g.id, { fits: eligible(g, p).ok, m: scoreGame(g, p, seeds, p.useBackloggd ? blIndex : undefined) }]));
  return { p, map };
});
const fitsFor = (g: Game) => scored.filter(({ map }) => map.get(g.id)!.fits && map.get(g.id)!.m.score >= 60).map(({ p, map }) => ({ p, m: map.get(g.id)!.m }));

const row = (g: Game, extra: string) => {
  const fits = fitsFor(g);
  const best = fits.sort((a, b) => b.m.score - a.m.score)[0];
  const note = best ? blurbs[`${g.id}:${best.p.id}`]?.text ?? best.m.reason : "";
  return `<tr><td style="padding:10px 0;border-bottom:1px solid #2a362e">
<a href="${link(g)}" style="color:#e8eee9;font-weight:600;text-decoration:none;font-size:15px">${esc(g.title)}</a>
<div style="color:#a9b7ad;font-size:13px;margin-top:2px">${extra}</div>
${fits.length ? `<div style="color:#5ed16a;font-size:12px;margin-top:4px">Suits: ${fits.map((f) => esc(f.p.name)).join(", ")}</div>` : ""}
${note ? `<div style="color:#c9d4cc;font-size:13px;margin-top:4px">${esc(note)}</div>` : ""}
</td></tr>`;
};

const now = Date.now();
const leaving = catalog.games.filter((g) => g.status === "leaving").sort((a, b) => (a.exitDate ?? "").localeCompare(b.exitDate ?? ""));
const coming = catalog.games.filter((g) => g.status === "coming" && g.entryDate && Date.parse(g.entryDate) - now < 21 * 864e5).sort((a, b) => (a.entryDate ?? "").localeCompare(b.entryDate ?? ""));
const fresh = catalog.games.filter((g) => g.status !== "coming" && g.entryDate && now - Date.parse(g.entryDate) < 7 * 864e5 && fitsFor(g).length);

const couch = DEFAULT_PROFILES.find((p) => p.id === "couch")!;
const leavingRows = leaving
  .map((g) => {
    const v = verdict(g, couch.pace, "main");
    const relevant = fitsFor(g).length > 0;
    return relevant ? row(g, `Leaves ${day(g.exitDate)} · ${g.ttb?.main ? fmtH(g.ttb.main) + " main story · " : ""}${esc(v.headline)}`) : "";
  })
  .join("");
const otherLeaving = leaving.filter((g) => !fitsFor(g).length).map((g) => esc(g.title));

const section = (title: string, body: string) => (body ? `<h2 style="font-family:Georgia,serif;font-size:19px;color:#e8eee9;margin:28px 0 4px">${title}</h2><table width="100%" cellpadding="0" cellspacing="0">${body}</table>` : "");

const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Game Pass this week</title></head>
<body style="margin:0;background:#0d110f;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:24px 18px;color:#e8eee9">
<p style="color:#5ed16a;font-size:12px;letter-spacing:.08em;text-transform:uppercase;margin:0">Game Pass Companion · ${day(new Date().toISOString())}</p>
<h1 style="font-family:Georgia,serif;font-size:24px;margin:6px 0 0">Your week on Game Pass</h1>
${section("Leaving soon", leavingRows) || `<p style="color:#a9b7ad">Nothing that suits your profiles is leaving in the announced window.</p>`}
${otherLeaving.length ? `<p style="color:#7d8c82;font-size:12px">Also leaving: ${otherLeaving.join(", ")}.</p>` : ""}
${section("Coming in the next three weeks", coming.map((g) => row(g, `Arrives ${day(g.entryDate)}`)).join(""))}
${section("New this week", fresh.map((g) => row(g, `Added ${day(g.entryDate)}`)).join(""))}
<p style="margin-top:28px"><a href="${SITE}" style="background:#107c10;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">Open the companion</a></p>
<p style="color:#7d8c82;font-size:11px;margin-top:24px">Verdicts here use the couch co-op pace (${couch.pace} h/week). Departures are usually announced about two weeks ahead. Unofficial; data from Microsoft's catalog, IGDB and Steam.</p>
</div></body></html>`;

const out = path.join(ROOT, "public/digest/latest.html");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`Wrote public/digest/latest.html (${leaving.length} leaving, ${coming.length} coming, ${fresh.length} new).`);

if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD || !TO) {
  console.log("No Gmail credentials; not sending.");
} else if (process.argv.includes("--send")) {
  const t = nodemailer.createTransport({ service: "gmail", auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } });
  const subject = leaving.length ? `Game Pass: ${leaving.length} leaving ${day(leaving[0].exitDate)}, ${coming.length} coming` : `Game Pass this week: ${coming.length} coming`;
  await t.sendMail({ from: `Game Pass Companion <${process.env.GMAIL_USER}>`, to: TO, subject, html });
  console.log("Sent.");
}
