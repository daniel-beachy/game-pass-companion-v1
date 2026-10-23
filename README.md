# Game Pass Companion

A personal recommender for Xbox Game Pass Ultimate, built for a few specific players: couch co-op for two, party nights, solo play for each of us, and online sessions with friends.

**Live site:** https://daniel-beachy.github.io/game-pass-companion-v1/

## What it does
- **Leaving soon**: every announced departure, with the exact date from Microsoft's catalog, and a verdict on whether you can finish it in time at your pace (1–20 h/week, main story or completionist).
- **Coming soon**: announced arrivals with dates and which profiles they suit.
- **For you**: ranked picks per profile, with a plain explanation of why, and caveats.
- **Can we play it together?**: local co-op is cross-checked across the Xbox store, IGDB and Steam, with a confidence level and hand-checked corrections in `data/overrides.json`.
- **Decide quickly**: links to the store, cloud play, trailers, video reviews, OpenCritic, Metacritic, Steam reviews, Co-Optimus, HowLongToBeat and Backloggd.
- **Backloggd**: played games are hidden, backlog and wishlist games get a boost. Refresh it with the bookmarklet in Settings.
- **Weekly email** on Sundays, and a nightly data refresh, both through GitHub Actions.

## Data sources and limits
See the About page on the site. In short: Microsoft's public Game Pass catalog (dates, platforms, prices), IGDB (time to beat, critic scores, co-op modes, similar games), Steam and SteamSpy (split-screen flags, player reviews, tags). HowLongToBeat and Backloggd have no public API and block automated requests, so they're links and a manual bookmarklet import.

## Running it locally
```bash
npm install
npm run dev
```
To refresh the data, put IGDB credentials (a free Twitch developer app) in `.env`:
```
IGDB_CLIENT_ID=...
IGDB_CLIENT_SECRET=...
```
then run `npx tsx scripts/refresh.ts`.

## GitHub secrets
Set each with `gh secret set NAME --repo daniel-beachy/game-pass-companion-v1` and paste the value when asked.

| Secret | Used for |
| --- | --- |
| `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET` | Nightly refresh |
| `CLAUDE_CODE_OAUTH_TOKEN` | "Why this game" notes, written by Claude (Sonnet 5.5) on a Claude Pro/Max plan. Create it with `claude setup-token`. Capped at 100 notes a night; optional. |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | Weekly digest. Needs a Gmail app password (Google Account → Security → 2-Step Verification → App passwords). Optional. |

## Editing profiles
Default profiles live in `src/lib/profiles.ts`. Edits made on the site's Settings page are saved in that browser and can be exported.

Unofficial; not affiliated with Microsoft or Xbox.
