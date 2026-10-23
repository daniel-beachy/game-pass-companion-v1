# Handoff: game-pass-companion-v1 (session 1 → session 2)

Status as of 2026-10-23. Read this first in the next session.

## Decisions made with Dan
- Public GitHub Pages site at https://daniel-beachy.github.io/game-pass-companion-v1/ (Vite `base` is already set). Real profiles and the Backloggd username are public; Dan said that's fine.
- Settings: profiles ship in `src/lib/profiles.ts`; in-browser edits (pace etc.) live in localStorage with export/import. No accounts.
- Weekly email digest to Dan only (beachysdan@gmail.com) via Gmail SMTP. Secrets are set by Dan with `gh secret set`: `GMAIL_USER`, `GMAIL_APP_PASSWORD`. Never ask for the values in chat.
- "Why this game" blurbs: Claude Code in GitHub Actions using Dan's **Pro subscription** (`claude setup-token` → secret `CLAUDE_CODE_OAUTH_TOKEN`), model **Sonnet 5.5** (`claude-sonnet-5-5`). Only new/changed matches, batched about 25 per call, and saved to `public/data/blurbs.json` so each is written once. The tone must be grounded and honest: never overstate, and include a caveat when a game may not click. If the token or quota is missing, fall back to the rule-based `reason` from `src/lib/engine.ts`.
- Look: dark, Xbox-adjacent, restrained green accent. Fonts: Bricolage Grotesque (display), Hanken Grotesk (body), IBM Plex Mono (numbers). These are already linked in `index.html`.
- Taylor's taste survey: https://claude.ai/artifact/XTRZDVVjmS2iu9RL1kiuZE. Read her answers with ArtifactData `get` on collection `responses`, doc `taylor`. If she couldn't save, Dan will paste the text instead. Then refine the `taylor` profile (likes, avoid, dealbreakers, favorites, notes).

## Data sources (all verified working)
- **Catalog**: `catalog.gamepass.com/sigls/v2` list IDs (in `scripts/lib/microsoft.ts`), plus `catalog.gamepass.com/v3/products?hydration=RemoteHighSapphire0` (POST; needs an `ms-cv` header). `PassMetadataByPassProductId` gives exact **EntryDateUTC / ExitDateUTC**, which drive the coming and leaving dates. The same response also has attributes (local co-op counts, shared/split screen), accessibility features (AdjustableDifficulty), prices, platforms, and trailers.
- **IGDB** (credentials in `.env`, gitignored; Actions secrets needed: `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET`):
  - Store IDs map to IGDB games exactly through `external_games` (source 11 = Microsoft); 868 of 914 matched.
  - Also used: time to beat (`game_time_to_beats`), multiplayer_modes, critic scores, tags, and similar games.
  - IGDB slugs are Backloggd slugs.
- **Steam**: `appdetails` categories (24/37/39 = shared/split screen) and SteamSpy tags plus positive/negative counts. Cached in `data/cache/steam.json` for about 30 days. The first run is slow because of rate limits.
- **Ruled out**:
  - Xbox Wire RSS (Cloudflare block).
  - HowLongToBeat API (anti-scraping token; link only).
  - Steam appreviews endpoint (redirects).
  - Automated Backloggd fetches (Anubis bot wall).
  - Don't work around any of these.
- **Backloggd**: Dan's lists were imported once through the in-app browser into `data/backloggd.json` (copied to `public/data/`). For refreshes, build a bookmarklet Dan runs on backloggd.com. Its scrape logic: fetch `/u/<user>/games/added/type:{played|playing|backlog|wishlist};/?page=N`, parse `.game-cover[game_id]` (`game_id` = IGDB id, `data-rating` 1–10), then copy JSON to the clipboard. The app's Settings gets a paste box that saves the result to `settings.backloggd`.

## Done
- `scripts/refresh.ts` plus `scripts/lib/*`: the full pipeline, writing `public/data/catalog.json`. It handles couch co-op merging with confidence levels, dedupe, taste seeds, and `data/history.json`. Hand-checked corrections go in `data/overrides.json` (keyed by store ID or normalized title; not created yet).
- The first refresh was **started** and may still be running or partly done (`npx tsx scripts/refresh.ts`). If `public/data/catalog.json` is missing, rerun it. The Steam cache resumes where it stopped.
- `src/lib/{types,tags,profiles,engine,links}.ts`: data shapes, the tag vocabulary, the five default profiles, scoring and explanations, the leaving-soon verdict (comfortable / tight / don't start / unknown / endless) and links.
- `src/state.ts` (settings, data loading, hash routing), `src/model.ts`, `src/components/bits.tsx`, `src/views/{Home,Leaving,Coming,Browse}.tsx`.

## Still to do (in order)
1. `src/App.tsx`, `src/main.tsx` and `src/index.css`. App: header, nav (For you / Leaving / Coming / Browse / Settings / About), profile switcher, a pace slider (1–20 h/week, per profile), and a player-count stepper for Party. CSS: tokens, dark theme, responsive down to 375px. `src/index.css` is still the Vite default and must be replaced.
2. `src/views/GameDetail.tsx`: a modal opened with `?game=<id>` (use `openGame` / `closeGame`). Contents:
   - hero image, platforms, dates
   - per-profile match and blurb
   - "Can we play together?" with the confidence level and each source's claim
   - time to beat, critic and Steam scores, accessibility
   - Backloggd status and the links from `gameLinks`
3. `src/views/Settings.tsx` (profile editor, Backloggd bookmarklet and paste import, export/import/reset) and `src/views/About.tsx` (sources, limitations, stats, warnings from `catalog.json`).
4. Spot-check couch co-op accuracy on known titles (It Takes Two, A Way Out, LEGO games, Overcooked, Moving Out 2, Minecraft Dungeons, Unravel Two). Look at the `conflict` cases too, and add `data/overrides.json` entries.
5. `scripts/blurbs.ts` (Claude Code CLI, Sonnet 5.5, batched, honest-tone prompt) and `scripts/digest.ts` (nodemailer Gmail; also writes `public/digest/latest.html`).
6. `.github/workflows/refresh.yml`: daily refresh, then blurbs if the token exists, then commit data, build and deploy Pages. Also `digest.yml`: weekly, Sunday 14:00 UTC.
7. Verify visually in the browser preview (desktop and mobile) and iterate. Then a README with setup steps for secrets and running locally. Then enable Pages and send Dan the link.
8. Afterwards, if Dan likes it, add a portfolio card. See memory `portfolio-card-workflow`.
