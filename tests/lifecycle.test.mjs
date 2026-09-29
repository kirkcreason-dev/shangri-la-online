import test from "node:test";
import assert from "node:assert/strict";
import {
  makeRoom,
  newPlayer,
  applyAction,
  publicState,
  destinations,
  CARDS,
  card,
  cardName,
  powers,
  has,
  score,
  tick,
  options,
} from "../lib/game.ts";
import { capacity, controllerFor } from "../lib/rules/conditions.ts";
const random = (vals, fn) => {
  const original = crypto.getRandomValues;
  crypto.getRandomValues = (a) => {
    a[0] = (vals.shift() ?? 6) - 1;
    return a;
  };
  try {
    return fn();
  } finally {
    crypto.getRandomValues = original;
  }
};
function game(names = ["Killnor", "Violent J", "Mack Benjamin"]) {
  const s = makeRoom("ABC234", "s0", "A", names[0]);
  for (let i = 1; i < names.length; i++) {
    const p = newPlayer("s" + i, "P" + i, names[i], i);
    p.ready = true;
    s.players.push(p);
  }
  random([10, ...names.slice(1).map(() => 1)], () =>
    applyAction(s, s.host, { type: "start" }),
  );
  return s;
}
function item(s, p, name) {
  const c = CARDS.find((c) => c.name === name);
  assert.ok(c, name);
  for (const list of [...s.decks, ...s.discards, s.purchase, s.boneDeck]) {
    const i = list.findIndex((id) => card(id).key === c.key);
    if (i >= 0) {
      const id = list.splice(i, 1)[0];
      p[
        c.kind === "homie" ? "homies" : c.kind === "bone" ? "bones" : "items"
      ].push(id);
      return id;
    }
  }
  assert.fail("unavailable " + name);
}
function bone(s, p, name, rolls = []) {
  const id = s.boneDeck.find((id) => cardName(id) === name);
  assert.ok(id, name);
  s.boneDeck = s.boneDeck.filter((x) => x !== id);
  s.boneDeck.push(id);
  const actor = s.players[s.turn];
  if (!s.ruling)
    applyAction(s, controllerFor(s, actor), {
      type: "table-rule",
      actor: actor.id,
      reason: "Source-backed Bone test",
    });
  random(rolls, () =>
    applyAction(s, controllerFor(s, actor), {
      type: "ruling-adjust",
      actor: actor.id,
      target: p.id,
      stat: "draw",
      deck: "bone",
      reason: "Draw Bone from rule",
    }),
  );
  return id;
}
function end(s) {
  const p = s.players[s.turn];
  s.phase = "end";
  s.ruling = null;
  applyAction(s, controllerFor(s, p), { type: "end", actor: p.id });
}
function reveal(s, ending) {
  const p = s.players[s.turn];
  p.region = 2;
  p.pos = 6;
  p.bonus = 15;
  s.ending = ending;
  s.endingPool = s.endingPool.filter((e) => e !== ending);
  s.phase = "move";
  s.choices = destinations(p, 1, s);
  applyAction(s, controllerFor(s, p), {
    type: "move",
    actor: p.id,
    region: 3,
    pos: 0,
  });
  return p;
}
function fatal(s, p, amount = -20) {
  if (!s.ruling)
    applyAction(s, controllerFor(s, s.players[s.turn]), {
      type: "table-rule",
      actor: s.players[s.turn].id,
      reason: "Lethal source effect",
    });
  applyAction(s, controllerFor(s, s.players[s.turn]), {
    type: "ruling-adjust",
    actor: s.players[s.turn].id,
    target: p.id,
    stat: "life",
    amount,
    reason: "Lethal source effect",
  });
}
test("Casket preserves character, stats, Cash and possessions before ordinary death", () => {
  const s = game(),
    p = s.players[0],
    casket = item(s, p, "Casket"),
    axe = item(s, p, "Axe"),
    before = p.character;
  p.cash = 600;
  p.bonus = 12;
  fatal(s, p);
  assert.equal(p.dead, false);
  assert.equal(p.character, before);
  assert.equal(p.cash, 600);
  assert.equal(p.bonus, 12);
  assert.equal(p.rebirth, false);
  assert.ok(p.items.includes(axe));
  assert.ok(p.items.includes(casket));
  assert.equal(p.life, 1);
  assert.ok(p.respawn);
  end(s);
  end(s);
  end(s);
  assert.deepEqual([p.region, p.pos], [0, 9]);
  assert.equal(s.phase, "roll");
  assert.equal(p.casketRecovery, undefined);
  assert.ok(!p.items.includes(casket));
  assert.equal(s.discards[1].filter((id) => id === casket).length, 1);
});
test("Casket still works after Shangri-La has been entered", () => {
  const s = game(),
    p = s.players[0];
  item(s, p, "Casket");
  s.finalEntered = true;
  fatal(s, p);
  assert.equal(p.dead, false);
  assert.ok(p.respawn);
});
test("Casket and ordinary rebirth are both barred in Mortal Combat", () => {
  const s = game(),
    p = s.players[0],
    q = s.players[1];
  item(s, q, "Casket");
  reveal(s, "skull");
  q.life = 1;
  applyAction(s, p.id, { type: "ending-target", target: q.id });
  applyAction(s, p.id, { type: "combat-choice", weapon: null });
  random([10, 1], () =>
    applyAction(s, q.id, { type: "combat-choice", weapon: null }),
  );
  assert.ok(q.dead);
  assert.equal(q.rebirth, false);
  assert.equal(q.casketRecovery, undefined);
});
test("Casket does not consume the character’s ordinary first-death replacement", () => {
  const s = game(),
    p = s.players[0];
  item(s, p, "Casket");
  fatal(s, p);
  end(s);
  end(s);
  end(s);
  fatal(s, p);
  assert.equal(p.rebirth, true);
  assert.equal(p.dead, false);
});
test("Psychopathic Ring pauses immediate victory and can accept it", () => {
  const s = game(),
    p = s.players[0],
    ring = item(s, p, "Psychopathic Ring");
  reveal(s, "unveiling");
  assert.equal(s.status, "playing");
  assert.equal(s.endingPending, p.id);
  assert.throws(
    () => applyAction(s, s.players[1].id, { type: "ending-accept" }),
    /newly revealed/,
  );
  applyAction(s, p.id, { type: "ending-accept" });
  assert.equal(s.winner, p.id);
  assert.ok(p.items.includes(ring));
});
test("Ring replaces even a lethal ending before death and cannot reroll twice", () => {
  const s = game(),
    p = s.players[0],
    ring = item(s, p, "Psychopathic Ring");
  s.endingPool = ["unveiling"];
  reveal(s, "dimension");
  assert.equal(p.dead, false);
  assert.equal(s.status, "playing");
  applyAction(s, p.id, { type: "ending-replace" });
  assert.equal(s.ending, "unveiling");
  assert.equal(s.winner, p.id);
  assert.ok(!p.items.includes(ring));
  assert.deepEqual(s.endingDiscard, ["dimension"]);
  assert.equal(s.endingPending, null);
});
test("unrevealed replacement endings and deck order stay private", () => {
  const s = game();
  item(s, s.players[0], "Psychopathic Ring");
  const v = publicState(s, "s0");
  assert.equal(v.ending, null);
  assert.equal(v.endingPool, undefined);
  assert.equal(v.decks, undefined);
});
test("Pumpkin Carver borrows printed powers only from colocated players", () => {
  const s = game(["Pumpkin Carver", "Digital Duke", "Violent J"]),
    [p, q, r] = s.players;
  q.region = p.region;
  q.pos = p.pos;
  r.pos = 1;
  assert.ok(has(s, p, "combat_nine_as_ten"));
  q.pos++;
  assert.ok(!has(s, p, "combat_nine_as_ten"));
  assert.ok(!has(s, p, "steal_homie"));
});
test("Cape range wraps around a region but does not cross regions", () => {
  const s = game(["Killnor", "Digital Duke", "Violent J"]),
    [p, q, r] = s.players;
  item(s, p, "Nosferatu's Cape");
  p.region = 0;
  p.pos = 0;
  q.region = 0;
  q.pos = 27;
  r.region = 1;
  r.pos = 0;
  assert.ok(has(s, p, "combat_nine_as_ten"));
  assert.ok(!has(s, p, "steal_homie"));
  q.pos = 3;
  assert.ok(!has(s, p, "combat_nine_as_ten"));
});
test("Amnesia disables borrowed powers and arrival at the starting space cures it", () => {
  const s = game(["Pumpkin Carver", "Digital Duke", "Violent J"]),
    p = s.players[0],
    q = s.players[1];
  q.pos = p.pos;
  bone(s, p, "Amnesia");
  assert.equal(powers(s, p).length, 0);
  s.ruling = null;
  p.pos = 24;
  s.phase = "move";
  s.choices = destinations(p, 1, s);
  applyAction(s, p.id, { type: "move", region: 0, pos: 25 });
  assert.ok(!p.bones.some((id) => cardName(id) === "Amnesia"));
  assert.ok(has(s, p, "combat_nine_as_ten"));
});
test("borrowed powers retain actual timing, costs and once-per-turn use", () => {
  const s = game(["Pumpkin Carver", "Double A", "Mack Benjamin"]),
    p = s.players[0],
    q = s.players[1];
  q.pos = p.pos;
  const cash = q.cash;
  applyAction(s, p.id, { type: "power", power: "take_cash", target: q.id });
  assert.equal(q.cash, cash - 100);
  assert.throws(
    () =>
      applyAction(s, p.id, { type: "power", power: "take_cash", target: q.id }),
    /already/,
  );
  p.cash = 0;
  assert.throws(
    () => applyAction(s, p.id, { type: "power", power: "purchase_extra_turn" }),
    /need \$200/,
  );
});
test("King High Bone uses ten real minutes and survives serialization", () => {
  const s = game(),
    p = s.players[0],
    before = Date.now();
  bone(s, p, "King High Bone");
  assert.ok(p.absentUntil >= before + 600000);
  const restored = JSON.parse(JSON.stringify(s));
  assert.equal(restored.players[0].absentUntil, p.absentUntil);
  assert.equal(tick(restored, p.absentUntil - 1), false);
  assert.equal(tick(restored, p.absentUntil), true);
  assert.equal(restored.players[0].absentUntil, undefined);
  assert.deepEqual(
    [restored.players[0].region, restored.players[0].pos],
    [p.region, p.pos],
  );
});
test("absent players cannot act or be targeted and their seat is skipped", () => {
  const s = game(),
    [p, q] = s.players;
  bone(s, p, "King High Bone");
  assert.throws(
    () =>
      applyAction(s, p.id, {
        type: "power",
        power: "change_allegiance",
        allegiance: "Dark Carnival",
      }),
    /ten-minute/,
  );
  end(s);
  assert.equal(s.players[s.turn].id, q.id);
  assert.throws(
    () => applyAction(s, q.id, { type: "trade", target: p.id, giveCash: 100 }),
    /living player/,
  );
});
test("all absent players pause rather than winning or throwing; expiry resumes without encounter", () => {
  const s = game(),
    t = Date.now() + 600000;
  for (const p of s.players) p.absentUntil = t;
  s.phase = "end";
  applyAction(s, s.host, { type: "end" });
  assert.equal(s.phase, "waiting");
  assert.equal(s.status, "playing");
  assert.equal(tick(s, t), true);
  assert.equal(s.phase, "roll");
  assert.equal(s.encounter, null);
});
test("Panic Attack and Insanity expire after three future own turns", () => {
  const s = game(),
    p = s.players[0];
  const id = bone(s, p, "Panic Attack");
  const start = s.turnsTaken[p.id];
  assert.equal(p.conditions[id].expiresAfterTurn, start + 3);
  for (let i = 0; i < 9; i++) end(s);
  assert.ok(p.bones.includes(id));
  end(s);
  assert.ok(!p.bones.includes(id));
  assert.equal(p.conditions[id], undefined);
});
test("Skitsofrantic transfers control for two future turns without exposing sessions", () => {
  const s = game(),
    [p, q] = s.players;
  const id = bone(s, p, "Skitsofrantic");
  s.ruling = null;
  s.phase = "roll";
  assert.equal(controllerFor(s, p), q.id);
  assert.throws(
    () => applyAction(s, p.id, { type: "roll", actor: p.id }),
    /controlled/,
  );
  const v = publicState(s, "s1");
  assert.equal(v.control, p.id);
  assert.ok(v.players.every((p) => !("session" in p)));
  random([2], () => applyAction(s, q.id, { type: "roll", actor: p.id }));
  assert.equal(s.phase, "move");
  assert.throws(
    () =>
      applyAction(s, s.players[2].id, {
        type: "move",
        actor: p.id,
        ...s.choices[0],
      }),
    /controlled/,
  );
  for (let i = 0; i < 7; i++) end(s);
  assert.ok(!p.bones.includes(id));
  assert.equal(controllerFor(s, p), p.id);
});
test("Amputation arm enforces three Item slots and the Hospital cures it for $300", () => {
  const s = game(),
    p = s.players[0];
  for (const name of ["Knife", "Axe", "Pistol", "Herb"]) item(s, p, name);
  const id = bone(s, p, "Amputation", [2]);
  assert.equal(capacity(p), 3);
  assert.equal(s.phase, "overflow");
  applyAction(s, p.id, { type: "overflow-discard", item: p.items[0] });
  assert.equal(p.items.length, 3);
  p.pos = 25;
  p.cash = 300;
  s.phase = "end";
  s.locationDone = true;
  applyAction(s, p.id, { type: "cure-bone", item: id });
  assert.equal(p.cash, 0);
  assert.equal(capacity(p), 6);
});
test("Crabs and Amputation leg reduce movement with a minimum of one", () => {
  const s = game(),
    p = s.players[0];
  bone(s, p, "Crabs");
  bone(s, p, "Amputation", [5]);
  s.ruling = null;
  s.phase = "roll";
  random([3], () => applyAction(s, p.id, { type: "roll" }));
  assert.equal(s.roll, 1);
});
test("Concussion permits clockwise movement and cures on an unmodified 6", () => {
  const s = game(),
    p = s.players[0];
  p.pos = 1;
  bone(s, p, "Concussion");
  assert.deepEqual(
    destinations(p, 1, s).map((d) => d.pos),
    [2],
  );
  s.phase = "roll";
  s.ruling = null;
  random([6], () => applyAction(s, p.id, { type: "roll" }));
  assert.ok(!p.bones.some((id) => cardName(id) === "Concussion"));
  assert.ok(destinations(p, 1, s).some((d) => d.pos === 0));
});
test("Random Bone Generator occupies an Item slot, modifies movement, cannot be sold, and cures at Chaos District", () => {
  const s = game(),
    p = s.players[0];
  const id = bone(s, p, "Random Bone Generator");
  assert.ok(p.items.includes(id));
  assert.ok(!p.bones.includes(id));
  p.pos = 0;
  s.phase = "end";
  s.locationDone = true;
  assert.throws(
    () => applyAction(s, p.id, { type: "sell", item: id }),
    /Choose an Item/,
  );
  s.phase = "roll";
  s.ruling = null;
  random([5], () => applyAction(s, p.id, { type: "roll" }));
  assert.equal(s.roll, 4);
  p.region = 1;
  p.pos = 8;
  s.phase = "move";
  s.choices = destinations(p, 1, s);
  applyAction(s, p.id, { type: "move", region: 1, pos: 9 });
  assert.ok(!p.items.includes(id));
});
test("Karmageddon rejects acquired Cash and purchased Items until Oz", () => {
  const s = game(),
    p = s.players[0];
  bone(s, p, "Karmageddon");
  p.pos = 0;
  p.cash = 500;
  s.phase = "end";
  s.ruling = null;
  s.locationDone = true;
  const id = s.purchase.find((id) => cardName(id) === "Knife");
  applyAction(s, p.id, { type: "buy", item: id });
  assert.ok(!p.items.includes(id));
  assert.ok(s.purchase.includes(id));
  assert.equal(p.cash, 400);
  p.region = 1;
  p.pos = 16;
  s.phase = "move";
  s.choices = destinations(p, 1, s);
  applyAction(s, p.id, { type: "move", region: 1, pos: 17 });
  assert.ok(!p.bones.some((id) => cardName(id) === "Karmageddon"));
});
test("Skateboard prevention is an explicit choice before the Bone is drawn", () => {
  const s = game(),
    p = s.players[0];
  item(s, p, "Skateboard");
  const before = s.boneDeck.length;
  bone(s, p, "Crabs");
  assert.equal(s.phase, "decision");
  assert.equal(s.boneDeck.length, before);
  random([4], () =>
    applyAction(s, p.id, { type: "bone-decision", choice: "skateboard" }),
  );
  assert.equal(s.boneDeck.length, before);
  assert.ok(!p.bones.length);
});
test("Transfer the Bone selects a target and applies their immunity", () => {
  const s = game(["Killnor", "Cemetery Girl", "Violent J"]),
    p = s.players[0],
    q = s.players[1];
  bone(s, p, "Transfer the Bone");
  assert.equal(s.decision.kind, "bone-transfer");
  const before = s.boneDeck.length;
  applyAction(s, p.id, { type: "bone-decision", target: q.id });
  assert.equal(s.boneDeck.length, before);
  assert.equal(s.decision, null);
});
test("Crystal Ball inspection is private, cannot be repeated, and does not draw", () => {
  const s = game(),
    p = s.players[0];
  item(s, p, "Crystal Ball");
  const n = s.decks[1].length,
    id = s.decks[1].at(-1);
  applyAction(s, p.id, { type: "peek", region: 1 });
  assert.equal(s.decks[1].length, n);
  assert.equal(publicState(s, "s0").peek, id);
  assert.equal(publicState(s, "s1").peek, null);
  assert.equal(publicState(s, "spectator").peek, null);
  assert.throws(
    () => applyAction(s, p.id, { type: "peek", region: 2 }),
    /once/,
  );
});
test("base Combat Bonus cannot exceed the printed maximum of 25", () => {
  const s = game(),
    p = s.players[0];
  applyAction(s, p.id, { type: "table-rule", reason: "Verified bonus" });
  applyAction(s, p.id, {
    type: "ruling-adjust",
    stat: "bonus",
    amount: 100,
    reason: "Verified bonus",
  });
  assert.equal(p.bonus, 25);
});

