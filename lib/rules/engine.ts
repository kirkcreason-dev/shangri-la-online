import { ask, randomValue, transaction } from "./reactions.ts";
import {
  absent,
  boneId,
  hasBone,
  capacity,
  protectedItem,
  movementPenalty,
  controllerFor,
  canControl,
  conditionSummary,
} from "./conditions.ts";
import {
  CARDS,
  CHARACTERS,
  COLORS,
  COUNTS,
  ENDINGS,
  GATES,
  card,
  cardName,
  character,
  findSpace,
  has,
  powers,
  spaceName,
  spaceRule,
} from "./catalog.ts";
import type {
  Action,
  Card,
  CombatChoice,
  Destination,
  Option,
  Player,
  State,
} from "./types.ts";
export * from "./catalog.ts";
export type * from "./types.ts";
export function dice(sides = 6) {
  if (!Number.isInteger(sides) || sides < 2 || sides > 1000)
    throw new Error("Invalid die.");
  return randomValue(sides, () => {
    const a = new Uint32Array(1),
      max = Math.floor(4294967296 / sides) * sides;
    do {
      crypto.getRandomValues(a);
    } while (a[0] >= max);
    return (a[0] % sides) + 1;
  });
}
function shuffle<T>(a: T[]) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = dice(i + 1) - 1;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const ids = (deck: Card["deck"]) =>
  CARDS.filter((c) => c.deck === deck).flatMap((c) =>
    Array.from({ length: c.copies }, (_, i) => `${c.key}@${i}`),
  );
export function addLog(s: State, msg: string) {
  s.log.unshift(msg);
  s.log = s.log.slice(0, 120);
}
export function current(s: State) {
  return s.players[s.turn];
}
const need = (test: unknown, message: string) => {
  if (!test) throw new Error(message);
};
const integer = (v: unknown, min: number, max: number) => {
  need(
    typeof v === "number" && Number.isInteger(v) && v >= min && v <= max,
    "Enter a valid whole number.",
  );
  return v as number;
};
function initialItems(name: string) {
  return character(name).startingItems.map((name, i) => {
    const c = CARDS.find(
      (c) =>
        c.deck === "purchase" && c.name.toLowerCase() === name.toLowerCase(),
    );
    need(c, `Starting item still needs verification: ${name}`);
    return `${c!.key}@setup-${i}-${crypto.randomUUID()}`;
  });
}
export function newPlayer(
  session: string,
  name: string,
  char: string,
  index: number,
): Player {
  const c = character(char),
    start = findSpace(c.startingSpace);
  return {
    id: crypto.randomUUID(),
    session,
    name,
    character: char,
    color: COLORS[index],
    ...start,
    life: c.startingLife,
    maxLife: c.maxLife,
    bonus: c.baseCombatBonus,
    cash: c.startingCash,
    items: initialItems(char),
    homies: [],
    bones: [],
    allegiance: c.allegiance as Player["allegiance"],
    ready: index === 0,
    dead: false,
    rebirth: false,
    notes: "",
    skip: 0,
    extraTurns: 0,
    used: [],
    boost: 0,
  };
}
export function makeRoom(
  code: string,
  session: string,
  name: string,
  char: string,
): State {
  const p = newPlayer(session, name, char, 0),
    endings = shuffle(ENDINGS.map((e) => e.id));
  return {
    rulesVersion: 3,
    code,
    status: "lobby",
    host: p.id,
    players: [p],
    turn: 0,
    round: 1,
    phase: "roll",
    roll: null,
    choices: [],
    encounter: null,
    queue: [],
    board: {},
    decks: [shuffle(ids(0)), shuffle(ids(1)), shuffle(ids(2))],
    discards: [[], [], []],
    purchase: ids("purchase"),
    boneDeck: shuffle(ids("bone")),
    boneDiscard: [],
    ending: endings.pop()!,
    endingPool: endings,
    finalRevealed: false,
    finalEntered: false,
    endingHolder: null,
    endingProgress: {},
    usedCharacters: [],
    lastDice: [],
    log: [`${name} opened a table using the corrected rules.`],
    winner: null,
    winners: [],
    rev: 0,
    combat: null,
    penalty: null,
    trade: null,
    ruling: null,
    overflow: null,
    firstRolls: {},
    locationDone: false,
    wonFiend: false,
    turnsTaken: {},
  };
}
function win(s: State, winners: string[]) {
  if (s.recoil?.length) {
    s.pendingVictory = winners;
    s.phase = "end";
    s.combat = null;
    return;
  }
  s.status = "finished";
  s.winners = winners;
  s.winner = winners[0] ?? null;
  s.combat = null;
  s.penalty = null;
  s.ruling = null;
  s.trade = null;
  addLog(
    s,
    winners.length
      ? `${s.players
          .filter((p) => winners.includes(p.id))
          .map((p) => p.name)
          .join(" and ")} won.`
      : "No players survived.",
  );
}
function endCheck(s: State) {
  const alive = s.players.filter((p) => !p.dead);
  if (s.status === "playing" && alive.length <= 1)
    win(
      s,
      alive.map((p) => p.id),
    );
}
function takePurchase(s: State, name: string) {
  const i = s.purchase.findIndex(
    (id) => cardName(id).toLowerCase() === name.toLowerCase(),
  );
  if (i < 0) return null;
  return s.purchase.splice(i, 1)[0];
}
function discard(s: State, id: string) {
  if (id.startsWith("ending-")) {
    s.endingHolder = null;
    return;
  }
  const c = card(id);
  if (c.deck === "purchase") s.purchase.push(id);
  else if (c.deck === "bone") s.boneDiscard.push(id);
  else if (typeof c.deck === "number") s.discards[c.deck].push(id);
}
function removeCard(s: State, p: Player, id: string, protectHomie = true) {
  const doll =
    protectHomie && p.homies.includes(id) && !p.dead
      ? heldId(p, "Blow-up Doll")
      : undefined;
  if (
    doll &&
    ask({
      player: p.id,
      message: `${cardName(id)} would be discarded.`,
      choices: [
        { id: "doll", label: "Discard Blow-up Doll instead" },
        { id: "homie", label: `Discard ${cardName(id)}` },
      ],
    }) === "doll"
  ) {
    removeCard(s, p, doll);
    addLog(s, `${p.name} protected ${cardName(id)} with Blow-up Doll.`);
    return;
  }
  for (const list of [p.items, p.homies, p.bones]) {
    const i = list.indexOf(id);
    if (i >= 0) {
      if (p.conditions) delete p.conditions[id];
      p.temporaryItems = p.temporaryItems?.filter((x) => x !== id);
      list.splice(i, 1);
      discard(s, id);
      return;
    }
  }
  throw new Error("That player does not hold this card.");
}
function loseAll(s: State, p: Player, what: "items" | "homies" | "bones") {
  if (what === "homies") {
    for (const id of [...p.homies]) removeCard(s, p, id);
    return;
  }
  for (const id of p[what]) discard(s, id);
  if (what === "items") p.temporaryItems = [];
  p[what] = [];
  if (what === "bones") p.conditions = {};
}
function overflow(s: State, p: Player) {
  if (p.items.length > capacity(p) && !s.overflow) {
    s.overflow = { player: p.id, returnPhase: s.phase };
    s.phase = "overflow";
  }
}
function heal(p: Player, n: number) {
  p.life = Math.min(p.maxLife, p.life + n);
}
function gainCash(p: Player, n: number) {
  if (!hasBone(p, "Karmageddon")) p.cash += n;
}
function receive(s: State, p: Player, id: string, homie = false) {
  if (hasBone(p, "Karmageddon")) {
    discard(s, id);
    addLog(s, `${p.name} cannot keep ${cardName(id)} because of Karmageddon.`);
    return;
  }
  p[homie ? "homies" : "items"].push(id);
  if (homie) resolveHomies(s, p);
}
function cb(p: Player, n: number) {
  p.bonus = Math.max(0, Math.min(25, p.bonus + n));
}
function death(s: State, p: Player, permanent = false, mortal = false) {
  if (p.dead || p.respawn || absent(p)) return;
  const casket = p.items.find((id) => cardName(id) === "Casket");
  if (casket && !mortal) {
    // The Casket changes death before ordinary elimination/inheritance destroys the old record.
    p.life = 1;
    p.respawn = true;
    p.respawnAt = findSpace("Knapp Cemetery");
    p.casketRecovery = casket;
    p.skip = 0;
    p.boost = 0;
    addLog(
      s,
      `${p.name} will return through Casket at Knapp Cemetery next turn with 1 Life and their possessions.`,
    );
    return;
  }
  const previous = p.character;
  s.usedCharacters.push(previous);
  if (!p.rebirth && !s.finalEntered && !permanent) {
    const available = CHARACTERS.filter(
      (c) =>
        !s.usedCharacters.includes(c) &&
        !s.players.some((q) => !q.dead && q.character === c),
    );
    if (available.length) {
      const replacement = available[dice(available.length) - 1],
        c = character(replacement);
      p.rebirth = true;
      p.character = replacement;
      p.maxLife = c.maxLife;
      p.life = c.startingLife;
      p.bonus = c.baseCombatBonus;
      p.cash += c.startingCash;
      p.allegiance = c.allegiance as Player["allegiance"];
      for (const list of ["items", "homies"] as const) {
        p[list] = p[list].filter((id) => {
          if (dice() >= 3) return true;
          discard(s, id);
          return false;
        });
      }
      loseAll(s, p, "bones");
      for (const name of c.startingItems) {
        const id = takePurchase(s, name);
        if (id) p.items.push(id);
      }
      p.respawn = true;
      p.skip = 0;
      p.boost = 0;
      addLog(
        s,
        `${p.name}'s ${previous} died. ${replacement} inherits the surviving possessions and begins next turn at ${c.startingSpace}.`,
      );
      return;
    }
  }
  p.dead = true;
  p.life = 0;
  p.cash = 0;
  loseAll(s, p, "items");
  loseAll(s, p, "homies");
  loseAll(s, p, "bones");
  if (s.endingHolder === p.id) s.endingHolder = null;
  addLog(s, `${p.name} (${previous}) is eliminated.`);
}
function heldId(p: Player, name: string) {
  return [...p.items, ...p.homies, ...p.bones].find(
    (id) => normalName(cardName(id)) === normalName(name),
  );
}
function usedItem(s: State, p: Player, id: string) {
  if (p.temporaryItems?.includes(id) && p.items.includes(id)) {
    removeCard(s, p, id);
    addLog(s, `${p.name}'s borrowed ${cardName(id)} returns after its use.`);
  }
}
function playerDie(
  s: State,
  p: Player,
  sides = 6,
  combat = false,
  restricted = false,
) {
  const paint =
    !restricted && sides === 6 ? heldId(p, "Behind the Paint") : undefined;
  const bridget = !restricted ? heldId(p, "Bridget") : undefined;
  let boost = 0,
    painted = false;
  if (paint || bridget) {
    const choice = ask({
      player: p.id,
      message: `Before ${p.name}'s d${sides} roll, choose any card bonus.`,
      choices: [
        { id: "none", label: "Roll without a card bonus" },
        ...(paint
          ? [
              {
                id: "paint",
                label: "Behind the Paint · +1 (natural 6 stays 6)",
              },
            ]
          : []),
        ...(bridget
          ? [{ id: "bridget", label: "Use Bridget · +2 and discard" }]
          : []),
        ...(paint && bridget
          ? [{ id: "both", label: "Use Behind the Paint and Bridget" }]
          : []),
      ],
    });
    painted = choice === "paint" || choice === "both";
    if (choice === "bridget" || choice === "both") {
      removeCard(s, p, bridget!);
      boost = 2;
    }
  }
  let raw = dice(sides);
  for (const owner of [p, ...s.players.filter((q) => q.id !== p.id)]) {
    if (owner.dead || owner.respawn || absent(owner)) continue;
    const ice =
      owner.id === p.id &&
      !restricted &&
      raw === 1 &&
      heldId(owner, "The Ice Man");
    const toy =
      owner.id === p.id && restricted ? undefined : heldId(owner, "Toy Box");
    if (!ice && !toy) continue;
    const choice = ask({
      player: owner.id,
      message: `${p.name} rolled ${raw} on d${sides}. Resolve any reroll before its effects.`,
      choices: [
        { id: "keep", label: `Keep ${raw}` },
        ...(ice ? [{ id: "ice", label: "The Ice Man · reroll the 1" }] : []),
        ...(toy
          ? [{ id: "toy", label: "Use Toy Box · reroll and discard" }]
          : []),
      ],
    });
    if (choice !== "keep") {
      if (choice === "toy") removeCard(s, owner, toy!);
      raw = dice(sides);
      addLog(
        s,
        `${owner.name} used ${choice === "ice" ? "The Ice Man" : "Toy Box"}: the new d${sides} result ${raw} must be accepted.`,
      );
      break;
    }
  }
  if (painted) usedItem(s, p, paint!);
  if (combat) p.boost += boost;
  return {
    raw,
    value: raw + (painted && raw < 6 ? 1 : 0) + (combat ? 0 : boost),
  };
}
function resolveHomies(s: State, p: Player) {
  const superballs = heldId(p, "Superballs");
  if (superballs) {
    const female = p.homies.filter((id) => card(id).female);
    if (female.length) {
      for (const id of female) removeCard(s, p, id);
      removeCard(s, p, superballs);
    }
  }
  const betty = heldId(p, "Fat Sweaty Betty");
  if (betty)
    for (const id of [...p.homies]) if (id !== betty) removeCard(s, p, id);
}
function delivery(s: State, p: Player) {
  const where = spaceName(p.region, p.pos);
  for (const [name, at, reward] of [
    ["Steve at the Office", "Psychopathic Records", "cash"],
    ["Hype Engine", "Oz", "bonus"],
    ["Officer Harry Cox", "Chaos District", "none"],
    ["Fat Sweaty Betty", "Halls of Illusions", "none"],
    ["Unclear title · card 3300", "Southwest", "none"],
    ["Unclear title · card 3300", "Police Station", "none"],
  ] as const) {
    const id = heldId(p, name);
    if (id && where === at) {
      removeCard(s, p, id);
      if (reward === "cash") gainCash(p, 500);
      if (reward === "bonus") cb(p, 1);
      addLog(s, `${p.name} resolved ${name} at ${at}.`);
    }
  }
}
function forcedAttack(s: State, p: Player) {
  return (
    p.landed &&
    held(p, "2 Tuff Tony") &&
    s.players.some(
      (q) => q.id !== p.id && !q.dead && !q.respawn && !absent(q) && same(p, q),
    )
  );
}

