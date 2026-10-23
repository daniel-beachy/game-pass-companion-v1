// Default profiles. Anyone can edit these in Settings; edits are saved in the browser.

export type ProfileKind = "couch" | "party" | "solo" | "online";

export interface Favorite {
  title: string;
  /** IGDB / Backloggd slug */
  slug?: string;
}

export interface Profile {
  id: string;
  name: string;
  who: string;
  kind: ProfileKind;
  description: string;
  /** For couch/party: players who need to fit on one console */
  players: number;
  /** Couch profile: only local co-op (not versus-only party games) */
  coopOnly?: boolean;
  favorites: Favorite[];
  likes: Record<string, number>; // tag -> 1..3
  avoid: Record<string, number>; // tag -> 1..3
  dealbreakers: string[];
  /** Plain-language notes, used for the written explanations */
  notes: string;
  /** Default hours per week */
  pace: number;
  /** Use Dan's Backloggd lists to flag played / backlog games */
  useBackloggd: boolean;
  /** Mention difficulty options prominently */
  wantsEasyModes?: boolean;
  /** Secondary idea: each person on their own device (cloud + online co-op) */
  showOwnDeviceOption?: boolean;
}

export const DEFAULT_PROFILES: Profile[] = [
  {
    id: "couch",
    name: "Couch co-op",
    who: "Dan + Taylor",
    kind: "couch",
    description: "Two players, one TV, one Xbox. Split-screen or shared-screen co-op only.",
    players: 2,
    coopOnly: true,
    favorites: [
      { title: "LEGO Star Wars: The Skywalker Saga", slug: "lego-star-wars-the-skywalker-saga" },
      { title: "LEGO Harry Potter Collection", slug: "lego-harry-potter-collection" },
      { title: "LEGO Marvel Super Heroes", slug: "lego-marvel-super-heroes" },
      { title: "A Way Out", slug: "a-way-out" },
      { title: "It Takes Two", slug: "it-takes-two" },
      { title: "Revenge of the Savage Planet", slug: "revenge-of-the-savage-planet" },
      { title: "Escape Academy", slug: "escape-academy" },
      { title: "Stardew Valley", slug: "stardew-valley" },
    ],
    likes: { cozy: 3, cute: 3, puzzle: 3, adventure: 2, mystery: 3, "escape-room": 3, funny: 2, lego: 3, exploration: 1, story: 2, colorful: 1, family: 1, platformer: 1 },
    avoid: { horror: 3, difficult: 2, grind: 2, "combat-heavy": 1, competitive: 3, "souls-like": 3, dark: 1 },
    dealbreakers: ["horror"],
    notes:
      "Dan and Taylor play together on one TV with one Xbox. They love LEGO games, A Way Out, It Takes Two, Revenge of the Savage Planet, Escape Academy and Stardew Valley. They want fun, cute, cozy, puzzle, adventure and mystery games they can play together. Taylor dislikes stressful, hard or high-skill games, complicated controls and horror.",
    pace: 4,
    useBackloggd: true,
    showOwnDeviceOption: true,
  },
  {
    id: "party",
    name: "Party night",
    who: "Friends on the couch",
    kind: "party",
    description: "2 to 8 people on one console. Local multiplayer only; player count matters.",
    players: 4,
    favorites: [
      { title: "Boomerang Fu", slug: "boomerang-fu" },
      { title: "Gang Beasts", slug: "gang-beasts" },
      { title: "Minecraft Dungeons", slug: "minecraft-dungeons" },
      { title: "Knight Squad 2", slug: "knight-squad-2" },
      { title: "Ultimate Chicken Horse", slug: "ultimate-chicken-horse" },
      { title: "Lovers in a Dangerous Spacetime", slug: "lovers-in-a-dangerous-spacetime" },
      { title: "EA Sports FC 25", slug: "ea-sports-fc-25" },
    ],
    likes: { party: 3, funny: 3, physics: 2, minigames: 2, sports: 2, "local-multiplayer": 2, "local-co-op": 1, cute: 1, racing: 1, fighting: 1 },
    avoid: { story: 1, horror: 2, grind: 2, "turn-based": 1, strategy: 1, rpg: 2 },
    dealbreakers: [],
    notes:
      "Friends on the couch, 2 to about 8 people on one Xbox. Favorites: Boomerang Fu, Gang Beasts, Minecraft Dungeons, Knight Squad 2, Ultimate Chicken Horse, Lovers in a Dangerous Spacetime, and sports games like FIFA. Quick to learn, chaotic, funny.",
    pace: 2,
    useBackloggd: true,
  },
  {
    id: "dan",
    name: "Dan solo",
    who: "Dan",
    kind: "solo",
    description: "Deep puzzles, metroidvanias, factory games, survival-exploration, Assassin's Creed.",
    players: 1,
    favorites: [
      { title: "Hollow Knight", slug: "hollow-knight" },
      { title: "Rain World", slug: "rain-world" },
      { title: "Assassin's Creed Origins", slug: "assassins-creed-origins" },
      { title: "Assassin's Creed II", slug: "assassins-creed-ii" },
      { title: "Indiana Jones and the Great Circle", slug: "indiana-jones-and-the-great-circle" },
      { title: "The Alters", slug: "the-alters" },
      { title: "Cuphead", slug: "cuphead" },
      { title: "Don't Starve", slug: "don-t-starve" },
      { title: "Ori and the Blind Forest", slug: "ori-and-the-blind-forest-definitive-edition" },
      { title: "Subnautica", slug: "subnautica" },
      { title: "Oxygen Not Included", slug: "oxygen-not-included" },
      { title: "Celeste", slug: "celeste" },
      { title: "Balatro", slug: "balatro" },
      { title: "Ball x Pit", slug: "ball-x-pit" },
      { title: "Monument Valley", slug: "monument-valley" },
      { title: "Opus Magnum", slug: "opus-magnum" },
      { title: "Infinifactory", slug: "infinifactory" },
      { title: "Minecraft", slug: "minecraft--1" },
    ],
    likes: { metroidvania: 3, puzzle: 3, logic: 3, engineering: 3, exploration: 2, survival: 2, crafting: 1, platformer: 2, historical: 2, "open-world": 1, "hand-drawn": 2, atmospheric: 2, roguelike: 1, deckbuilder: 1, adventure: 2, stealth: 1, "sci-fi": 1 },
    avoid: { grind: 3, competitive: 3, "battle-royale": 3, mmo: 3, horror: 1, "online-only": 2, sports: 1 },
    dealbreakers: ["mmo"],
    notes:
      "Dan loves Hollow Knight (an all-time favorite), Rain World, most Assassin's Creed games, Indiana Jones and the Great Circle, The Alters, Cuphead, Don't Starve, Ori, Subnautica, Oxygen Not Included, Celeste, Balatro, Ball x Pit, Monument Valley, Minecraft, and deep puzzle and factory games like Opus Magnum and Infinifactory. He doesn't mind horror but generally avoids it. No grindy games and nothing that requires a huge time sink to compete online.",
    pace: 6,
    useBackloggd: true,
  },
  {
    id: "online",
    name: "Online with friends",
    who: "Dan + friends, headsets on",
    kind: "online",
    description: "Casual online co-op. Fortnite is about as competitive as it gets.",
    players: 4,
    favorites: [
      { title: "Deep Rock Galactic", slug: "deep-rock-galactic" },
      { title: "Fortnite", slug: "fortnite" },
    ],
    likes: { "online-co-op": 3, "co-op": 2, funny: 2, survival: 1, crafting: 1, shooter: 1, "sci-fi": 1, sandbox: 1, action: 1 },
    avoid: { competitive: 2, grind: 3, mmo: 2, "souls-like": 1, "turn-based": 1 },
    dealbreakers: [],
    notes:
      "Dan plays online with friends on headsets: Fortnite and Deep Rock Galactic. Casual, cooperative or low-pressure online play is good. Sweaty competitive ladders are not; Fortnite is about as competitive as he gets.",
    pace: 3,
    useBackloggd: true,
  },
  {
    id: "taylor",
    name: "Taylor solo",
    who: "Taylor",
    kind: "solo",
    description: "Story, world and atmosphere first. Mysteries, history, magic. Gentle on skill.",
    players: 1,
    favorites: [{ title: "Hogwarts Legacy", slug: "hogwarts-legacy" }],
    likes: { story: 3, mystery: 3, detective: 3, "escape-room": 3, historical: 3, magic: 3, fantasy: 2, exploration: 2, atmospheric: 2, cozy: 2, adventure: 2, "point-and-click": 2, choices: 2, emotional: 2, "open-world": 1, puzzle: 1, "female-protagonist": 1 },
    avoid: { difficult: 3, "combat-heavy": 2, grind: 3, engineering: 2, shooter: 2, roguelike: 2, pvp: 2, strategy: 1, management: 1, dark: 1, "turn-based": 1, platformer: 1 },
    dealbreakers: ["horror", "souls-like", "competitive"],
    notes:
      "Taylor hasn't played much solo. She loves Hogwarts Legacy (one of her favorite games ever) but got bored of Assassin's Creed Odyssey, probably because the combat was too hard. She's a big reader (ACOTAR, Throne of Glass, The Nightingale, The Housemaid), loves history (enjoyed watching AC III and IV), true crime, detective work, escape rooms and mysteries. She does not enjoy stressful, hardcore or high-skill games, complicated controls, horror or grind. Turn-based can be OK in specific cases. She likes mystery and escape-room puzzles, not engineering puzzles. Lean toward story, world, atmosphere and accessibility; mention difficulty options.",
    pace: 3,
    useBackloggd: false,
    wantsEasyModes: true,
  },
];