test("Panic Attack turns a natural-ten PvP victory into a tie, except Mortal Combat", () => {
  for (const mortal of [false, true]) {
    const s = game(),
      [p, q] = s.players;
    bone(s, p, "Panic Attack");
    s.ruling = null;
    q.region = p.region;
    q.pos = p.pos;
    if (mortal) {
      reveal(s, "skull");
      applyAction(s, p.id, { type: "ending-target", target: q.id });
    } else {
      s.phase = "encounter";
      applyAction(s, p.id, { type: "attack", target: q.id });
    }
    applyAction(s, p.id, { type: "combat-choice", weapon: null });
    const before = q.life;
    random([10, 1], () =>
      applyAction(s, q.id, { type: "combat-choice", weapon: null }),
    );
    if (mortal) assert.equal(q.life, before - 1);
    else {
      assert.equal(s.combat, null);
      assert.equal(s.penalty, null);
      assert.equal(q.life, before);
    }
  }
});

test("Insanity overrides a natural-ten PvP roll and survives a saved-game reload", () => {
  let s = game(),
    [p, q] = s.players;
  bone(s, p, "Insanity");
  s.ruling = null;
  q.region = p.region;
  q.pos = p.pos;
  s.phase = "encounter";
  applyAction(s, p.id, { type: "attack", target: q.id });
  applyAction(s, p.id, { type: "combat-choice", weapon: null });
  s = JSON.parse(JSON.stringify(s));
  [p, q] = s.players;
  random([10, 1], () =>
    applyAction(s, q.id, { type: "combat-choice", weapon: null }),
  );
  assert.equal(s.penalty.winner, q.id);
  assert.equal(s.penalty.loser, p.id);
});

