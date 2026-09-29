import type { Flow } from "./reactions.ts";
export type Region = 0 | 1 | 2 | 3;
export type Allegiance = "Dark Carnival" | "Nethervoid";
export type Kind =
  | "fiend"
  | "cash"
  | "event"
  | "homie"
  | "item"
  | "location"
  | "bone";
export type Effect = {
  type: string;
  amount?: number;
  target?: string;
  value?: string;
  region?: number;
  pos?: number;
};
export type Card = {
  key: string;
  name: string;
  kind: Kind;
  deck: number | "purchase" | "bone" | "ending";
  copies: number;
  rules: string;
  source: string;
  verified: boolean;
  automatic: boolean;
  strength?: number;
  reward?: number;
  cash?: number;
  price?: number;
  combat?: number;
  disposition?: string;
  notes?: string[];
  duplicateOf?: string;
  weapon?: boolean;
  ranged?: boolean;
  breakOnOne?: boolean;
  female?: boolean;
  vehicle?: boolean;
  allegiance?: Allegiance;
  effects?: Effect[];
  use?: "herb" | "drink" | "armor" | "doll";
};
export type Player = {
  id: string;
  session: string;
  name: string;
  character: string;
  color: string;
  region: number;
  pos: number;
  life: number;
  maxLife: number;
  bonus: number;
  cash: number;
  items: string[];
  homies: string[];
  bones: string[];
  allegiance: Allegiance;
  ready: boolean;
  dead: boolean;
  rebirth: boolean;
  bot?: boolean;
  notes: string;
  skip: number;
  extraTurns: number;
  used: string[];
  boost: number;
  respawn?: boolean;
  respawnAt?: { region: number; pos: number };
  casketRecovery?: string;
  absentUntil?: number;
  conditions?: Record<
    string,
    { expiresAfterTurn?: number; branch?: "arm" | "leg"; controller?: string }
  >;
  temporaryItems?: string[];
  cardUses?: Record<string, number>;
  wagonUntil?: number;
  landed?: boolean;
  lootFor?: string;
  lootTurns?: number;
};
export type Destination = {
  region: number;
  pos: number;
  toll: number;
  itemToll?: boolean;
  reason?: string;
};
export type CombatChoice = {
  weapon: string | null;
  finisher: boolean;
  escape: boolean;
  suppress: boolean;
  drink: string | null;
  defense: string | null;
  modifier: number;
};
export type Combat = {
  attacker: string;
  defender?: string;
  cards: string[];
  region: number;
  pos: number;
  ranged: boolean;
  mortal: boolean;
  choices: Record<string, CombatChoice>;
  ending?: boolean;
  redirectedBy?: string;
  boosts?: Record<string, string[]>;
  forceWinner?: string;
};
export type Penalty = {
  winner: string;
  loser: string;
  defense?: string | null;
};
export type Trade = {
  from: string;
  to: string;
  give: string | null;
  ask: string | null;
  giveCash: number;
  askCash: number;
};
export type Ruling = {
  actor: string;
  cards: string[];
  reason: string;
  returnPhase: State["phase"];
  changes: number;
  bone?: boolean;
};
export type State = {
  rulesVersion: 3;
  flow?: Flow;
  recoil?: { player: string; mortal: boolean }[];
  pendingVictory?: string[];
  itemPrompt?: {
    player: string;
    kind: "movement" | "teleport";
    values?: number[];
    raw?: number[];
    returnPhase: State["phase"];
  };
  direction?: number;
  code: string;
  status: "lobby" | "playing" | "finished";
  host: string;
  players: Player[];
  turn: number;
  round: number;
  phase:
    | "roll"
    | "move"
    | "encounter"
    | "combat"
    | "penalty"
    | "overflow"
    | "ruling"
    | "end"
    | "ending"
    | "waiting"
    | "decision";
  roll: number | null;
  choices: Destination[];
  encounter: string | null;
  queue: string[];
  board: Record<string, string[]>;
  decks: string[][];
  discards: string[][];
  purchase: string[];
  boneDeck: string[];
  boneDiscard: string[];
  ending: string;
  endingPool: string[];
  finalRevealed: boolean;
  finalEntered: boolean;
  endingDiscard?: string[];
  endingPending?: string | null;
  decision?: {
    kind: "bone-draw" | "bone-transfer";
    actor: string;
    item?: string;
    returnPhase: State["phase"];
  } | null;
  peek?: { player: string; card: string } | null;
  endingHolder: string | null;
  endingProgress: Record<string, number>;
  usedCharacters: string[];
  lastDice: number[];
  log: string[];
  winner: string | null;
  winners: string[];
  endedByHost?: string;
  rev: number;
  combat: Combat | null;
  penalty: Penalty | null;
  trade: Trade | null;
  ruling: Ruling | null;
  overflow: { player: string; returnPhase: State["phase"] } | null;
  firstRolls: Record<string, number>;
  locationDone: boolean;
  wonFiend: boolean;
  turnsTaken: Record<string, number>;
};
export type Action = {
  type: string;
  actor?: string;
  region?: number;
  pos?: number;
  target?: string;
  item?: string;
  character?: string;
  version?: number;
  power?: string;
  amount?: number;
  stat?: string;
  choice?: string;
  weapon?: string | null;
  drink?: string | null;
  finisher?: boolean;
  escape?: boolean;
  suppress?: boolean;
  defense?: string | null;
  give?: string | null;
  ask?: string | null;
  giveCash?: number;
  askCash?: number;
  cards?: string[];
  winners?: string[];
  reason?: string;
  deck?: number | "bone" | "purchase";
  allegiance?: Allegiance;
  ending?: string;
  modifier?: number;
};
export type Option = { label: string; action: Action; group?: string };
