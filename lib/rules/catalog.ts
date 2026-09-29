import characters from "./characters.json" with { type: "json" };
import board from "../board.json" with { type: "json" };
import cards from "./cards.json" with { type: "json" };
import spaces from "./spaces.json" with { type: "json" };
import type { Card, Player, State } from "./types.ts";
export const CHARACTERS = characters.map((c) => c.name);
export const ROSTER = characters;
export const REGIONS = ["Detroit", "Nethervoid", "Dark Carnival"];
export const COLORS = [
  "#e7c375",
  "#bd9bf2",
  "#6ddac4",
  "#f08a9c",
  "#8fbeff",
  "#edb080",
];
export const COUNTS = [28, 20, 12];
export const GATES = [11, 18, 6];
export const CARDS = cards as Card[];
export const CARD_BY_KEY: Record<string, Card> = Object.fromEntries(
  CARDS.map((c) => [c.key, c]),
);
export const ENDINGS = [
  {
    id: "ninja",
    name: "Drunken Ninja Master",
    rules:
      "Defeat strength 25. Losing costs 1 life, all Homies and a turn, and sends you to Chaos District. A tie only moves you. Magic Ninja returns to The Bridge without missing a turn.",
  },
  {
    id: "outer-space",
    name: "Psychopathics from Outer Space",
    rules:
      "Every survivor rolls d6. A 1–2 eliminates that player. Repeat for up to three rounds, stopping if no more than one remains. All survivors win.",
  },
  {
    id: "diamond",
    name: "Diamond Rain",
    rules:
      "The throne holder gains 1 base Combat Bonus each turn and wins on their sixth turn. Entrants challenge the holder in Mortal Combat; the winner takes the throne and starts their own count.",
  },
  {
    id: "wand",
    name: "Milenko’s Wand",
    rules:
      "The holder stays in Shangri-La and targets a player each turn. A d10 determines movement, a Bone card, lost possessions, damage, or elimination. Entrants fight the holder in Mortal Combat.",
  },
  {
    id: "dimension",
    name: "The 17th Dimension",
    rules:
      "The entering player is eliminated. Remove this ending, shuffle the remaining endings and place a new hidden ending in Shangri-La.",
  },
  {
    id: "unveiling",
    name: "The Unveiling",
    rules: "The player revealing this ending wins immediately.",
  },
  {
    id: "skull",
    name: "Crystal Skull",
    rules:
      "The holder gains +3 in combat and teleports to challenge another player in Mortal Combat each turn. The victor takes the skull. Other players cannot enter Shangri-La while the skull is held.",
  },
  {
    id: "rotten",
    name: "Mr. Rotten Treats",
    rules:
      "Defeat strength 25 three times in one turn. Ties are rerolled. A loss costs 1 life and moves you to Valley of the Crow.",
  },
  {
    id: "wraith",
    name: "The Wraith",
    rules:
      "Each turn, roll d6 plus the number of earlier failed attempts. A result of at least 6 wins. Otherwise lose 1 life. You cannot leave Shangri-La.",
  },
  {
    id: "book",
    name: "The Necronomicon",
    rules:
      "Carry this Item to Knapp Cemetery or an adjacent space to win. It can be taken through combat. If discarded, it returns to Shangri-La.",
  },
];
export function character(name: string) {
  const c = ROSTER.find((c) => c.name === name);
  if (!c) throw new Error("Choose one of the 18 characters.");
  return c;
}
export function card(id: string) {
  const c = CARD_BY_KEY[id.split("@")[0]];
  if (!c) throw new Error("That card is not in this edition.");
  return c;
}
export function cardName(id: string) {
  return card(id).name;
}
export function spaceName(r: number, p: number) {
  return r === 3 ? "Shangri-La" : (board.regions[r]?.[p] ?? "Unknown space");
}
export function findSpace(name: string) {
  for (let r = 0; r < 3; r++) {
    const p = board.regions[r].indexOf(name);
    if (p >= 0) return { region: r, pos: p };
  }
  throw new Error("Unknown board space: " + name);
}
export function spaceRule(r: number, p: number) {
  return (spaces as any[]).find((s) => s.region === r && s.pos === p);
}
export function powers(s: State, p: Player) {
  if (p.bones?.some((id) => card(id).name === "Amnesia")) return [];
  const base = character(p.character).powers;
  const borrowed = base.some((x) => x.id === "borrow_colocated_powers")
    ? s.players
        .filter(
          (q) =>
            q.id !== p.id &&
            !q.dead &&
            q.region === p.region &&
            q.pos === p.pos,
        )
        .flatMap((q) => character(q.character).powers)
        .filter((x) => x.id !== "borrow_colocated_powers")
    : [];
  return [...new Map([...base, ...borrowed].map((x) => [x.id, x])).values()];
}
export function has(s: State, p: Player, id: string) {
  return powers(s, p).some((x) => x.id === id);
}
export function editionCoverage() {
  return {
    cards: CARDS.filter((c) => typeof c.deck === "number").reduce(
      (n, c) => n + c.copies,
      0,
    ),
    verified: CARDS.filter((c) => c.verified).length,
    manual: CARDS.filter((c) => !c.automatic).length,
  };
}