test("King High cancels its player’s pending ruling and keeps the next turn usable", () => {
  const s = game(),
    p = s.players[0];
  bone(s, p, "King High Bone");
  assert.equal(s.ruling, null);
  assert.equal(s.phase, "end");
  applyAction(s, p.id, { type: "end" });
  assert.equal(s.phase, "roll");
  assert.equal(s.ruling, null);
  applyAction(s, s.players[s.turn].id, { type: "roll" });
  assert.equal(s.phase, "move");
});

test("Casket recovery cannot be targeted or triggered a second time before returning", () => {
  const s = game(),
    p = s.players[0];
  item(s, p, "Casket");
  fatal(s, p);
  const recovery = p.casketRecovery;
  assert.throws(() => fatal(s, p), /living player/);
  assert.equal(p.casketRecovery, recovery);
  assert.equal(p.life, 1);
});

test("locked combat declarations cannot be edited through table controls", () => {
  const s = game(),
    [p, q] = s.players;
  q.region = p.region;
  q.pos = p.pos;
  s.phase = "encounter";
  applyAction(s, p.id, { type: "attack", target: q.id });
  applyAction(s, p.id, { type: "combat-choice", weapon: null });
  assert.throws(
    () =>
      applyAction(s, p.id, {
        type: "table-rule",
        reason: "Change locked bonus",
      }),
    /locked/,
  );
});

