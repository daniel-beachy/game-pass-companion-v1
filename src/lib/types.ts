// Shared data shapes. Written by scripts/refresh.ts, read by the app and the digest.

export type Confidence = "verified" | "agree" | "single" | "conflict" | "unknown";

export interface CouchInfo {
  /** true = you can play together on one console; false = sources say no; null = unknown */
  supported: boolean | null;
  /** Max players on one screen/console, when known */
  max: number | null;
  splitScreen: boolean | null;
  /** Local co-op specifically (working together), as opposed to versus-only party play */
  coop: boolean | null;
  confidence: Confidence;
  /** What each source said, for the "how we know" note */
  sources: { name: "Xbox store" | "IGDB" | "Steam" | "Hand-checked"; says: string }[];
  note?: string;
}

export interface Game {
  id: string; // Microsoft Store product id
  title: string;
  developer: string;
  publisher: string;
  description: string;
  releaseDate: string | null;
  images: { poster?: string; hero?: string; tile?: string; titledHero?: string };
  screenshots: string[];
  trailerPreview: string | null;
  platforms: { console: boolean; pc: boolean; cloud: boolean; handheld: boolean };
  catalogs: ("gamepass" | "eaplay" | "ubisoft")[];
  /** Earliest date it joined (or joins) Game Pass Ultimate */
  entryDate: string | null;
  /** Hand-added: announced for Game Pass but not yet in Microsoft's catalog (the note says where) */
  announced?: string | null;
  /** Date it leaves Game Pass Ultimate, when announced */
  exitDate: string | null;
  status: "coming" | "available" | "leaving";
  gamePreview: boolean;
  price: { msrp: number; sale: number | null } | null;
  categories: string[];
  couch: CouchInfo;
  online: { coop: boolean; coopMax: number | null; pvp: boolean; crossPlatform: boolean };
  singlePlayer: boolean;
  accessibility: string[];
  adjustableDifficulty: boolean;
  igdb: { id: number; slug: string; criticScore: number | null; criticCount: number; userScore: number | null } | null;
  ttb: { main: number | null; extra: number | null; complete: number | null; count: number; source: "IGDB" | "Hand-checked" } | null;
  steam: { appId: number; positive: number; negative: number } | null;
  tags: string[];
  franchises: string[];
  similarIgdb: number[];
  xcloudId: string | null;
}

export interface Seed {
  igdbId: number;
  slug: string;
  title: string;
  tags: string[];
  franchises: string[];
}

export interface CatalogFile {
  generatedAt: string;
  games: Game[];
  seeds: Record<string, Seed>; // keyed by IGDB slug
  stats: Record<string, number | string>;
  warnings: string[];
}

export interface BacklogdEntry {
  igdbId: number;
  slug: string;
  title: string;
  rating: number | null; // 1-10 (half stars)
}

export interface BackloggdFile {
  user: string;
  importedAt: string;
  lists: { played: BacklogdEntry[]; playing: BacklogdEntry[]; backlog: BacklogdEntry[]; wishlist: BacklogdEntry[] };
}

export interface Blurb {
  text: string;
  caveat?: string;
  generatedAt: string;
}
export type BlurbFile = Record<string, Blurb>; // key: `${gameId}:${profileId}`