function damage(
  s: State,
  p: Player,
  n: number,
  mortal = false,
  permanent = false,
) {
  if (p.dead || p.respawn || absent(p)) return;
  const jelly = heldId(p, "Jellynutz");
  if (jelly && n >= p.life && !permanent) {
    const choice = ask({
      player: p.id,
      message: `${p.name} would lose their last Life.`,
      choices: [
        { id: "save", label: "Discard Jellynutz · stay at 1 Life" },
        { id: "lose", label: "Accept the Life loss" },
      ],
    });
    if (choice === "save") {
      removeCard(s, p, jelly);
      p.life = 1;
      return;
    }
  }
  p.life = Math.max(0, p.life - n);
  if (p.life > 0) return;
  if (!mortal && !permanent && has(s, p, "survive_last_life")) {
    const r = nonCombatDie(s, p, 10);
    addLog(s, `${p.name} rolled ${r} to survive.`);
    if (r >= 4) {
      p.life = 1;
      return;
    }
  }
  death(s, p, permanent || mortal, mortal);
}
function combatDamage(
  s: State,
  p: Player,
  n: number,
  mortal = false,
  defense?: string | null,
) {
  if (held(p, "Evil Dead")) {
    const r = nonCombatDie(s, p, 10);
    addLog(s, `${p.name} rolled ${r} for Evil Dead.`);
    if (r >= 8) return false;
  }
  if (defense && p.items.includes(defense) && card(defense).use === "armor") {
    const r = nonCombatDie(s, p, 10);
    usedItem(s, p, defense);
    addLog(s, `${p.name} rolled ${r} for ${cardName(defense)}.`);
    if (r === 1 && p.items.includes(defense)) removeCard(s, p, defense);
    if (r >= 8) return false;
  }
  damage(s, p, n, mortal);
  return true;
}
function drawId(s: State, region: number | "bone") {
  if (region === "bone") {
    if (!s.boneDeck.length) {
      s.boneDeck = shuffle(s.boneDiscard);
      s.boneDiscard = [];
    }
    need(s.boneDeck.length, "No Bone cards remain.");
    return s.boneDeck.pop()!;
  }
  if (!s.decks[region].length) {
    s.decks[region] = shuffle(s.discards[region]);
    s.discards[region] = [];
  }
  need(s.decks[region].length, "No cards are available in this region.");
  return s.decks[region].pop()!;
}
function nonCombatDie(s: State, p: Player, sides = 6) {
  return (
    playerDie(s, p, sides).value - (hasBone(p, "Random Bone Generator") ? 1 : 0)
  );
}
function cureOnArrival(s: State, p: Player) {
  const name = spaceName(p.region, p.pos),
    start = character(p.character).startingSpace;
  const cures: Record<string, string> = {
    Karmageddon: "Oz",
    "Random Bone Generator": "Chaos District",
    "Slippery Palms": "Playaz Strip Club",
    Amnesia: start,
  };
  for (const [bone, location] of Object.entries(cures)) {
    const id = boneId(p, bone);
    if (id && name === location) {
      removeCard(s, p, id);
      addLog(s, `${p.name} recovered from ${bone}.`);
    }
  }
}
function expireTurnConditions(s: State, p: Player) {
  for (const [id, c] of Object.entries(p.conditions ?? {})) {
    if (
      c.expiresAfterTurn !== undefined &&
      (s.turnsTaken[p.id] ?? 0) >= c.expiresAfterTurn &&
      [...p.bones, ...p.items].includes(id)
    ) {
      removeCard(s, p, id);
      addLog(s, `${p.name}'s ${cardName(id)} expired.`);
    }
  }
}
export function tick(s: State, now = Date.now()) {
  if (s.rulesVersion !== 3 || s.status !== "playing") return false;
  let changed = false;
  for (const p of s.players) {
    if (p.absentUntil && p.absentUntil <= now) {
      delete p.absentUntil;
      changed = true;
      addLog(
        s,
        `${p.name} returned after King High Bone. No arrival encounter is triggered.`,
      );
    }
  }
  if (changed && s.phase === "waiting") {
    const i = s.players.findIndex((p) => !p.dead && !absent(p, now));
    if (i >= 0) {
      s.turn = i;
      startTurn(s);
    }
  }
  return changed;
}
function drawBone(s: State, p: Player, bypassSkateboard = false) {
  if (has(s, p, "ignore_bones") || held(p, "Noosawaa")) {
    addLog(s, `${p.name} is immune to Bone draws.`);
    return;
  }
  if (!bypassSkateboard && held(p, "Skateboard")) {
    s.decision = { kind: "bone-draw", actor: p.id, returnPhase: s.phase };
    s.phase = "decision";
    return;
  }
  const id = drawId(s, "bone");
  const morons = heldId(p, "Voodoo for Morons"),
    others = s.players.filter(
      (q) => q.id !== p.id && !q.dead && !q.respawn && !absent(q),
    );
  if (morons && others.length) {
    const target = ask({
      player: p.id,
      message: `${p.name} drew ${cardName(id)}. Choose its recipient before it takes effect.`,
      choices: [
        { id: "keep", label: "Keep this Bone" },
        ...others.map((q) => ({
          id: q.id,
          label: `Voodoo for Morons · transfer to ${q.name}`,
        })),
      ],
    });
    if (target !== "keep") {
      removeCard(s, p, morons);
      p = s.players.find((q) => q.id === target)!;
    }
  }
  applyBone(s, p, id);
}
function applyBone(s: State, p: Player, id: string) {
  if (has(s, p, "ignore_bones") || held(p, "Noosawaa")) {
    discard(s, id);
    addLog(s, `${p.name} ignored ${cardName(id)}.`);
    return;
  }
  const name = cardName(id);
  p.conditions ??= {};
  if (name === "Random Bone Generator") {
    receive(s, p, id);
    if (!p.items.includes(id)) return;
    overflow(s, p);
  } else p.bones.push(id);
  addLog(s, `${p.name} drew ${name}.`);
  if (["Panic Attack", "Insanity", "Skitsofrantic"].includes(name)) {
    p.conditions[id] = {
      expiresAfterTurn:
        (s.turnsTaken[p.id] ?? 0) + (name === "Skitsofrantic" ? 2 : 3),
    };
    if (name === "Skitsofrantic")
      p.conditions[id].controller =
        s.players[(s.players.indexOf(p) + 1) % s.players.length].id;
  } else if (name === "Amputation") {
    const r = nonCombatDie(s, p);
    s.lastDice = [r];
    p.conditions[id] = { branch: r <= 3 ? "arm" : "leg" };
    addLog(
      s,
      `${p.name}'s Amputation roll ${r}: ${r <= 3 ? "Item capacity 3" : "movement −2"}.`,
    );
    overflow(s, p);
  } else if (name === "The Runs") {
    removeCard(s, p, id);
    loseTurn(s, p);
  } else if (name === "King High Bone") {
    removeCard(s, p, id);
    p.absentUntil = Date.now() + 600000;
    addLog(
      s,
      `${p.name} is absent until ${new Date(p.absentUntil).toISOString()}.`,
    );
    if (s.trade && [s.trade.from, s.trade.to].includes(p.id)) s.trade = null;
    if (s.ruling?.actor === p.id) s.ruling = null;
    if (p.id === current(s).id) {
      s.phase = "end";
      s.encounter = null;
      s.queue = [];
    }
  } else if (name === "Transfer the Bone") {
    removeCard(s, p, id);
    s.decision = { kind: "bone-transfer", actor: p.id, returnPhase: s.phase };
    s.phase = "decision";
  }
}
function ruling(
  s: State,
  p: Player,
  cards: string[],
  reason: string,
  bone = false,
) {
  s.ruling = {
    actor: p.id,
    cards,
    reason,
    returnPhase: "end",
    changes: 0,
    bone,
  };
  s.phase = "ruling";
}
export function destinations(
  p: Player,
  roll: number,
  s?: State,
): Destination[] {
  const out = new Map<string, Destination>();
  if (p.region === 3) {
    if (s && ["diamond", "wand", "wraith"].includes(s.ending)) return [];
    if (roll > 0) {
      const q = { ...p, region: 2, pos: 6 };
      if (roll === 1) return [{ region: 2, pos: 6, toll: 0 }];
      return destinations(q, roll - 1, s).filter((d) => d.region !== 3);
    }
    return [];
  }
  const visit = (
    r: number,
    pos: number,
    left: number,
    toll: number,
    seen: Set<string>,
    itemToll = false,
  ) => {
    const k = `${r}:${pos}`;
    if (r === 3 || left === 0) {
      const old = out.get(k);
      if (!old || old.toll > toll)
        out.set(k, { region: r, pos, toll, itemToll });
      return;
    }
    const n = COUNTS[r],
      edges = [
        { r, pos: (pos + 1) % n, cost: 0 },
        ...(!hasBone(p, "Concussion")
          ? [{ r, pos: (pos + n - 1) % n, cost: 0 }]
          : []),
      ];
    const free = s
      ? has(s, p, "waive_region_tolls")
      : p.character === "Magic Ninja";
    if (
      pos === GATES[r] &&
      (r < 2 || p.bonus >= 15) &&
      !(
        r === 2 &&
        (s?.ending === "skull" || s?.ending === "book") &&
        s.finalRevealed &&
        s.endingHolder
      )
    )
      edges.push({
        r: r + 1,
        pos: [0, 8, 11, 0][r + 1],
        cost: free ? 0 : r === 0 ? 100 : 0,
      });
    if (r > 0 && pos === [0, 8, 11][r])
      edges.push({ r: r - 1, pos: GATES[r - 1], cost: 0 });
    for (const e of edges) {
      const key = `${e.r}:${e.pos}`;
      const item = (!free && r === 1 && e.r === 2) || itemToll;
      if (
        !seen.has(key) &&
        toll + e.cost <= p.cash &&
        (!item ||
          p.items.some(
            (id) => !id.startsWith("ending-") && !protectedItem(p, id),
          ))
      )
        visit(
          e.r,
          e.pos,
          left - 1,
          toll + e.cost,
          new Set([...seen, key]),
          item,
        );
    }
  };
  visit(p.region, p.pos, roll, 0, new Set([`${p.region}:${p.pos}`]));
  return [...out.values()];
}
export function score(
  p: Player,
  s?: State,
  weapon?: string | null,
  opponent?: Player,
  ranged = false,
  mortal = false,
  finisher = false,
  escape = false,
  suppress = false,
) {
  const candidates = p.items.filter(
    (id) =>
      !id.startsWith("ending-") &&
      card(id).weapon &&
      (!ranged || card(id).ranged),
  );
  const chosen =
    weapon === null
      ? null
      : (weapon ??
        candidates.sort(
          (a, b) => (card(b).combat ?? 0) - (card(a).combat ?? 0),
        )[0]);
  let value = p.bonus + p.boost + (chosen ? (card(chosen).combat ?? 0) : 0);
  for (const id of p.items.filter(
    (id) => !id.startsWith("ending-") && !card(id).weapon,
  ))
    value += card(id).combat ?? 0;
  if (!suppress) for (const id of p.homies) value += card(id).combat ?? 0;
  if (!suppress) {
    if (opponent && p.allegiance === "Dark Carnival" && held(p, "Rude Boy"))
      value += 2;
    if (ranged && held(p, "The China Man")) value += 2;
  }
  if (mortal && held(p, "Iced-Out Charm") && p.allegiance === "Dark Carnival")
    value += 3;
  if (chosen && cardName(chosen) === "Ninja Detector Gun" && !ranged)
    value -= card(chosen).combat ?? 0;
  if (s) {
    if (opponent && has(s, p, "player_combat_bonus")) value++;
    if (!opponent && finisher && has(s, p, "fiend_finishing_move")) value += 2;
    if (escape && has(s, p, "escape_attempt")) value += 5;
    if (s.ending === "skull" && s.endingHolder === p.id) value += 3;
  }
  if (p.region === 1 && p.pos === 5)
    value =
      p.bonus +
      p.boost +
      (s && opponent && has(s, p, "player_combat_bonus") ? 1 : 0);
  return value;
}
function removeBoard(s: State, ids: string[]) {
  for (const k of Object.keys(s.board)) {
    s.board[k] = s.board[k].filter((id) => !ids.includes(id));
    if (!s.board[k].length) delete s.board[k];
  }
}
function afterEncounter(s: State) {
  s.encounter = null;
  if (s.queue.length) {
    s.encounter = s.queue.shift()!;
    s.phase = "encounter";
  } else s.phase = "end";
  endCheck(s);
  for (const p of s.players) if (!p.dead) overflow(s, p);
}
function combatStart(
  s: State,
  p: Player,
  ids: string[],
  defender?: Player,
  ranged = false,
  mortal = false,
  at = { region: p.region, pos: p.pos },
) {
  s.combat = {
    attacker: p.id,
    defender: defender?.id,
    cards: ids,
    region: at.region,
    pos: at.pos,
    ranged,
    mortal,
    choices: {},
    ending: p.region === 3 && !defender,
  };
  s.phase = "combat";
  s.trade = null;
  addLog(
    s,
    `${p.name} challenges ${defender?.name ?? (ids.length ? ids.map(cardName).join(" + ") : ENDINGS.find((e) => e.id === s.ending)?.name)}${ranged ? " at range" : ""}${mortal ? " in Mortal Combat" : ""}.`,
  );
}
function cardCombatEnd(
  s: State,
  p: Player,
  result: "win" | "loss" | "tie",
  finisher = false,
) {
  const fight = s.combat!;
  const cards = fight.cards;
  let needsRuling = false;
  if (result === "win") {
    for (const id of cards) {
      cb(p, card(id).reward ?? 0);
      if (!card(id).automatic) needsRuling = true;
      removeBoard(s, [id]);
      discard(s, id);
    }
    s.wonFiend = true;
  } else if (result === "loss") {
    if (!fight.ranged)
      combatDamage(
        s,
        p,
        finisher ||
          spaceRule(p.region, p.pos)?.effects.some(
            (e: any) => e.type === "combat_loss_life_replacement",
          )
          ? 2
          : 1,
        false,
        fight.choices[p.id]?.defense,
      );
    needsRuling = cards.some((id) => !card(id).automatic);
  }
  if (fight.redirectedBy && result !== "win")
    for (const id of cards) {
      removeBoard(s, [id]);
      discard(s, id);
    }
  s.combat = null;
  s.encounter = null;
  s.queue = [];
  s.phase = "end";
  if (needsRuling && !p.dead && !p.respawn)
    ruling(
      s,
      p,
      cards,
      `Combat result: ${result}. Apply only the card's additional effect for that result.`,
    );
  endCheck(s);
}
function rollCombat(s: State) {
  const f = s.combat!,
    p = s.players.find((p) => p.id === f.attacker)!,
    q = f.defender ? s.players.find((p) => p.id === f.defender) : undefined;
  const a = f.choices[p.id],
    b = q ? f.choices[q.id] : undefined;
  const r = f.forceWinner ? 0 : playerDie(s, p, 10, true).raw,
    t = q && !f.forceWinner ? playerDie(s, q, 10, true).raw : 0;
  s.lastDice = f.forceWinner ? [] : q ? [r, t] : [r];
  const effective = (p: Player, r: number, w: string | null) =>
    has(s, p, "combat_nine_as_ten") && r === 9
      ? 10
      : w && cardName(w) === "Diamond Chainsaw" && r >= 8
        ? 10
        : r;
  const x = effective(p, r, a.weapon),
    y = q ? effective(q, t, b!.weapon) : 0;
  const pv =
      score(
        p,
        s,
        a.weapon,
        q,
        f.ranged,
        f.mortal,
        a.finisher,
        a.escape,
        b?.suppress,
      ) + (a.modifier ?? 0),
    qv = q
      ? score(
          q,
          s,
          b!.weapon,
          p,
          false,
          f.mortal,
          b!.finisher,
          b!.escape,
          a.suppress,
        ) + (b!.modifier ?? 0)
      : 0;
  const rank = (r: number, v: number) =>
    r === 10 ? 10000 : r === 1 ? -10000 : r + v;
  const strength = f.ending
    ? 25
    : f.cards.reduce((n, id) => n + (card(id).strength ?? 0), 0) +
      (spaceRule(f.region, f.pos)?.effects.some(
        (e: any) => e.type === "fiend_strength_modifier",
      )
        ? 3
        : 0);
  let diff = q
    ? rank(x, pv) - rank(y, qv)
    : x === 10
      ? 1
      : x === 1
        ? -1
        : x + pv - strength;
  if (
    !q &&
    f.cards.some((id) =>
      ["Corrupt Cops", "Police Chief"].includes(cardName(id)),
    ) &&
    has(s, p, "defeat_police")
  )
    diff = 1;
  if (f.forceWinner) diff = f.forceWinner === p.id ? 1 : -1;
  if (q && (hasBone(p, "Insanity") || hasBone(q, "Insanity")))
    diff =
      hasBone(p, "Insanity") && hasBone(q, "Insanity")
        ? 0
        : hasBone(p, "Insanity")
          ? -1
          : 1;
  if (
    !f.mortal &&
    ((diff > 0 && hasBone(p, "Panic Attack")) ||
      (diff < 0 && q && hasBone(q, "Panic Attack")))
  )
    diff = 0;
  if ((a.escape && diff > 0) || (b?.escape && diff < 0)) diff = 0;
  for (const [player, choice, raw] of [
    [p, a, r],
    [q, b, t],
  ] as const) {
    if (!player || !choice) continue;
    player.boost = 0;
    if (!f.forceWinner && choice.weapon) {
      if (cardName(choice.weapon) === "Rocket Launcher") {
        removeCard(s, player, choice.weapon);
        if (!f.ranged)
          (s.recoil ??= []).push({ player: player.id, mortal: f.mortal });
      } else usedItem(s, player, choice.weapon);
    }
    if (
      choice.weapon &&
      player.items.includes(choice.weapon) &&
      card(choice.weapon).breakOnOne &&
      raw === 1
    ) {
      removeCard(s, player, choice.weapon);
      addLog(s, `${player.name}'s ${cardName(choice.weapon)} broke.`);
    }
  }
  addLog(
    s,
    f.forceWinner
      ? `${s.players.find((p) => p.id === f.forceWinner)!.name} used Mr. Johnson's Head. ${diff === 0 ? "Tie after combat restrictions." : `${diff > 0 ? p.name : q!.name} wins combat.`}`
      : q
        ? `${p.name}: ${r}+${pv}; ${q.name}: ${t}+${qv}. ${diff === 0 ? "Tie." : `${diff > 0 ? p.name : q.name} wins combat.`}`
        : `${p.name}: ${r}+${pv} against ${strength}. ${diff > 0 ? "Win." : diff < 0 ? "Loss." : "Tie."}`,
  );
  f.boosts = {};
  if (f.ending) {
    endingCombat(s, p, diff);
    return;
  }
  if (!q) {
    cardCombatEnd(
      s,
      p,
      diff > 0 ? "win" : diff < 0 ? "loss" : "tie",
      a.finisher,
    );
    return;
  }
  if (diff === 0) {
    if (f.mortal) {
      f.choices = {};
      return;
    }
    s.combat = null;
    s.phase = "end";
    return;
  }
  const winner = diff > 0 ? p : q,
    loser = diff > 0 ? q : p;
  if (f.mortal) {
    combatDamage(s, loser, 1, true, f.choices[loser.id]?.defense);
    if (loser.dead) {
      s.endingHolder = winner.id;
      if (["wand", "skull"].includes(s.ending))
        winner.items.push(`ending-${s.ending}@0`);
      s.endingProgress[winner.id] = 0;
      if (s.ending === "diamond") {
        cb(winner, 1);
        s.endingProgress[winner.id] = 1;
      }
      addLog(
        s,
        `${winner.name} takes ${ENDINGS.find((e) => e.id === s.ending)?.name}.`,
      );
      s.combat = null;
      s.phase = "end";
      endCheck(s);
    } else f.choices = {};
    return;
  }
  if (f.ranged) {
    const choice = diff > 0 ? a : b!;
    if (choice.weapon && card(choice.weapon).ranged) {
      const lost = combatDamage(
        s,
        loser,
        1,
        false,
        f.choices[loser.id]?.defense,
      );
      if (lost && has(s, winner, "drain_life")) heal(winner, 1);
    }
    s.combat = null;
    s.phase = "end";
    endCheck(s);
    return;
  }
  s.penalty = {
    winner: winner.id,
    loser: loser.id,
    defense: f.choices[loser.id]?.defense,
  };
  s.combat = null;
  s.phase = "penalty";
}
function endingCombat(s: State, p: Player, diff: number) {
  if (s.ending === "rotten") {
    if (diff > 0) {
      const count = (s.endingProgress[p.id] ?? 0) + 1;
      s.endingProgress[p.id] = count;
      if (count >= 3) {
        win(s, [p.id]);
        return;
      }
    }
    if (diff >= 0) {
      s.combat!.choices = {};
      return;
    }
    damage(s, p, 1);
    Object.assign(p, findSpace("Valley of the Crow"));
    s.endingProgress[p.id] = 0;
  } else {
    if (diff > 0) {
      win(s, [p.id]);
      return;
    }
    const ninja = has(s, p, "movement_six_teleport");
    if (diff < 0) {
      damage(s, p, 1);
      loseAll(s, p, "homies");
      if (!ninja && !has(s, p, "ignore_lost_turn")) p.skip++;
    }
    Object.assign(
      p,
      ninja ? { region: 2, pos: 6 } : findSpace("Chaos District"),
    );
  }
  s.combat = null;
  s.phase = "end";
  endCheck(s);
}
function enterEnding(s: State, p: Player) {
  s.finalEntered = true;
  s.phase = "ending";
  if (!s.finalRevealed) {
    s.finalRevealed = true;
    addLog(
      s,
      `${p.name} revealed ${ENDINGS.find((e) => e.id === s.ending)?.name}.`,
    );
    if (held(p, "Psychopathic Ring") && s.endingPool.length) {
      s.endingPending = p.id;
      return;
    }
  }
  if (s.ending === "unveiling") {
    win(s, [p.id]);
    return;
  }
  if (s.ending === "dimension") {
    death(s, p, true);
    (s.endingDiscard ??= []).push(s.ending);
    s.ending = shuffle(s.endingPool).pop()!;
    need(s.ending, "No endings remain.");
    s.finalRevealed = false;
    s.phase = "end";
    endCheck(s);
    return;
  }
  if (s.ending === "outer-space") {
    for (let n = 0; n < 3; n++) {
      const living = s.players.filter(
        (p) => !p.dead && !p.respawn && !absent(p),
      );
      const rolls = living.map((p) => ({ p, r: nonCombatDie(s, p) }));

      if (rolls.some(({ r }) => r === 0)) {
        ruling(
          s,
          p,
          [],
          `Bombardment round ${n + 1} has an undefined modified zero: ${rolls.map(({ p, r }) => `${p.name} ${r}`).join(", ")}. Resolve this round and remaining rounds with the table, then declare the surviving winner(s).`,
        );
        s.ruling!.returnPhase = "ending";
        return;
      }
      for (const { p, r } of rolls) {
        addLog(s, `${p.name} rolled ${r} against the bombardment.`);
        if (r <= 2) death(s, p, true);
      }
      if (s.players.filter((p) => !p.dead).length <= 1) break;
    }
    win(
      s,
      s.players.filter((p) => !p.dead).map((p) => p.id),
    );
    return;
  }
  if (["ninja", "rotten"].includes(s.ending)) {
    s.endingProgress[p.id] = 0;
    combatStart(s, p, []);
    return;
  }
  if (s.ending === "wraith") {
    s.endingProgress[p.id] ??= 0;
    return;
  }
  const holder = s.players.find((q) => q.id === s.endingHolder && !q.dead);
  if (holder && holder.id !== p.id && s.ending !== "book") {
    combatStart(s, p, [], holder, false, true);
    return;
  }
  if (!holder) {
    s.endingHolder = p.id;
    if (
      ["wand", "skull"].includes(s.ending) &&
      !p.items.includes(`ending-${s.ending}@0`)
    )
      p.items.push(`ending-${s.ending}@0`);
    s.endingProgress[p.id] = 0;
    if (s.ending === "diamond") {
      cb(p, 1);
      s.endingProgress[p.id] = 1;
      s.phase = "end";
    } else if (s.ending === "book") {
      const id = "ending-book@0";
      if (!p.items.includes(id)) p.items.push(id);
      s.phase = "end";
      overflow(s, p);
    }
  }
}
function endingTurn(s: State, p: Player) {
  if (s.ending === "skull" && s.endingHolder === p.id) {
    s.phase = "ending";
    return;
  }
  if (s.ending === "diamond") {
    const n = (s.endingProgress[p.id] ?? 0) + 1;
    cb(p, 1);
    s.endingProgress[p.id] = n;
    addLog(s, `${p.name} holds the throne: turn ${n}/6.`);
    if (n >= 6) win(s, [p.id]);
    else s.phase = "end";
  } else if (s.ending === "wraith") {
    const count = s.endingProgress[p.id] ?? 0,
      r = nonCombatDie(s, p);
    s.lastDice = [r];
    addLog(s, `${p.name} rolled ${r}+${count} against The Wraith.`);
    if (r + count >= 6) win(s, [p.id]);
    else {
      damage(s, p, 1);
      s.endingProgress[p.id] = count + 1;
      s.phase = "end";
      endCheck(s);
    }
  } else s.phase = "ending";
}
function arrive(s: State, p: Player) {
  cureOnArrival(s, p);
  delivery(s, p);
  p.landed = true;
  if (p.region === 3) {
    enterEnding(s, p);
    return;
  }
  if (s.ending === "skull" && s.finalRevealed) {
    const holder = s.players.find(
      (q) =>
        q.id === s.endingHolder &&
        !q.dead &&
        q.region === p.region &&
        q.pos === p.pos &&
        q.id !== p.id,
    );
    if (holder) {
      combatStart(s, p, [], holder, false, true);
      return;
    }
  }
  if (
    s.ending === "book" &&
    s.endingHolder === p.id &&
    p.region === 0 &&
    [8, 9, 10].includes(p.pos)
  ) {
    win(s, [p.id]);
    return;
  }
  s.phase = "encounter";
}
function startTurn(s: State) {
  const p = current(s);
  p.used = [];
  p.landed = false;
  p.boost = 0;
  s.trade = null;
  s.roll = null;
  s.choices = [];
  s.encounter = null;
  s.queue = [];
  s.locationDone = false;
  s.wonFiend = false;
  s.peek = null;
  s.turnsTaken[p.id] = (s.turnsTaken[p.id] ?? 0) + 1;
  if ((p.wagonUntil ?? Infinity) < s.turnsTaken[p.id]) delete p.wagonUntil;
  if (p.respawn) {
    Object.assign(
      p,
      p.respawnAt ?? findSpace(character(p.character).startingSpace),
    );
    if (p.casketRecovery && p.items.includes(p.casketRecovery))
      removeCard(s, p, p.casketRecovery);
    delete p.casketRecovery;
    delete p.respawnAt;
    p.respawn = false;
    const allowed = (id: string) =>
      !card(id).allegiance || card(id).allegiance === p.allegiance;
    for (const list of ["items", "homies"] as const) {
      p[list] = p[list].filter((id) => {
        if (id.startsWith("ending-") || allowed(id)) return true;
        discard(s, id);
        return false;
      });
    }
  }
  s.phase = "roll";
  if (p.lootTurns !== undefined) {
    p.lootTurns--;
    if (p.lootTurns < 0) {
      delete p.lootFor;
      delete p.lootTurns;
    }
  }
  addLog(s, `${p.name} begins their turn.`);
  overflow(s, p);
}
function nextTurn(s: State) {
  const p = current(s);
  expireTurnConditions(s, p);
  if (p.extraTurns > 0 && !p.dead && !absent(p)) {
    p.extraTurns--;
    startTurn(s);
    return;
  }
  let attempts = 0;
  const maxAttempts =
    s.players.reduce((n, q) => n + q.skip, 0) + s.players.length + 1;
  do {
    s.turn =
      (s.turn + (s.direction ?? 1) + s.players.length) % s.players.length;
    if (s.turn === 0) s.round++;
    const q = current(s);
    if (absent(q)) {
      attempts++;
      continue;
    }
    if (!q.dead && q.skip > 0) {
      q.skip--;
      addLog(s, `${q.name} misses this turn.`);
    } else if (!q.dead) {
      startTurn(s);
      return;
    }
    attempts++;
  } while (attempts < maxAttempts);
  s.phase = "waiting";
  s.choices = [];
  addLog(s, "The table is waiting for a timed absence to finish.");
}
function playerById(s: State, id?: string) {
  const p = s.players.find(
    (p) => p.id === id && !p.dead && !absent(p) && !p.respawn,
  );
  need(p, "Choose a living player.");
  return p!;
}
function pay(p: Player, n: number) {
  need(p.cash >= n, `You need $${n}.`);
  p.cash -= n;
}
function transfer(
  s: State,
  from: Player,
  to: Player,
  id: string,
  homie = false,
) {
  const key = homie ? "homies" : "items";
  need(from[key].includes(id), "That player no longer has the selected card.");
  const c = id.startsWith("ending-") ? null : card(id);
  need(
    !c?.allegiance || c.allegiance === to.allegiance,
    "That allegiance cannot keep this card.",
  );
  const uses = from.cardUses?.[id];
  if (uses !== undefined) {
    (to.cardUses ??= {})[id] = uses;
    delete from.cardUses![id];
  }
  const temporary = from.temporaryItems?.includes(id);
  from.temporaryItems = from.temporaryItems?.filter((x) => x !== id);
  from[key] = from[key].filter((x) => x !== id);
  receive(s, to, id, homie);
  if (temporary && to.items.includes(id)) (to.temporaryItems ??= []).push(id);
  if (id.startsWith("ending-")) s.endingHolder = to.id;
  overflow(s, to);
}
function checkLoophole(s: State, p: Player) {
  const names = [
    ...p.items.filter((id) => !id.startsWith("ending-")),
    ...p.homies,
  ].map((id) => cardName(id).toLowerCase());
  if (
    ["Rusty Axe", "Voodoo for Morons", "Bridget", "2-liter"].every((n) =>
      names.includes(n.toLowerCase()),
    )
  )
    win(s, [p.id]);
}
function same(p: Player, q: Player) {
  return p.region === q.region && p.pos === q.pos;
}
function adjacent(p: Player, q: { region: number; pos: number }) {
  return (
    p.region < 3 &&
    p.region === q.region &&
    [
      (p.pos + 1) % COUNTS[p.region],
      (p.pos + COUNTS[p.region] - 1) % COUNTS[p.region],
    ].includes(q.pos)
  );
}
function normalName(n: string) {
  return n.toLowerCase().replace(/[’']/g, "").replace(/-/g, " ");
}
function held(p: Player, name: string) {
  return [...p.items, ...p.homies, ...p.bones].some(
    (id) => normalName(cardName(id)) === normalName(name),
  );
}
function shop(s: State, p: Player) {
  return spaceRule(p.region, p.pos)?.effects.find(
    (e: any) => e.type === "shop",
  );
}
function loseTurn(s: State, p: Player) {
  if (has(s, p, "ignore_lost_turn") || held(p, "Noosawaa")) return;
  p.skip++;
  if (p.id === current(s).id) s.phase = "end";
}
function beginRuling(s: State, p: Player, cards: string[], reason: string) {
  const back = s.phase;
  ruling(s, p, cards, reason);
  s.ruling!.returnPhase = back;
}
function acquire(s: State, p: Player, id: string) {
  const c = card(id);
  if (p.lootFor && p.lootTurns === 0) {
    const receiver = s.players.find((q) => q.id === p.lootFor && !q.dead);
    if (receiver) p = receiver;
  }
  if (c.allegiance && c.allegiance !== p.allegiance) {
    addLog(s, `${p.name} cannot keep ${c.name} because of allegiance.`);
    return;
  }
  removeBoard(s, [id]);
  if (held(p, "Karmageddon")) {
    discard(s, id);
    addLog(s, `${c.name} is discarded because of Karmageddon.`);
    return;
  }
  if (c.kind === "cash") {
    p.cash += c.cash ?? 0;
    discard(s, id);
  } else if (c.kind === "homie") receive(s, p, id, true);
  else if (c.kind === "bone") p.bones.push(id);
  else p.items.push(id);
  checkLoophole(s, p);
}
function drawAction(s: State, p: Player, region = p.region) {
  need(region >= 0 && region < 3, "Choose an Action deck.");
  let id = drawId(s, region);
  for (const owner of [p, ...s.players.filter((q) => q.id !== p.id)]) {
    if (owner.dead || owner.respawn || absent(owner)) continue;
    const hat = heldId(owner, "The Witch's Hat");
    if (!hat) continue;
    if (
      ask({
        player: owner.id,
        message: `${p.name} just drew ${cardName(id)}.`,
        choices: [
          { id: "keep", label: "Keep the drawn card" },
          { id: "replace", label: "Use The Witch's Hat · discard and replace" },
        ],
      }) === "replace"
    ) {
      removeCard(s, owner, hat);
      discard(s, id);
      id = drawId(s, region);
      addLog(s, `${owner.name} replaced the Action draw with The Witch's Hat.`);
    }
  }
  s.board[`${p.region}:${p.pos}`] ??= [];
  s.board[`${p.region}:${p.pos}`].push(id);
  s.encounter = id;
  addLog(s, `${p.name} drew ${cardName(id)}.`);
  s.phase = "encounter";
}
function boardEffects(s: State, p: Player, effects: any[], bonus = 0) {
  for (const e of effects) {
    if (p.dead || p.respawn) return;
    switch (e.type) {
      case "draw_action":
        drawAction(s, p);
        break;
      case "life_loss":
        damage(s, p, e.amount);
        break;
      case "heal_life":
        heal(p, e.amount);
        break;
      case "cash_change":
        if (e.amount > 0) gainCash(p, e.amount);
        else p.cash = Math.max(0, p.cash + e.amount);
        break;
      case "combat_bonus_change":
        cb(p, e.amount);
        break;
      case "lose_turn":
        loseTurn(s, p);
        break;
      case "draw_bone":
        drawBone(s, p);
        break;
      case "allegiance_condition":
        boardEffects(
          s,
          p,
          e.branches[
            p.allegiance === "Dark Carnival" ? "darkCarnival" : "nethervoid"
          ],
        );
        break;
      case "roll_table": {
        const r = nonCombatDie(s, p) + bonus;
        s.lastDice = [r];
        addLog(s, `${spaceName(p.region, p.pos)}: ${p.name} rolled ${r}.`);
        const row = e.outcomes.find((x: any) =>
          x.rolls.includes(Math.min(6, r)),
        );
        if (row) boardEffects(s, p, row.effects);
        else
          ruling(
            s,
            p,
            [],
            `The modified roll ${r} has no printed result at ${spaceName(p.region, p.pos)}. Agree on this undefined result before continuing.`,
          );
        break;
      }
      case "relocate":
        if (e.destination === "character_starting_space") {
          Object.assign(p, findSpace(character(p.character).startingSpace));
          arrive(s, p);
        } else if (e.destination === "shangriLa") {
          p.region = 3;
          p.pos = 0;
          enterEnding(s, p);
        } else
          ruling(
            s,
            p,
            [],
            `Location roll requires relocation. ${spaceRule(p.region, p.pos)?.rules} Use the table controls to choose the required destination, then finish.`,
          );
        break;
      case "discard_homie":
      case "discard_item":
        ruling(
          s,
          p,
          [],
          `Discard one ${e.type === "discard_item" ? "Item" : "Homie"} of your choice, if you have one.`,
        );
        break;
      case "assassination_contract":
      case "mirror_roll_duel":
        ruling(
          s,
          p,
          [],
          spaceRule(p.region, p.pos)?.rules ?? "Resolve this location.",
        );
        break;
    }
  }
  endCheck(s);
}
function resolveCard(s: State, p: Player) {
  const id = s.encounter;
  need(id, "There is no pending card.");
  const c = card(id!);
  if (c.kind === "fiend") {
    combatStart(s, p, [id!]);
    return;
  }
  if (["cash", "item", "homie"].includes(c.kind) && c.automatic) {
    acquire(s, p, id!);
    afterEncounter(s);
    return;
  }
  ruling(s, p, [id!], `${c.name}: ${c.rules}`);
}
function combatChoice(s: State, p: Player, a: Action) {
  const f = s.combat!;
  need(
    f && (p.id === f.attacker || p.id === f.defender),
    "You are not a combatant.",
  );
  need(!f.choices[p.id], "Your combat choice is already locked.");
  const weapon = a.weapon ?? null;
  need(
    !weapon || (p.items.includes(weapon) && card(weapon).weapon),
    "Choose a Weapon you hold.",
  );
  need(
    !weapon || (!held(p, "Slippery Palms") && !held(p, "Officer Harry Cox")),
    "Slippery Palms or Officer Harry Cox prevents Weapon use.",
  );
  need(
    !f.ranged || p.id !== f.attacker || (weapon && card(weapon).ranged),
    "A ranged attack requires a ranged Weapon.",
  );
  need(
    !a.finisher || (!f.defender && has(s, p, "fiend_finishing_move")),
    "That finishing power is unavailable.",
  );
  need(
    !a.escape || has(s, p, "escape_attempt"),
    "That escape power is unavailable.",
  );
  need(
    !a.suppress || has(s, p, "suppress_opponent_homies"),
    "That power is unavailable.",
  );
  need(
    !a.defense ||
      (p.items.includes(a.defense) && card(a.defense).use === "armor"),
    "Choose an armor Item you hold.",
  );
  if (a.drink) {
    need(
      p.items.includes(a.drink) && card(a.drink).use === "drink",
      "Choose a 2-liter you hold.",
    );
    removeCard(s, p, a.drink);
    p.boost += 2;
  }
  const modifier = integer(a.modifier ?? 0, -100, 100);
  if (modifier)
    need(
      typeof a.reason === "string" && a.reason.trim().length >= 3,
      "Name the card or rule for this combat modifier.",
    );
  if (modifier)
    addLog(
      s,
      `${p.name} applies combat modifier ${modifier}: ${a.reason!.slice(0, 200)}`,
    );
  f.choices[p.id] = {
    weapon,
    finisher: !!a.finisher,
    escape: !!a.escape,
    suppress: !!a.suppress,
    drink: a.drink ?? null,
    defense: a.defense ?? null,
    modifier,
  };
  if (f.choices[f.attacker] && (!f.defender || f.choices[f.defender]))
    rollCombat(s);
}
function possessionOptions(s: State, p: Player): Option[] {
  if (
    s.status !== "playing" ||
    p.dead ||
    p.respawn ||
    absent(p) ||
    s.flow ||
    s.itemPrompt ||
    s.decision ||
    s.endingPending
  )
    return [];
  const own = current(s).id === p.id,
    free =
      own && ["roll", "move", "encounter", "end", "ending"].includes(s.phase);
  const f = s.combat,
    combat = !!f && [f.attacker, f.defender].includes(p.id) && !f.choices[p.id];
  const other = s.players.filter(
    (q) => q.id !== p.id && !q.dead && !q.respawn && !absent(q),
  );
  const out: Option[] = [];
  const add = (id: string, label: string, rest: Partial<Action> = {}) =>
    out.push({
      label,
      action: { type: "item-use", item: id, ...rest },
      group: "Items & Homies",
    });
  for (const id of [...p.items, ...p.homies]) {
    if (id.startsWith("ending-")) continue;
    const n = cardName(id);
    if (card(id).allegiance && card(id).allegiance !== p.allegiance) continue;
    if (combat) {
      if (
        n === "Spider" &&
        p.cash >= 100 &&
        !f!.boosts?.[p.id]?.includes("Spider")
      )
        add(id, "Spider · pay $100 for +2");
      if (n === "Face Paint" || n === "Ghost of Dolemite")
        add(id, `Use ${n} · +3 and discard`);
      if (
        n === "Mr. Johnson's Head" &&
        f!.defender &&
        !f!.mortal &&
        !f!.forceWinner
      )
        add(id, `Use ${n} · automatic win`);
      if (n === "Fat Tittie Kittie" && f!.defender === p.id && !f!.mortal)
        add(id, "Fat Tittie Kittie · tie and transfer");
      if (
        n === "The Human Highlight Reel" &&
        !f!.defender &&
        !f!.ending &&
        f!.cards.length === 1
      )
        add(id, "Human Highlight Reel · defeat Fiend without reward");
      if (
        n === "The Green Book" &&
        !f!.defender &&
        !f!.ending &&
        f!.cards.length === 1
      )
        for (const q of other.filter((q) => q.region !== 3))
          add(id, `The Green Book · redirect Fiend to ${q.name}`, {
            target: q.id,
          });
    }
    if (
      n === "Masked Negotiator" &&
      [
        "roll",
        "move",
        "encounter",
        "end",
        "overflow",
        "combat",
        "penalty",
        "ruling",
        "ending",
      ].includes(s.phase)
    )
      for (const sale of [...p.items, ...p.homies].filter(
        (id) => !protectedItem(p, id),
      ))
        add(id, `Sell ${cardName(sale)} · $100`, { choice: sale });
    if (!free) continue;
    if (s.phase === "roll") {
      if (
        ["Health Insurance Card", "The Book of Life"].includes(n) &&
        p.life < p.maxLife
      )
        add(id, `Use ${n} · heal and discard`);
      if (n === "Morton's List" || n === "Wagon")
        add(id, `Use ${n} · consecutive turns`);
      if (
        n === "’84 Regal" &&
        !held(p, "Unclear title · card 3300") &&
        p.region < 3
      )
        add(id, "’84 Regal · move 1 or 2 spaces");
    }
    if (["Circus Tent", "Milenko's Hat", "The Cryptic List"].includes(n))
      add(id, `Use ${n} · roll d6`);
    if (
      n === "Cotton Candy" &&
      [...p.bones, ...p.items.filter((x) => card(x).deck === "bone")].length
    )
      add(id, "Cotton Candy · remove all Bones");
    if (n === "Mirror Mirror")
      for (const q of other.filter((q) => q.bonus > 0))
        add(id, `Mirror Mirror · take 1 base CB from ${q.name}`, {
          target: q.id,
        });
    if (n === "Voodoo Doll")
      for (const q of other)
        add(id, `Voodoo Doll · ${q.name} draws a Bone`, { target: q.id });
    if (n === "Voodoo for Morons")
      for (const bone of [
        ...p.bones,
        ...p.items.filter((x) => card(x).deck === "bone"),
      ])
        for (const q of other)
          add(id, `Transfer ${cardName(bone)} to ${q.name}`, {
            choice: bone,
            target: q.id,
          });
    if (n === "Twilight Scroll")
      for (const take of s.discards
        .flat()
        .filter((x) => card(x).kind === "item"))
        add(id, `Twilight Scroll · take ${cardName(take)}`, { choice: take });
    if (n === "Dr. Dinglenut" && (p.cardUses?.[id] ?? 0) < 3)
      for (const take of s.purchase.filter(
        (x, i, a) => a.findIndex((y) => card(y).key === card(x).key) === i,
      ))
        add(id, `Dr. Dinglenut · borrow ${cardName(take)}`, { choice: take });
    if (
      ["PuBu Gear", "Preacherman"].includes(n) &&
      p.landed &&
      s.phase === "encounter" &&
      !s.encounter &&
      !s.locationDone
    )
      for (const q of other.filter((q) => same(p, q)))
        for (const homie of q.homies.filter(
          (h) => !card(h).allegiance || card(h).allegiance === p.allegiance,
        ))
          add(id, `${n} · take ${cardName(homie)} from ${q.name}`, {
            target: q.id,
            choice: homie,
          });
    const at = spaceName(p.region, p.pos);
    if (
      (n === "Steve at the Office" && at === "Psychopathic Records") ||
      (n === "Hype Engine" && at === "Oz") ||
      (n === "Officer Harry Cox" && at === "Chaos District") ||
      (n === "Fat Sweaty Betty" && at === "Halls of Illusions")
    )
      add(id, `Resolve ${n} here`);
  }
  return out;
}
function possessionAction(s: State, p: Player, a: Action) {
  need(
    possessionOptions(s, p).some((o) =>
      Object.entries(o.action).every(([k, v]) => (a as any)[k] === v),
    ),
    "That card cannot be used at this time or on that target.",
  );
  const id = a.item!,
    name = cardName(id),
    q = a.target ? playerById(s, a.target) : undefined;
  const consume = () => {
    if ([...p.items, ...p.homies].includes(id)) removeCard(s, p, id);
  };
  const f = s.combat;
  switch (name) {
    case "Spider":
      pay(p, 100);
      p.boost += 2;
      (f!.boosts ??= {})[p.id] = [...(f!.boosts?.[p.id] ?? []), "Spider"];
      break;
    case "Face Paint":
    case "Ghost of Dolemite":
      p.boost += 3;
      consume();
      break;
    case "Mr. Johnson's Head":
      f!.forceWinner = p.id;
      consume();
      break;
    case "Fat Tittie Kittie":
      transfer(s, p, s.players.find((q) => q.id === f!.attacker)!, id, true);
      s.combat = null;
      s.phase = "end";
      break;
    case "The Human Highlight Reel": {
      const fiends = [...f!.cards];
      for (const c of fiends) {
        removeBoard(s, [c]);
        discard(s, c);
      }
      consume();
      s.combat = null;
      s.encounter = null;
      s.queue = [];
      s.phase = "end";
      if (fiends.some((c) => !card(c).automatic))
        ruling(
          s,
          p,
          fiends,
          "The Human Highlight Reel defeated this Fiend without Combat Bonus. Apply any remaining printed defeat effect.",
        );
      break;
    }
    case "The Green Book": {
      const cards = [...f!.cards],
        at = { region: f!.region, pos: f!.pos };
      consume();
      combatStart(s, q!, cards, undefined, false, false, at);
      s.combat!.redirectedBy = p.id;
      break;
    }
    case "Masked Negotiator":
      removeCard(s, p, a.choice!);
      gainCash(p, 100);
      if (s.overflow?.player === p.id && p.items.length <= capacity(p)) {
        s.phase = s.overflow.returnPhase;
        s.overflow = null;
      }
      break;
    case "Health Insurance Card":
      heal(p, 1);
      consume();
      break;
    case "The Book of Life":
      heal(p, p.maxLife);
      consume();
      break;
    case "Morton's List":
      p.extraTurns += 2;
      consume();
      break;
    case "Wagon":
      p.extraTurns++;
      p.wagonUntil = (s.turnsTaken[p.id] ?? 0) + 1;
      consume();
      break;
    case "’84 Regal":
      s.choices = [...destinations(p, 1, s), ...destinations(p, 2, s)].filter(
        (d, i, a) =>
          a.findIndex((x) => x.region === d.region && x.pos === d.pos) === i,
      );
      s.phase = "move";
      usedItem(s, p, id);
      break;
    case "Cotton Candy":
      for (const bone of [
        ...p.bones,
        ...p.items.filter((x) => card(x).deck === "bone"),
      ])
        removeCard(s, p, bone);
      consume();
      break;
    case "Mirror Mirror":
      cb(q!, -1);
      cb(p, 1);
      consume();
      break;
    case "Voodoo Doll":
      consume();
      drawBone(s, q!);
      break;
    case "Voodoo for Morons": {
      const bone = a.choice!,
        condition = p.conditions?.[bone];
      removeCard(s, p, bone);
      s.boneDiscard = s.boneDiscard.filter((x) => x !== bone);
      consume();
      if (has(s, q!, "ignore_bones") || held(q!, "Noosawaa")) discard(s, bone);
      else {
        q![card(bone).kind === "item" ? "items" : "bones"].push(bone);
        if (condition) {
          const copy = { ...condition };
          if (copy.expiresAfterTurn !== undefined)
            copy.expiresAfterTurn =
              (s.turnsTaken[q!.id] ?? 0) +
              Math.max(0, copy.expiresAfterTurn - (s.turnsTaken[p.id] ?? 0));
          if (copy.controller)
            copy.controller =
              s.players[(s.players.indexOf(q!) + 1) % s.players.length].id;
          (q!.conditions ??= {})[bone] = copy;
        }
        overflow(s, q!);
      }
      break;
    }
    case "Twilight Scroll":
      s.discards = s.discards.map((d) => d.filter((x) => x !== a.choice));
      consume();
      receive(s, p, a.choice!);
      overflow(s, p);
      break;
    case "Dr. Dinglenut":
      s.purchase = s.purchase.filter((x) => x !== a.choice);
      receive(s, p, a.choice!);
      if (p.items.includes(a.choice!))
        (p.temporaryItems ??= []).push(a.choice!);
      p.cardUses ??= {};
      p.cardUses[id] = (p.cardUses[id] ?? 0) + 1;
      if (p.cardUses[id] >= 3) consume();
      overflow(s, p);
      break;
    case "PuBu Gear":
    case "Preacherman":
      transfer(s, q!, p, a.choice!, true);
      consume();
      break;
    case "Steve at the Office":
    case "Hype Engine":
    case "Officer Harry Cox":
    case "Fat Sweaty Betty":
      delivery(s, p);
      break;
    case "Circus Tent": {
      const r = nonCombatDie(s, p);
      s.lastDice = [r];
      consume();
      if (r === 6) {
        win(s, [p.id]);
        break;
      }
      if (r === 1 || r === 5) p.cash = 0;
      if (r === 2 || r === 5) loseAll(s, p, "homies");
      if (r === 3 || r === 5) loseAll(s, p, "items");
      if (r === 4 || r === 5) damage(s, p, 2);
      if (r < 1 || r > 6)
        ruling(
          s,
          p,
          [],
          `Circus Tent has no printed result for modified roll ${r}. Resolve with the table.`,
        );
      break;
    }
    case "The Cryptic List": {
      const r = nonCombatDie(s, p);
      s.lastDice = [r];
      consume();
      const names = [
        "Clark Park",
        "Yellow Brick Alleyway",
        "Hell's Pit",
        "Fun House",
        "House of Horrors",
      ];
      if (r >= 1 && r <= 6) {
        Object.assign(
          p,
          r === 6 ? { region: 3, pos: 0 } : findSpace(names[r - 1]),
        );
        s.encounter = null;
        s.queue = [];
        s.locationDone = false;
        arrive(s, p);
      } else
        ruling(
          s,
          p,
          [],
          `The Cryptic List has no printed result for modified roll ${r}. Resolve with the table.`,
        );
      break;
    }
    case "Milenko's Hat": {
      const r = nonCombatDie(s, p);
      s.lastDice = [r];
      consume();
      if (r >= 1 && r <= 2) damage(s, p, 1);
      else if (r <= 4 && r >= 3) cb(p, 1);
      else if (r === 5 || r === 6) {
        if (
          s.players.some(
            (q) =>
              q.id !== p.id &&
              !q.dead &&
              !q.respawn &&
              !absent(q) &&
              q.region !== 3,
          )
        )
          s.itemPrompt = {
            player: p.id,
            kind: "teleport",
            returnPhase: s.phase,
          };
        else addLog(s, "No eligible Milenko’s Hat target remains.");
      } else
        ruling(
          s,
          p,
          [],
          `Milenko's Hat has no printed result for modified roll ${r}. Resolve with the table.`,
        );
      break;
    }
    default:
      throw Error("This card has no automated action.");
  }
  if (p.respawn || p.dead) {
    if (current(s).id === p.id) s.phase = "end";
  }
  addLog(s, `${p.name} used ${name}.`);
  checkLoophole(s, p);
  endCheck(s);
}
function prepareMovement(
  s: State,
  p: Player,
  raw: number,
  total: number,
  power = true,
) {
  if (raw === 6) {
    const concussion = boneId(p, "Concussion");
    if (concussion) removeCard(s, p, concussion);
  }
  s.roll = Math.max(1, total - movementPenalty(p));
  s.choices = destinations(p, s.roll, s);
  if (power && s.roll === 6) {
    if (has(s, p, "movement_six_teleport"))
      for (let pos = 0; pos < COUNTS[p.region]; pos++)
        s.choices.push({
          region: p.region,
          pos,
          toll: 0,
          reason: "Magic Ninja",
        });
    if (has(s, p, "movement_six_visit_player"))
      for (const q of s.players.filter(
        (q) =>
          q.id !== p.id &&
          !q.dead &&
          !q.respawn &&
          !absent(q) &&
          q.region !== 3,
      ))
        s.choices.push({
          region: q.region,
          pos: q.pos,
          toll: 0,
          reason: "Monoxide",
        });
  }
  s.choices = [
    ...new Map(
      s.choices.map((d) => [`${d.region}:${d.pos}:${d.itemToll ?? false}`, d]),
    ).values(),
  ];
  s.phase = s.choices.length ? "move" : "end";
}

function powerAction(s: State, p: Player, a: Action) {
  const key = a.power!;
  need(has(s, p, key), "This power is unavailable.");
  need(!p.used.includes(key), "That power has already been used this turn.");
  const q = a.target ? playerById(s, a.target) : null;
  const start = () =>
    need(s.phase === "roll", "Use this power at the start of your turn.");
  const costHomies = (n: number) => {
    const list = a.cards ?? [];
    need(
      list.length === n &&
        new Set(list).size === n &&
        list.every((id) => p.homies.includes(id)),
      `Choose ${n} different Homies.`,
    );
    for (const id of list) removeCard(s, p, id);
  };
  switch (key) {
    case "change_allegiance":
      need(
        ["Dark Carnival", "Nethervoid"].includes(a.allegiance!),
        "Choose an allegiance.",
      );
      p.allegiance = a.allegiance!;
      for (const id of [...p.items, ...p.homies])
        if (card(id).allegiance && card(id).allegiance !== p.allegiance)
          removeCard(s, p, id);
      break;
    case "consume_homies":
      start();
      need(a.item && p.homies.includes(a.item), "Choose a Homie.");
      removeCard(s, p, a.item!);
      heal(p, 1);
      break;
    case "sacrifice_for_training":
      start();
      costHomies(2);
      cb(p, 1);
      break;
    case "rebuild_homie":
      start();
      need(
        a.item &&
          s.discards.flat().includes(a.item) &&
          card(a.item).kind === "homie" &&
          !a.cards?.includes(a.item),
        "Choose a different discarded Homie.",
      );
      costHomies(2);
      s.discards = s.discards.map((d) => d.filter((id) => id !== a.item));
      receive(s, p, a.item!, true);
      break;
    case "steal_homie":
    case "steal_item":
    case "steal_vehicle":
    case "take_female_homies":
      need(
        q && q.id !== p.id && same(p, q),
        "Choose another player sharing your space.",
      );
      need(a.item, "Choose a card.");
      if (key === "steal_vehicle")
        need(
          p.items.some((id) => card(id).weapon) && card(a.item!).vehicle,
          "You need a Weapon and must choose a vehicle.",
        );
      if (key === "take_female_homies")
        need(
          card(a.item!).female,
          "Use a table ruling for Homies whose gender is not verified.",
        );
      {
        const r = ["steal_item", "steal_homie"].includes(key)
          ? nonCombatDie(s, p, 10)
          : 10;
        addLog(s, `${p.name}: ${key.replaceAll("_", " ")} ${r}.`);
        if (r >= 8)
          transfer(
            s,
            q!,
            p,
            a.item!,
            key === "steal_homie" || key === "take_female_homies",
          );
        p.used.push(key);
      }
      break;
    case "take_cash":
      need(
        q && q.id !== p.id && same(p, q),
        "Choose another player sharing your space.",
      );
      {
        const n = Math.min(100, q!.cash);
        q!.cash -= n;
        gainCash(p, n);
        p.used.push(key);
      }
      break;
    case "purchase_extra_turn":
      pay(p, 200);
      p.extraTurns++;
      break;
    case "paid_training":
      pay(p, 300);
      cb(p, 1);
      loseTurn(s, p);
      break;
    case "bribe_fiend":
      need(
        s.phase === "combat" && !s.combat?.defender && p.region !== 3,
        "Use before a Fiend combat outside Shangri-La.",
      );
      pay(p, 100);
      s.combat = null;
      s.encounter = null;
      s.phase = "end";
      break;
    case "evade_on_common_spaces":
      need(
        s.phase === "combat" &&
          ["City", "Alleyway", "Cave", "Tunnels"].includes(
            spaceName(p.region, p.pos),
          ),
        "This space does not allow that evasion.",
      );
      s.combat = null;
      s.encounter = null;
      s.phase = "end";
      break;
    case "dismiss_named_fiends":
      need(
        s.phase === "combat" &&
          s.combat!.cards.every((id) =>
            [
              "Ape Boy",
              "Big Stank and Li’l Poot",
              "Bootleg Greg",
              "Father Duckett",
              "Green Willy",
              "Sweets' Guard",
            ].includes(cardName(id)),
          ),
        "This Fiend is not on the dismissal list.",
      );
      s.combat = null;
      s.encounter = null;
      s.phase = "end";
      break;
    case "fiend_victory_extra_turn":
      need(s.wonFiend, "Defeat a Fiend first.");
      {
        const r = nonCombatDie(s, p, 10);
        s.lastDice = [r];
        if (r >= 6) p.extraTurns++;
        p.used.push(key);
        addLog(s, `${p.name} rolled ${r} for an extra turn.`);
      }
      break;
    case "cash_in_homies":
      need(a.item && p.homies.includes(a.item), "Choose a Homie.");
      removeCard(s, p, a.item!);
      {
        const r = nonCombatDie(s, p);
        s.lastDice = [r];
        gainCash(p, Math.ceil(r / 2) * 100);
      }
      break;
    case "redirect_next_turn_loot":
      need(
        q && q.id !== p.id && same(p, q),
        "Choose another player sharing your space.",
      );
      {
        const r = nonCombatDie(s, p, 10);
        s.lastDice = [r];
        if (r >= 6) {
          q!.lootFor = p.id;
          q!.lootTurns = 1;
        }
        p.used.push(key);
        addLog(
          s,
          `${p.name} rolled ${r} to redirect ${q!.name}'s next-turn acquisitions.`,
        );
      }
      break;
    case "replace_event":
      need(
        s.encounter && card(s.encounter).kind === "event",
        "Draw an Event first.",
      );
      removeBoard(s, [s.encounter!]);
      discard(s, s.encounter!);
      p.used.push(key);
      drawAction(s, p);
      break;
    case "ignore_event_effect":
      need(
        s.encounter && card(s.encounter).kind === "event",
        "Draw an Event first.",
      );
      removeBoard(s, [s.encounter!]);
      discard(s, s.encounter!);
      afterEncounter(s);
      break;
    default:
      beginRuling(s, p, [], powers(s, p).find((x) => x.id === key)!.summary);
      break;
  }
  addLog(s, `${p.name} used ${key.replaceAll("_", " ")}.`);
  checkLoophole(s, p);
}
function applyRuling(s: State, actor: Player, a: Action) {
  need(s.ruling, "No table ruling is open.");
  need(
    actor.id === s.ruling!.actor || actor.id === s.host,
    "Only the resolving player or host may apply this ruling.",
  );
  const p = a.target ? playerById(s, a.target) : playerById(s, s.ruling!.actor);
  need(
    typeof a.reason === "string" && a.reason.trim().length >= 3,
    "Name the rule behind this table action.",
  );
  const note = a.reason!.trim().slice(0, 240);
  switch (a.stat) {
    case "life": {
      const n = integer(a.amount, -20, 20);
      if (n < 0) damage(s, p, -n);
      else heal(p, n);
      break;
    }
    case "cash": {
      const amount = integer(a.amount, -1000000, 1000000);
      if (amount > 0) gainCash(p, amount);
      else p.cash = Math.max(0, p.cash + amount);
      break;
    }
    case "bonus":
      cb(p, integer(a.amount, -100, 100));
      break;
    case "skip":
      p.skip = Math.max(0, p.skip + integer(a.amount, -10, 10));
      break;
    case "extra":
      p.extraTurns = Math.max(0, p.extraTurns + integer(a.amount, -10, 10));
      break;
    case "boost":
      p.boost += integer(a.amount, -100, 100);
      break;
    case "note":
      p.notes = note;
      break;
    case "move":
      integer(a.region, 0, 3);
      integer(a.pos, 0, a.region === 3 ? 0 : COUNTS[a.region!] - 1);
      p.region = a.region!;
      p.pos = a.pos!;
      break;
    case "discard":
      need(a.item, "Choose a held card.");
      removeCard(s, p, a.item!);
      break;
    case "transfer": {
      const q = playerById(s, a.choice);
      need(a.item, "Choose a card.");
      transfer(s, p, q, a.item!, p.homies.includes(a.item!));
      break;
    }
    case "draw":
      if (a.deck === "bone") {
        drawBone(s, p);
      } else {
        const region = integer(a.deck, 0, 2),
          id = drawId(s, region);
        s.board[`${p.region}:${p.pos}`] ??= [];
        s.board[`${p.region}:${p.pos}`].push(id);
        s.queue.push(id);
        addLog(s, `${p.name} drew ${cardName(id)}: ${card(id).rules}`);
      }
      break;
    case "retrieve": {
      need(a.item, "Choose a card.");
      const id = a.item!;
      need(
        s.discards.flat().includes(id) || s.purchase.includes(id),
        "That card is unavailable.",
      );
      s.discards = s.discards.map((d) => d.filter((x) => x !== id));
      s.purchase = s.purchase.filter((x) => x !== id);
      if (card(id).kind === "homie") receive(s, p, id, true);
      else {
        need(
          card(id).kind === "item",
          "Only Items or Homies may be retrieved.",
        );
        receive(s, p, id);
      }
      break;
    }
    case "eliminate":
      death(s, p, true);
      break;
    case "win": {
      const winners = a.winners ?? [p.id];
      need(
        Array.isArray(winners) &&
          winners.length > 0 &&
          winners.length <= s.players.length &&
          new Set(winners).size === winners.length &&
          winners.every((id) => s.players.some((q) => q.id === id && !q.dead)),
        "Choose living winners.",
      );
      win(s, winners);
      break;
    }
    case "reverse":
      s.direction = s.direction === -1 ? 1 : -1;
      break;
    default:
      throw new Error("Choose a supported table action.");
  }
  if (s.ruling) s.ruling.changes++;
  addLog(
    s,
    `${actor.name} resolves ${a.stat} for ${p.name}${a.amount !== undefined ? ` (${a.amount > 0 ? "+" : ""}${a.amount})` : ""}: ${note}`,
  );
  endCheck(s);
}
export function applyAction(s: State, actorId: string, a: Action) {
  if (s.flow) {
    const flow = structuredClone(s.flow),
      p = s.players.find((p) => p.id === flow.prompt.player),
      auth = s.players.find((p) => p.id === actorId);
    need(
      a.type === "card-response" &&
        p &&
        auth &&
        !absent(auth) &&
        canControl(s, actorId, p),
      "Finish the pending card choice with its controlling player.",
    );
    need(
      flow.prompt.choices.some((c) => c.id === a.choice),
      "Choose one of the displayed responses.",
    );
    flow.answers.push(a.choice!);
    transaction(
      s,
      flow.actor,
      flow.action,
      () => {
        applyCore(s, flow.actor, flow.action);
        finishCombatCosts(s);
      },
      flow,
    );
  } else
    transaction(s, actorId, a, () => {
      applyCore(s, actorId, a);
      finishCombatCosts(s);
    });
}
function finishCombatCosts(s: State) {
  if (s.penalty || !s.recoil?.length) return;
  const ids = [...s.recoil];
  delete s.recoil;
  for (const cost of ids) {
    const p = s.players.find((p) => p.id === cost.player)!;
    damage(s, p, 1, cost.mortal);
    addLog(
      s,
      `${p.name} lost 1 Life from Rocket Launcher's point-blank blast.`,
    );
  }
  if (
    s.combat &&
    s.players.some(
      (p) =>
        [s.combat!.attacker, s.combat!.defender].includes(p.id) &&
        (p.dead || p.respawn),
    )
  ) {
    s.combat = null;
    s.phase = "end";
  }
  if (s.pendingVictory) {
    const winners = s.pendingVictory.filter((id) =>
      s.players.some((p) => p.id === id && !p.dead && !p.respawn),
    );
    delete s.pendingVictory;
    if (winners.length) win(s, winners);
  }
  endCheck(s);
}
function applyCore(s: State, actorId: string, a: Action) {
  need(
    s.rulesVersion === 3,
    "This saved prototype uses the old rules. Create a new corrected table.",
  );
  tick(s);
  const authenticated = s.players.find((p) => p.id === actorId);
  need(authenticated, "Join the table first.");
  let p = s.players.find((p) => p.id === (a.actor ?? actorId))!;
  need(p, "Choose your controlled seat.");
  if (s.status === "lobby")
    need(p.id === actorId, "Lobby choices belong to your own seat.");
  else
    need(
      canControl(s, actorId, p),
      "This seat is controlled by another player.",
    );
  need(
    (a.type === "end" && p.id === current(s).id) ||
      (!absent(authenticated!) && !absent(p)),
    "King High Bone prevents participation until its ten-minute timer ends.",
  );
  if (s.status === "lobby") {
    switch (a.type) {
      case "ready":
        p.ready = !p.ready;
        return;
      case "character":
        need(
          a.character &&
            !s.players.some(
              (q) => q.id !== p.id && q.character === a.character,
            ),
          "Choose an available character.",
        );
        {
          const n = newPlayer(
            p.session,
            p.name,
            a.character!,
            s.players.indexOf(p),
          );
          Object.assign(p, n, { id: p.id, ready: p.ready, bot: p.bot });
          return;
        }
      case "add-bot":
        need(
          p.id === s.host && s.players.length < 6,
          "Only the host may add an open seat.",
        );
        {
          const c = CHARACTERS.find(
            (c) => !s.players.some((q) => q.character === c),
          )!;
          const b = newPlayer(
            "bot-" + crypto.randomUUID(),
            "Practice opponent",
            c,
            s.players.length,
          );
          b.bot = true;
          b.ready = true;
          s.players.push(b);
          return;
        }
      case "start":
        need(p.id === s.host, "Only the host starts the game.");
        need(
          s.players.length >= 2 && s.players.every((q) => q.ready),
          "At least two ready players are required.",
        );
        for (const q of s.players) {
          q.items = [];
          for (const item of character(q.character).startingItems) {
            const id = takePurchase(s, item);
            need(
              id,
              `This recovered inventory has no ${item} left for setup. Choose a different character combination.`,
            );
            q.items.push(id!);
          }
        }
        {
          let tied = s.players;
          do {
            const rolls = tied.map((q) => ({ q, r: dice(10) }));
            for (const { q, r } of rolls) {
              s.firstRolls[q.id] = r;
              addLog(s, `${q.name} rolled ${r} for first turn.`);
            }
            const high = Math.max(...rolls.map((x) => x.r));
            tied = rolls.filter((x) => x.r === high).map((x) => x.q);
          } while (tied.length > 1);
          s.turn = s.players.findIndex((q) => q.id === tied[0].id);
        }
        s.status = "playing";
        startTurn(s);
        return;
      default:
        throw new Error("That action is unavailable in the lobby.");
    }
  }
  need(s.status === "playing", "This game has finished.");
  if (a.type === "wake") {
    tick(s);
    return;
  }
  if (s.itemPrompt) {
    const prompt = s.itemPrompt;
    need(prompt.player === p.id, "Wait for the card choice.");
    if (prompt.kind === "movement") {
      need(a.type === "movement-choice", "Choose one movement die.");
      const i = integer(a.amount, 0, prompt.values!.length - 1);
      delete s.itemPrompt;
      prepareMovement(s, p, prompt.raw![i], prompt.values![i]);
    } else {
      need(
        a.type === "item-teleport",
        "Choose a teleport target and destination.",
      );
      const q = playerById(s, a.target);
      need(
        q.id !== p.id && q.region !== 3,
        "Choose another player outside Shangri-La.",
      );
      integer(a.region, 0, 3);
      integer(a.pos, 0, a.region === 3 ? 0 : COUNTS[a.region!] - 1);
      delete s.itemPrompt;
      s.phase = prompt.returnPhase;
      q.region = a.region!;
      q.pos = a.pos!;
      cureOnArrival(s, q);
      delivery(s, q);
      addLog(
        s,
        `${p.name} teleported ${q.name} to ${spaceName(q.region, q.pos)}.`,
      );
      beginRuling(
        s,
        p,
        [],
        `Milenko's Hat moved ${q.name} to ${spaceName(q.region, q.pos)}. Confirm any off-turn arrival effects with the table before continuing.`,
      );
    }
    return;
  }
  if (s.endingPending) {
    need(
      s.endingPending === p.id &&
        ["ending-accept", "ending-replace"].includes(a.type),
      "Resolve the newly revealed ending before other actions.",
    );
    if (a.type === "ending-replace") {
      const ring = p.items.find((id) => cardName(id) === "Psychopathic Ring");
      need(ring && s.endingPool.length, "No replacement is available.");
      removeCard(s, p, ring!);
      (s.endingDiscard ??= []).push(s.ending);
      s.ending = shuffle(s.endingPool).pop()!;
      s.endingProgress = {};
      addLog(
        s,
        `${p.name} used Psychopathic Ring. The replacement is ${ENDINGS.find((e) => e.id === s.ending)?.name}; it must be accepted.`,
      );
    }
    s.endingPending = null;
    enterEnding(s, p);
    endCheck(s);
    return;
  }
  if (s.decision) {
    const d = s.decision;
    need(
      d.actor === p.id && a.type === "bone-decision",
      "Finish the pending Bone choice first.",
    );
    s.decision = null;
    s.phase = d.returnPhase;
    if (d.kind === "bone-draw") {
      if (a.choice === "skateboard") {
        need(held(p, "Skateboard"), "The Skateboard is no longer available.");
        const skate = heldId(p, "Skateboard")!;
        const r = nonCombatDie(s, p, 10);
        usedItem(s, p, skate);
        s.lastDice = [r];
        addLog(s, `${p.name} rolled ${r} with Skateboard.`);
        if (r >= 4) return;
      } else need(a.choice === "draw", "Choose whether to use Skateboard.");
      drawBone(s, p, true);
    } else {
      const q = playerById(s, a.target);
      need(q.id !== p.id, "Choose another player.");
      drawBone(s, q);
    }
    return;
  }
  if (a.type === "item-use") {
    possessionAction(s, p, a);
    return;
  }
  if (a.type === "combat-choice") {
    combatChoice(s, p, a);
    return;
  }
  if (a.type === "penalty") {
    need(
      s.phase === "penalty" && s.penalty?.winner === p.id,
      "The combat winner chooses the penalty.",
    );
    const q = playerById(s, s.penalty!.loser);
    switch (a.choice) {
      case "life": {
        const n = spaceRule(q.region, q.pos)?.effects.some(
          (e: any) => e.type === "combat_loss_life_replacement",
        )
          ? 2
          : 1;
        const lost = combatDamage(s, q, n, false, s.penalty!.defense);
        if (lost && has(s, p, "drain_life")) heal(p, 1);
        break;
      }
      case "cash": {
        const n = Math.min(300, q.cash);
        q.cash -= n;
        gainCash(p, n);
        break;
      }
      case "item":
        need(a.item, "Choose an Item.");
        transfer(s, q, p, a.item!);
        break;
      case "homie":
        need(a.item && q.homies.includes(a.item), "Choose a Homie.");
        removeCard(s, q, a.item!);
        break;
      default:
        throw new Error("Choose a penalty.");
    }
    addLog(
      s,
      `${p.name} chose ${a.choice} as the combat penalty for ${q.name}.`,
    );
    s.penalty = null;
    s.phase = "end";
    overflow(s, p);
    endCheck(s);
    return;
  }
  if (a.type === "trade-accept" || a.type === "trade-decline") {
    need(s.trade && s.trade.to === p.id, "No offer is addressed to you.");
    const t = s.trade!,
      q = playerById(s, t.from);
    if (a.type === "trade-accept") {
      need(same(p, q), "You must share a space.");
      need(
        q.cash >= t.giveCash && p.cash >= t.askCash,
        "The offered Cash is no longer available.",
      );
      need(
        !t.give || !protectedItem(q, t.give),
        "The offered Item cannot leave its holder.",
      );
      need(
        !t.ask || !protectedItem(p, t.ask),
        "The requested Item cannot leave its holder.",
      );
      if (t.give) transfer(s, q, p, t.give);
      if (t.ask) transfer(s, p, q, t.ask);
      q.cash -= t.giveCash;
      p.cash -= t.askCash;
      gainCash(q, t.askCash);
      gainCash(p, t.giveCash);
      addLog(s, `${p.name} accepted ${q.name}'s trade.`);
    }
    s.trade = null;
    checkLoophole(s, p);
    checkLoophole(s, q);
    return;
  }
  if (a.type === "ruling-adjust") {
    applyRuling(s, p, a);
    return;
  }
  if (a.type === "ruling-die") {
    need(
      s.ruling && (p.id === s.ruling.actor || p.id === s.host),
      "No ruling is awaiting you.",
    );
    const n = integer(a.amount, 2, 100);
    const r = dice(n);
    s.lastDice = [r];
    addLog(
      s,
      `${p.name} rolled d${n}: ${r}${a.reason ? ` · ${a.reason.slice(0, 200)}` : ""}.`,
    );
    return;
  }
  if (a.type === "ruling-finish") {
    need(
      s.ruling && (p.id === s.ruling.actor || p.id === s.host),
      "No ruling is awaiting you.",
    );
    const r = s.ruling!,
      q = s.players.find((p) => p.id === r.actor)!;
    if (s.encounter && r.cards.includes(s.encounter)) {
      const id = s.encounter,
        c = card(id);
      if (a.choice === "keep") {
        need(
          ["item", "homie", "cash"].includes(c.kind),
          "That card cannot be kept as a possession.",
        );
        acquire(s, q, id);
      } else if (a.choice === "discard") {
        removeBoard(s, [id]);
        discard(s, id);
      } else need(a.choice === "leave", "Choose how to finish the card.");
      s.ruling = null;
      afterEncounter(s);
    } else {
      s.ruling = null;
      s.phase = r.returnPhase;
      if (s.phase === "ruling") s.phase = "end";
      if ((q.dead || q.respawn) && q.id === current(s).id) {
        s.phase = "end";
        s.combat = null;
      }
      if (
        !q.dead &&
        !q.respawn &&
        q.region === 3 &&
        s.phase !== "combat" &&
        s.phase !== "ending"
      )
        enterEnding(s, q);
      for (const pl of s.players) if (!pl.dead) overflow(s, pl);
    }
    addLog(s, `${p.name} finished the table ruling.`);
    return;
  }
  if (a.type === "overflow-discard") {
    need(s.overflow?.player === p.id, "No inventory choice is awaiting you.");
    need(a.item && p.items.includes(a.item), "Choose an Item.");
    need(
      !protectedItem(p, a.item!),
      "That Item cannot be voluntarily discarded.",
    );
    removeCard(s, p, a.item!);
    const limit = capacity(p);
    if (p.items.length <= limit) {
      s.phase = s.overflow!.returnPhase;
      s.overflow = null;
      for (const q of s.players) if (!q.dead) overflow(s, q);
    }
    return;
  }
  if (
    a.type === "table-rule" &&
    s.phase === "combat" &&
    s.combat &&
    (s.combat.attacker === p.id || s.combat.defender === p.id)
  ) {
    need(
      typeof a.reason === "string" && a.reason.trim().length >= 3,
      "Name the combat rule.",
    );
    if (a.item)
      need(
        [...p.items, ...p.homies, ...p.bones].includes(a.item),
        "You do not hold that card.",
      );
    need(!s.combat.choices[p.id], "Your combat choice is locked.");
    beginRuling(s, p, a.item ? [a.item] : [], a.reason!.slice(0, 300));
    return;
  }
  need(
    p.id === current(s).id && (!p.dead || a.type === "end"),
    "Wait for your turn.",
  );
  need(!p.respawn || a.type === "end", "The new character begins next turn.");
  need(
    !["overflow", "penalty", "ruling"].includes(s.phase),
    "Finish the pending choice first.",
  );
  switch (a.type) {
    case "cure-bone": {
      need(
        p.region === 0 && p.pos === 25 && s.phase === "end" && s.locationDone,
        "Visit the Hospital first.",
      );
      need(
        a.item &&
          p.bones.includes(a.item) &&
          ["Crabs", "Amputation"].includes(cardName(a.item)),
        "Choose a treatable condition.",
      );
      pay(p, cardName(a.item!) === "Crabs" ? 100 : 300);
      removeCard(s, p, a.item!);
      break;
    }
    case "peek": {
      need(
        s.phase === "roll" &&
          held(p, "Crystal Ball") &&
          !p.used.includes("crystal-ball"),
        "Use Crystal Ball once at the start of your turn.",
      );
      const region = integer(a.region, 0, 2);
      if (!s.decks[region].length) {
        s.decks[region] = shuffle(s.discards[region]);
        s.discards[region] = [];
      }
      need(s.decks[region].length, "That deck has no cards.");
      s.peek = { player: p.id, card: s.decks[region].at(-1)! };
      p.used.push("crystal-ball");
      addLog(
        s,
        `${p.name} privately inspected the ${["Detroit", "Nethervoid", "Dark Carnival"][region]} deck.`,
      );
      break;
    }
    case "roll":
      need(s.phase === "roll", "Roll once at the beginning of your turn.");
      if (
        (p.region === 3 && s.ending !== "book") ||
        (s.ending === "skull" && s.endingHolder === p.id)
      ) {
        endingTurn(s, p);
        break;
      }
      {
        if ((p.wagonUntil ?? -1) >= (s.turnsTaken[p.id] ?? 0)) {
          s.choices = [0, 1, 2, 3].flatMap((region) =>
            Array.from({ length: COUNTS[region] ?? 1 }, (_, pos) => ({
              region,
              pos,
              toll: 0,
              reason: "Wagon",
            })),
          );
          s.phase = "move";
          break;
        }
        if (held(p, "Unclear title · card 3300")) {
          prepareMovement(s, p, 1, 1, false);
          s.roll = 1;
          s.choices = destinations(p, 1, s);
          break;
        }
        const truck =
          a.choice === "truck" ||
          (a.choice === "two" &&
            !has(s, p, "two_dice_movement") &&
            held(p, "Black Truck"));
        const two = a.choice === "two" || truck,
          pick = a.choice === "pick";
        need(!truck || held(p, "Black Truck"), "Black Truck is unavailable.");
        need(
          !two || truck || has(s, p, "two_dice_movement"),
          "Two-die movement is unavailable.",
        );
        need(
          !pick || held(p, ["Stefan", "Moon Glorious", "Choko"][p.region]),
          "No Homie offers a die choice here.",
        );
        const rolls =
          two || pick
            ? [
                playerDie(s, p, 6, false, truck),
                playerDie(s, p, 6, false, truck),
              ]
            : [playerDie(s, p)];
        s.lastDice = rolls.map((r) => r.raw);
        if (truck) usedItem(s, p, heldId(p, "Black Truck")!);
        if (pick) {
          s.itemPrompt = {
            player: p.id,
            kind: "movement",
            values: rolls.map((r) => r.value),
            raw: rolls.map((r) => r.raw),
            returnPhase: "roll",
          };
        } else
          prepareMovement(
            s,
            p,
            rolls.reduce((a, r) => a + r.raw, 0),
            rolls.reduce((a, r) => a + r.value, 0),
            !two,
          );
        addLog(
          s,
          `${p.name} rolled ${rolls.map((r) => r.raw).join(" + ")} for movement.`,
        );
      }
      break;
    case "move":
      need(s.phase === "move", "Roll before choosing a destination.");
      {
        const d = s.choices.find(
          (x) => x.region === a.region && x.pos === a.pos,
        );
        need(d, "Choose a highlighted destination.");
        if (d!.itemToll) {
          need(
            a.item &&
              p.items.includes(a.item) &&
              !a.item.startsWith("ending-") &&
              !protectedItem(p, a.item),
            "Choose one Item to discard at the Portal.",
          );
          removeCard(s, p, a.item!);
        }
        pay(p, d!.toll);
        p.region = d!.region;
        p.pos = d!.pos;
        s.choices = [];
        addLog(s, `${p.name} moved to ${spaceName(p.region, p.pos)}.`);
        if (p.region === 1 && p.pos === 2)
          s.direction = s.direction === -1 ? 1 : -1;
        arrive(s, p);
      }
      break;
    case "location":
      need(
        !forcedAttack(s, p),
        "2 Tuff Tony requires you to attack a player on this space.",
      );
      need(
        s.phase === "encounter" && !s.encounter && !s.locationDone,
        "Resolve the pending encounter first.",
      );
      {
        const existing = s.board[`${p.region}:${p.pos}`] ?? [];
        if (existing.length) {
          s.encounter = existing[0];
          s.queue = existing.slice(1);
          break;
        }
        const rule = spaceRule(p.region, p.pos);
        need(rule, "This space has no verified rule.");
        s.locationDone = true;
        s.phase = "end";
        let bonus = 0;
        if (a.choice === "club") {
          need(
            has(s, p, "club_bonus") && p.region === 0 && p.pos === 14,
            "That location power is unavailable.",
          );
          pay(p, 100);
          bonus = 2;
        }
        boardEffects(s, p, rule.effects, bonus);
      }
      break;
    case "ignore-location": {
      need(!forcedAttack(s, p), "2 Tuff Tony requires a fight on this space.");
      need(
        s.phase === "encounter" &&
          !s.encounter &&
          !s.board[`${p.region}:${p.pos}`]?.length,
        "Resolve existing cards first.",
      );
      const key =
        "ignore_" +
        spaceName(p.region, p.pos).toLowerCase().replaceAll(" ", "_");
      need(has(s, p, key), "You cannot ignore this location.");
      s.phase = "end";
      s.locationDone = true;
      break;
    }
    case "resolve":
      need(s.phase === "encounter", "No encounter is awaiting resolution.");
      resolveCard(s, p);
      break;
    case "attack":
    case "ranged":
      need(
        a.type !== "ranged" || !forcedAttack(s, p),
        "2 Tuff Tony requires a fight on this space.",
      );
      need(
        s.phase === "encounter" && !s.encounter && !s.locationDone,
        "Choose combat before encountering the space.",
      );
      {
        const ranged = a.type === "ranged";
        if (ranged)
          need(
            p.items.some((id) => card(id).ranged),
            "You need a ranged Weapon.",
          );
        const q = a.target ? playerById(s, a.target) : undefined;
        if (q) {
          need(
            q.id !== p.id && (ranged ? adjacent(p, q) : same(p, q)),
            "That player is out of range.",
          );
          combatStart(s, p, [], q, ranged);
        } else {
          need(ranged, "Choose another player.");
          integer(a.region, 0, 2);
          integer(a.pos, 0, COUNTS[a.region!] - 1);
          need(
            adjacent(p, { region: a.region!, pos: a.pos! }),
            "That space is not adjacent.",
          );
          const ids = (s.board[`${a.region}:${a.pos}`] ?? []).filter(
            (id) => card(id).kind === "fiend",
          );
          need(ids.length, "That space has no Fiend.");
          combatStart(s, p, ids, undefined, true, false, {
            region: a.region!,
            pos: a.pos!,
          });
        }
      }
      break;
    case "trade":
      need(
        ["roll", "move", "encounter", "end"].includes(s.phase),
        "Finish combat or the current choice first.",
      );
      {
        const q = playerById(s, a.target);
        need(
          q.id !== p.id && same(p, q),
          "Trade with a player sharing your space.",
        );
        need(
          !a.give || (p.items.includes(a.give) && !protectedItem(p, a.give)),
          "You do not hold the offered Item.",
        );
        need(
          !a.ask || (q.items.includes(a.ask) && !protectedItem(q, a.ask)),
          "The requested Item is unavailable.",
        );
        const giveCash = integer(a.giveCash ?? 0, 0, p.cash),
          askCash = integer(a.askCash ?? 0, 0, q.cash);
        need(
          a.give || a.ask || giveCash || askCash,
          "Include an Item or Cash.",
        );
        s.trade = {
          from: p.id,
          to: q.id,
          give: a.give ?? null,
          ask: a.ask ?? null,
          giveCash,
          askCash,
        };
      }
      break;
    case "herb":
      need(
        s.phase === "roll" &&
          a.item &&
          p.items.includes(a.item) &&
          card(a.item).use === "herb",
        "Use an Herb you hold at the beginning of your turn.",
      );
      removeCard(s, p, a.item!);
      heal(p, has(s, p, "stronger_herb") ? 2 : 1);
      break;
    case "buy":
      need(
        s.phase === "end" && s.locationDone && shop(s, p),
        "Resolve a shop space first.",
      );
      {
        const id = a.item!;
        need(s.purchase.includes(id), "That Purchase Item is unavailable.");
        const c = card(id),
          prices = shop(s, p).buy.prices;
        const k = Object.keys(prices).find(
          (n) => normalName(n) === normalName(c.name),
        );
        need(k, "This shop does not sell that Item.");
        let price = prices[k!];
        if (p.region === 0 && has(s, p, "southwest_discount") && price > 100)
          price -= 100;
        pay(p, price);
        s.purchase = s.purchase.filter((x) => x !== id);
        receive(s, p, id);
        overflow(s, p);
        addLog(s, `${p.name} bought ${c.name} for $${price}.`);
      }
      break;
    case "sell":
      need(
        s.phase === "end" && s.locationDone && shop(s, p),
        "Resolve a shop space first.",
      );
      need(
        a.item &&
          p.items.includes(a.item) &&
          !a.item.startsWith("ending-") &&
          !protectedItem(p, a.item),
        "Choose an Item to sell.",
      );
      {
        const name = cardName(a.item!);
        gainCash(
          p,
          p.region === 0 && name === "Chrome Spinner Rims"
            ? 400
            : p.region === 0 && name === "Car Radios"
              ? 300
              : 100,
        );
        removeCard(s, p, a.item!);
      }
      break;
    case "heal":
      need(
        s.phase === "end" && s.locationDone && p.region === 0 && p.pos === 25,
        "Healing is available at the Hospital.",
      );
      {
        const n = integer(a.amount ?? 1, 1, p.maxLife - p.life);
        pay(p, held(p, "Health Insurance Card") ? 0 : 100 * n);
        heal(p, n);
        const insurance = heldId(p, "Health Insurance Card");
        if (insurance) usedItem(s, p, insurance);
      }
      break;
    case "gamble":
      need(
        s.phase === "end" &&
          s.locationDone &&
          p.region === 0 &&
          p.pos === 23 &&
          !p.used.includes("gamble"),
        "Make one wager per Casino visit.",
      );
      {
        const n = integer(a.amount, 0, p.cash),
          r = nonCombatDie(s, p);
        s.lastDice = [r];
        if (r <= 2) p.cash -= n;
        else if (r >= 5) gainCash(p, n);
        p.used.push("gamble");
        addLog(s, `${p.name} wagered $${n} and rolled ${r}.`);
      }
      break;
    case "power":
      powerAction(s, p, a);
      break;
    case "table-rule":
      need(
        ["roll", "move", "encounter", "end", "combat", "ending"].includes(
          s.phase,
        ),
        "Finish the current choice first.",
      );
      need(
        typeof a.reason === "string" && a.reason.trim().length >= 3,
        "Name the rule to resolve.",
      );
      if (a.item)
        need(
          [...p.items, ...p.homies, ...p.bones].includes(a.item),
          "You do not hold that card.",
        );
      beginRuling(
        s,
        p,
        a.item ? [a.item] : [],
        a.item
          ? `${cardName(a.item)}: ${card(a.item).rules}`
          : a.reason!.slice(0, 300),
      );
      break;
    case "ending-roll":
      need(
        s.phase === "ending" && s.ending === "wraith",
        "The Wraith is not awaiting a roll.",
      );
      endingTurn(s, p);
      break;
    case "ending-target":
      need(
        s.phase === "ending" &&
          s.endingHolder === p.id &&
          ["wand", "skull"].includes(s.ending),
        "This ending does not let you choose a target.",
      );
      {
        const q = playerById(s, a.target);
        need(q.id !== p.id, "Choose another player.");
        if (s.ending === "skull") {
          p.region = q.region;
          p.pos = q.pos;
          combatStart(s, p, [], q, false, true);
        } else {
          const r = nonCombatDie(s, p, 10);
          s.lastDice = [r];
          addLog(
            s,
            `${p.name} aimed Milenko’s Wand at ${q.name} and rolled ${r}.`,
          );
          s.phase = "end";
          if (r === 0) {
            ruling(
              s,
              p,
              [],
              `Milenko’s Wand rolled a modified zero, which has no printed result. Resolve this result with the table.`,
            );
            s.ruling!.returnPhase = "ending";
          } else if (r === 1)
            ruling(
              s,
              p,
              [],
              `Move ${q.name} to any space in their current region.`,
            );
          else if (r === 2) drawBone(s, q);
          else if (r === 3) loseAll(s, q, "homies");
          else if (r === 4) loseAll(s, q, "items");
          else if (r === 10) death(s, q, true);
          else damage(s, q, r <= 6 ? 1 : r <= 8 ? 2 : 3);
          endCheck(s);
        }
      }
      break;
    case "end":
      need(s.phase === "end", "Finish your encounter or pending choice first.");
      s.trade = null;
      nextTurn(s);
      break;
    default:
      throw new Error("That action is unavailable.");
  }
  checkLoophole(s, p);
  endCheck(s);
  if (s.status === "playing")
    for (const q of s.players) if (!q.dead) overflow(s, q);
}
export function options(s: State, id: string): Option[] {
  if (s.flow)
    return s.flow.prompt.player === id
      ? s.flow.prompt.choices.map((c) => ({
          label: c.label,
          action: { type: "card-response", choice: c.id },
          group: "Card choice",
        }))
      : [];
  if (s.itemPrompt)
    return s.itemPrompt.player === id && s.itemPrompt.kind === "movement"
      ? s.itemPrompt.values!.map((v, i) => ({
          label: `Move using die ${i + 1}: ${v}`,
          action: { type: "movement-choice", amount: i },
          group: "Choose movement die",
        }))
      : [];
  if (s.status !== "playing") return [];
  const p = s.players.find((p) => p.id === id);
  if (!p) return [];
  if (p.dead)
    return id === current(s).id && s.phase === "end"
      ? [{ label: "End turn", action: { type: "end" }, group: "Turn" }]
      : [];
  const out: Option[] = [];
  const add = (label: string, action: Action, group = "Turn") =>
    out.push({ label, action, group });
  if (s.endingPending) {
    if (s.endingPending === id) {
      add("Accept this ending", { type: "ending-accept" }, "Ending");
      add(
        "Use Psychopathic Ring · replace ending",
        { type: "ending-replace" },
        "Ending",
      );
    }
    return out;
  }
  if (s.decision) {
    if (s.decision.actor === id) {
      if (s.decision.kind === "bone-draw") {
        add(
          "Use Skateboard · roll d10",
          { type: "bone-decision", choice: "skateboard" },
          "Bone card",
        );
        add(
          "Draw the Bone card",
          { type: "bone-decision", choice: "draw" },
          "Bone card",
        );
      } else
        for (const q of s.players.filter(
          (q) => q.id !== id && !q.dead && !absent(q) && !q.respawn,
        ))
          add(
            "Transfer Bone draw to " + q.name,
            { type: "bone-decision", target: q.id },
            "Bone card",
          );
    }
    return out;
  }
  if (absent(p)) {
    if (id === current(s).id && s.phase === "end")
      add("End turn · temporarily absent", { type: "end" });
    return out;
  }
  if (s.phase === "waiting") return out;
  out.push(...possessionOptions(s, p));
  if (s.overflow?.player === id) {
    for (const item of p.items.filter((id) => !protectedItem(p, id)))
      add(
        `Discard ${cardName(item)}`,
        { type: "overflow-discard", item },
        "Inventory limit",
      );
    return out;
  }
  if (s.penalty?.winner === id) {
    const q = playerById(s, s.penalty.loser);
    add(
      `${q.name} loses 1 Life`,
      { type: "penalty", choice: "life" },
      "Combat penalty",
    );
    if (q.cash)
      add(
        `Take $${Math.min(300, q.cash)}`,
        { type: "penalty", choice: "cash" },
        "Combat penalty",
      );
    for (const item of q.items)
      add(
        `Take ${cardName(item)}`,
        { type: "penalty", choice: "item", item },
        "Combat penalty",
      );
    for (const item of q.homies)
      add(
        `Discard ${q.name}’s ${cardName(item)}`,
        { type: "penalty", choice: "homie", item },
        "Combat penalty",
      );
    return out;
  }
  if (s.trade?.to === id) {
    add("Accept trade", { type: "trade-accept" }, "Trade");
    add("Decline trade", { type: "trade-decline" }, "Trade");
  }
  if (s.ruling && (s.ruling.actor === id || s.host === id)) {
    add("Roll raw d6", { type: "ruling-die", amount: 6 }, "Table ruling");
    add("Roll raw d10", { type: "ruling-die", amount: 10 }, "Table ruling");
    if (s.encounter && s.ruling.cards.includes(s.encounter)) {
      const c = card(s.encounter);
      if (["item", "homie", "cash"].includes(c.kind))
        add(
          "Keep card · effects resolved",
          { type: "ruling-finish", choice: "keep" },
          "Table ruling",
        );
      add(
        "Leave card on space · effects resolved",
        { type: "ruling-finish", choice: "leave" },
        "Table ruling",
      );
      add(
        "Discard card · effects resolved",
        { type: "ruling-finish", choice: "discard" },
        "Table ruling",
      );
    } else add("Finish ruling", { type: "ruling-finish" }, "Table ruling");
    return out;
  }
  if (id !== current(s).id) return out;
  if (p.respawn) {
    if (s.phase === "end")
      add("End turn · new character starts next turn", { type: "end" });
    return out;
  }
  if (s.phase === "roll") {
    if (held(p, "Crystal Ball") && !p.used.includes("crystal-ball"))
      for (let region = 0; region < 3; region++)
        add(
          "Crystal Ball · inspect " +
            ["Detroit", "Nethervoid", "Dark Carnival"][region],
          { type: "peek", region },
          "Items",
        );
    add(
      p.region === 3 && s.ending !== "book"
        ? "Resolve ending turn"
        : "Roll movement",
      { type: "roll" },
    );
    if (!held(p, "Unclear title · card 3300") && p.region < 3) {
      if (has(s, p, "two_dice_movement"))
        add("Move with two dice", { type: "roll", choice: "two" });
      if (held(p, "Black Truck"))
        add("Use Black Truck · sum two dice", {
          type: "roll",
          choice: "truck",
        });
      if (held(p, ["Stefan", "Moon Glorious", "Choko"][p.region]))
        add("Homie movement · roll two, choose one", {
          type: "roll",
          choice: "pick",
        });
    }
    for (const item of p.items.filter((id) => card(id).use === "herb"))
      add(
        `Use Herb · heal ${has(s, p, "stronger_herb") ? 2 : 1} Life`,
        { type: "herb", item },
        "Items",
      );
  }
  if (s.phase === "encounter" && !s.encounter && forcedAttack(s, p)) {
    for (const q of s.players.filter(
      (q) => q.id !== id && !q.dead && !q.respawn && !absent(q) && same(p, q),
    ))
      add(
        `2 Tuff Tony · challenge ${q.name}`,
        { type: "attack", target: q.id },
        "Combat",
      );
    return out;
  }
  if (s.phase === "encounter") {
    if (s.encounter)
      add(
        card(s.encounter).kind === "fiend" ? "Prepare combat" : "Resolve card",
        { type: "resolve" },
      );
    else {
      add(
        s.board[`${p.region}:${p.pos}`]?.length
          ? "Encounter cards on this space"
          : "Encounter " + spaceName(p.region, p.pos),
        { type: "location" },
      );
      const ignore =
        "ignore_" +
        spaceName(p.region, p.pos).toLowerCase().replaceAll(" ", "_");
      if (has(s, p, ignore))
        add("Ignore location effect", { type: "ignore-location" });
      if (
        p.region === 0 &&
        p.pos === 14 &&
        has(s, p, "club_bonus") &&
        p.cash >= 100
      )
        add("Pay $100 · club roll +2", { type: "location", choice: "club" });
      for (const q of s.players.filter((q) => q.id !== id && !q.dead)) {
        if (same(p, q))
          add(
            `Challenge ${q.name}`,
            { type: "attack", target: q.id },
            "Combat",
          );
        else if (adjacent(p, q) && p.items.some((id) => card(id).ranged))
          add(
            `Ranged attack on ${q.name}`,
            { type: "ranged", target: q.id },
            "Combat",
          );
      }
      if (p.items.some((id) => card(id).ranged))
        for (const [key, ids] of Object.entries(s.board)) {
          const [region, pos] = key.split(":").map(Number);
          if (
            adjacent(p, { region, pos }) &&
            ids.some((id) => card(id).kind === "fiend")
          )
            add(
              `Ranged attack · ${spaceName(region, pos)}`,
              { type: "ranged", region, pos },
              "Combat",
            );
        }
    }
  }
  if (s.phase === "end") {
    if (p.region === 0 && p.pos === 25 && s.locationDone)
      for (const item of p.bones) {
        const n = cardName(item),
          cost = n === "Crabs" ? 100 : n === "Amputation" ? 300 : Infinity;
        if (p.cash >= cost)
          add(
            "Cure " + n + " · $" + cost,
            { type: "cure-bone", item },
            "Hospital",
          );
      }
    add("End turn", { type: "end" });
    if (s.locationDone && shop(s, p)) {
      const prices = shop(s, p).buy.prices;
      for (const id of [
        ...new Map(s.purchase.map((id) => [card(id).key, id])).values(),
      ]) {
        const c = card(id),
          k = Object.keys(prices).find(
            (n) => normalName(n) === normalName(c.name),
          );
        if (k) {
          const price =
            prices[k] -
            (p.region === 0 &&
            has(s, p, "southwest_discount") &&
            prices[k] > 100
              ? 100
              : 0);
          if (p.cash >= price)
            add(`Buy ${c.name} · $${price}`, { type: "buy", item: id }, "Shop");
        }
      }
      for (const item of p.items.filter(
        (id) => !id.startsWith("ending-") && !protectedItem(p, id),
      ))
        add(`Sell ${cardName(item)}`, { type: "sell", item }, "Shop");
    }
    if (
      p.region === 0 &&
      p.pos === 25 &&
      s.locationDone &&
      p.life < p.maxLife &&
      (p.cash >= 100 || held(p, "Health Insurance Card"))
    )
      add("Heal 1 Life · $100", { type: "heal", amount: 1 }, "Hospital");
  }
  if (s.phase === "ending") {
    if (s.ending === "wraith")
      add("Roll against The Wraith", { type: "ending-roll" });
    if (["wand", "skull"].includes(s.ending) && s.endingHolder === p.id)
      for (const q of s.players.filter(
        (q) => !q.dead && !q.respawn && !absent(q) && q.id !== id,
      ))
        add(
          `Target ${q.name}`,
          { type: "ending-target", target: q.id },
          "Ending",
        );
  }
  if (["roll", "move", "encounter", "end", "combat"].includes(s.phase)) {
    const once = (key: string) => has(s, p, key) && !p.used.includes(key);
    if (has(s, p, "change_allegiance"))
      add(
        "Change allegiance",
        {
          type: "power",
          power: "change_allegiance",
          allegiance:
            p.allegiance === "Dark Carnival" ? "Nethervoid" : "Dark Carnival",
        },
        "Powers",
      );
    for (const key of [
      "purchase_extra_turn",
      "paid_training",
      "fiend_victory_extra_turn",
      "bribe_fiend",
      "evade_on_common_spaces",
      "replace_event",
      "ignore_event_effect",
    ]) {
      const allowed =
        key === "purchase_extra_turn"
          ? p.cash >= 200
          : key === "paid_training"
            ? p.cash >= 300
            : key === "fiend_victory_extra_turn"
              ? s.wonFiend
              : key === "bribe_fiend"
                ? s.phase === "combat" &&
                  !s.combat?.defender &&
                  p.region < 3 &&
                  p.cash >= 100
                : key === "evade_on_common_spaces"
                  ? s.phase === "combat" &&
                    ["City", "Alleyway", "Cave", "Tunnels"].includes(
                      spaceName(p.region, p.pos),
                    )
                  : !!s.encounter && card(s.encounter).kind === "event";
      if (once(key) && allowed)
        add(key.replaceAll("_", " "), { type: "power", power: key }, "Powers");
    }
    if (s.phase === "roll" && has(s, p, "consume_homies"))
      for (const item of p.homies)
        add(
          `Consume ${cardName(item)} · heal 1`,
          { type: "power", power: "consume_homies", item },
          "Powers",
        );
    if (has(s, p, "cash_in_homies"))
      for (const item of p.homies)
        add(
          `Cash in ${cardName(item)}`,
          { type: "power", power: "cash_in_homies", item },
          "Powers",
        );
    for (const q of s.players.filter(
      (q) => q.id !== id && !q.dead && same(p, q),
    )) {
      if (once("take_cash"))
        add(
          `Take $100 from ${q.name}`,
          { type: "power", power: "take_cash", target: q.id },
          "Powers",
        );
      if (once("redirect_next_turn_loot"))
        add(
          `Redirect ${q.name}’s next-turn loot`,
          { type: "power", power: "redirect_next_turn_loot", target: q.id },
          "Powers",
        );
      for (const [key, list] of [
        ["steal_item", q.items],
        ["steal_homie", q.homies],
        ["steal_vehicle", q.items.filter((id) => card(id).vehicle)],
      ] as const)
        if (once(key))
          for (const item of list)
            add(
              `${key.replaceAll("_", " ")}: ${cardName(item)} from ${q.name}`,
              { type: "power", power: key, target: q.id, item },
              "Powers",
            );
    }
  }
  return out;
}
export function publicState(s: State, session: string) {
  const me = s.players.find((p) => p.session === session);
  const {
    decks,
    discards,
    purchase,
    boneDeck,
    boneDiscard,
    endingPool,
    ending,
    players,
    peek,
    flow,
    ...rest
  } = s;
  const needed = [
    s.flow?.prompt.player,
    s.itemPrompt?.player,
    s.endingPending,
    s.decision?.actor,
    s.overflow?.player,
    s.penalty?.winner,
    s.combat && !s.combat.choices[s.combat.attacker] ? s.combat.attacker : null,
    s.combat?.defender && !s.combat.choices[s.combat.defender]
      ? s.combat.defender
      : null,
    s.trade?.to,
    s.ruling?.actor,
    current(s)?.id,
    me?.id,
  ];
  const controlled = me
    ? needed
        .map((id) => s.players.find((p) => p.id === id))
        .find((p) => p && canControl(s, me.id, p))
    : undefined;
  return {
    ...rest,
    players: players.map(({ session, ...p }) => ({
      ...p,
      controller: controllerFor(s, p as Player),
      capacity: capacity(p as Player),
      conditionDetails: conditionSummary(s, p as Player),
    })),
    pendingCard: flow?.prompt ?? null,
    serverTime: Date.now(),
    peek:
      peek &&
      me &&
      canControl(s, me.id, s.players.find((p) => p.id === peek.player)!)
        ? peek.card
        : null,
    me: me?.id ?? null,
    control: controlled?.id ?? null,
    ending: s.finalRevealed ? ENDINGS.find((e) => e.id === ending) : null,
    deckCounts: decks.map((d) => d.length),
    discardCounts: discards.map((d) => d.length),
    discardCards: discards.flat(),
    purchase,
    options: controlled
      ? options(s, controlled.id).map((o) => ({
          ...o,
          action: { ...o.action, actor: controlled.id },
        }))
      : [],
    yourPowers: controlled ? powers(s, controlled) : [],
    space:
      current(s)?.region < 3
        ? spaceRule(current(s).region, current(s).pos)
        : null,
    coverage: {
      actionCards: 260,
      characters: 18,
      endings: 10,
      boardSpaces: 60,
    },
    mode: "Online tabletop",
    legacy: false,
  };
}
export function runBots(s: State) {
  if (s.rulesVersion !== 3 || s.status !== "playing") return;
  for (let i = 0; i < 30 && s.status === "playing"; i++) {
    const p = current(s);
    if (
      s.flow ||
      s.itemPrompt ||
      !p.bot ||
      controllerFor(s, p) !== p.id ||
      s.endingPending ||
      s.decision ||
      s.phase === "ruling" ||
      s.phase === "combat" ||
      s.phase === "penalty" ||
      s.phase === "ending" ||
      s.phase === "overflow"
    )
      return;
    let a: Action | undefined;
    if (s.phase === "roll") a = { type: "roll" };
    else if (s.phase === "move") {
      const d = s.choices.find((d) => !d.itemToll) ?? s.choices[0];
      if (d)
        a = {
          type: "move",
          region: d.region,
          pos: d.pos,
          item: d.itemToll
            ? p.items.find((id) => !id.startsWith("ending-"))
            : undefined,
        };
    } else if (s.phase === "encounter")
      a = { type: s.encounter ? "resolve" : "location" };
    else if (s.phase === "end") a = { type: "end" };
    if (!a) return;
    applyAction(s, p.id, a);
  }
}