test("Karmageddon also rejects positive Cash from logged table effects", () => {
  const s = game(),
    p = s.players[0];
  bone(s, p, "Karmageddon");
  const before = p.cash;
  applyAction(s, p.id, {
    type: "ruling-adjust",
    stat: "cash",
    amount: 300,
    reason: "Card Cash reward",
  });
  assert.equal(p.cash, before);
  applyAction(s, p.id, {
    type: "ruling-adjust",
    stat: "cash",
    amount: -100,
    reason: "Card Cash loss",
  });
  assert.equal(p.cash, Math.max(0, before - 100));
});

test("former rules-edition rooms remain read-only and preserve their version", () => {
  const s = game();
  s.rulesVersion = 2;
  assert.equal(publicState(s, "s0").rulesVersion, 2);
  assert.equal(publicState(s, "s0").legacy, true);
  assert.throws(() => applyAction(s, s.host, { type: "roll" }), /old rules/);
});

test("finishing a fatal table effect leaves a legal end turn for Casket recovery", () => {
  const s = game(),
    p = s.players[0];
  item(s, p, "Casket");
  fatal(s, p);
  applyAction(s, p.id, { type: "ruling-finish", choice: "leave" });
  assert.equal(s.phase, "end");
  applyAction(s, p.id, { type: "end" });
  assert.notEqual(s.players[s.turn].id, p.id);
});

