import type { Game } from "./types";

const enc = encodeURIComponent;
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export interface LinkItem {
  label: string;
  href: string;
  hint: string;
  group: "watch" | "reviews" | "play" | "track";
}

export function gameLinks(g: Game): LinkItem[] {
  const t = g.title.replace(/\s*\(Game Preview\)/i, "");
  const out: LinkItem[] = [
    { group: "play", label: "Xbox store page", href: `https://www.xbox.com/en-US/games/store/${slugify(t)}/${g.id}`, hint: "Official page, editions, add-ons" },
  ];
  if (g.platforms.cloud) out.push({ group: "play", label: "Play in the cloud", href: `https://www.xbox.com/en-US/play/games/${slugify(t)}/${g.id}`, hint: "Stream in a browser, no download" });
  out.push(
    { group: "watch", label: "Official trailer", href: `https://www.youtube.com/results?search_query=${enc(`${t} official trailer`)}`, hint: "YouTube search" },
    { group: "watch", label: "Gameplay reviews", href: `https://www.youtube.com/results?search_query=${enc(`${t} review gameplay`)}`, hint: "Video reviews on YouTube" },
    { group: "reviews", label: "OpenCritic", href: `https://opencritic.com/search?criteria=${enc(t)}`, hint: "Critic aggregate" },
    { group: "reviews", label: "Metacritic", href: `https://www.metacritic.com/search/${enc(t)}/`, hint: "Critic and user scores" },
  );
  if (g.steam) out.push({ group: "reviews", label: "Steam user reviews", href: `https://store.steampowered.com/app/${g.steam.appId}/#app_reviews_hash`, hint: "Player reviews on Steam" });
  if (g.couch.supported || g.online.coop) out.push({ group: "reviews", label: "Co-Optimus", href: `https://www.co-optimus.com/search.php?q=${enc(t)}`, hint: "Co-op details by people who check" });
  out.push(
    { group: "track", label: "HowLongToBeat", href: `https://howlongtobeat.com/?q=${enc(t)}`, hint: "Player-reported play times" },
    { group: "track", label: "Backloggd", href: g.igdb ? `https://backloggd.com/games/${g.igdb.slug}/` : `https://backloggd.com/search/games/${enc(t)}/`, hint: "Log it or add to your backlog" },
  );
  return out;
}