test("drawing Random Bone Generator into a full inventory pauses for an Item discard", () => {
  const s = game(),
    p = s.players[0];
  for (const name of [
    "Knife",
    "Axe",
    "Pistol",
    "Herb",
    "2-liter",
    "Bulletproof Vest",
  ])
    item(s, p, name);
  const id = bone(s, p, "Random Bone Generator");
  assert.equal(s.phase, "overflow");
  assert.equal(s.overflow.player, p.id);
  assert.ok(options(s, p.id).every((o) => o.action.item !== id));
});
test("Karmageddon discards the newly acquired Random Bone Generator Item", () => {
  const s = game(),
    p = s.players[0];
  bone(s, p, "Karmageddon");
  const id = bone(s, p, "Random Bone Generator");
  assert.ok(!p.items.includes(id));
  assert.ok(s.boneDiscard.includes(id));
});
test("Random Bone Generator modifies a Wraith roll without altering combat dice", () => {
  const s = game(),
    p = s.players[0];
  bone(s, p, "Random Bone Generator");
  s.ruling = null;
  reveal(s, "wraith");
  random([6], () => applyAction(s, p.id, { type: "ending-roll" }));
  assert.equal(s.status, "playing");
  assert.equal(s.lastDice[0], 5);
});

test("an undefined modified-zero ending result opens a ruling instead of inventing an outcome", () => {
  const s = game(),
    p = s.players[0];
  bone(s, p, "Random Bone Generator");
  s.ruling = null;
  reveal(s, "wand");
  random([1], () =>
    applyAction(s, p.id, { type: "ending-target", target: s.players[1].id }),
  );
  assert.equal(s.phase, "ruling");
  assert.match(s.ruling.reason, /modified zero/);
  assert.equal(s.players[1].life, s.players[1].maxLife);
});
test("a table ruling can preserve multiple survivors as joint winners", () => {
  const s = game(),
    [p, q] = s.players;
  applyAction(s, p.id, {
    type: "table-rule",
    reason: "Undefined ending result",
  });
  applyAction(s, p.id, {
    type: "ruling-adjust",
    stat: "win",
    winners: [p.id, q.id],
    reason: "Survivors after ending rounds",
  });
  assert.deepEqual(s.winners, [p.id, q.id]);
  assert.equal(s.status, "finished");
});

test("many missed turns do not leave a present table stuck waiting for an absence", () => {
  const s = game([
    "Killnor",
    "Violent J",
    "Mack Benjamin",
    "Double A",
    "Digital Duke",
    "Squeezy",
  ]);
  for (const p of s.players) p.skip = 10;
  s.phase = "end";
  applyAction(s, s.host, { type: "end" });
  assert.equal(s.phase, "roll");
  assert.equal(s.status, "playing");
});
