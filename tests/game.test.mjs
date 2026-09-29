import test from "node:test";
import assert from "node:assert/strict";
import {
  makeRoom,
  newPlayer,
  applyAction,
  publicState,
  destinations,
  CARDS,
  ROSTER,
  CHARACTERS,
  ENDINGS,
  card,
  cardName,
  score,
  options,
} from "../lib/game.ts";
function random(values, fn) {
  const original = crypto.getRandomValues;
  crypto.getRandomValues = (a) => {
    a[0] = (values.shift() ?? 6) - 1;
    return a;
  };
  try {
    return fn();
  } finally {
    crypto.getRandomValues = original;
  }
}
function game(names = ["Violent J", "Mack Benjamin"]) {
  const s = makeRoom("ABC234", "s0", "First", names[0]);
  for (let i = 1; i < names.length; i++) {
    const p = newPlayer("s" + i, "Player " + i, names[i], i);
    p.ready = true;
    s.players.push(p);
  }
  random([10, ...names.slice(1).map(() => 1)], () =>
    applyAction(s, s.host, { type: "start" }),
  );
  return s;
}
function own(s, p, name) {
  const c = CARDS.find((c) => c.name === name);
  assert.ok(c, name);
  const groups = [
    ...s.decks,
    ...s.discards,
    s.purchase,
    s.boneDeck,
    s.boneDiscard,
  ];
  let id;
  for (const d of groups) {
    const i = d.findIndex((id) => card(id).key === c.key);
    if (i >= 0) {
      id = d.splice(i, 1)[0];
      break;
    }
  }
  assert.ok(id, "available " + name);
  p[c.kind === "homie" ? "homies" : c.kind === "bone" ? "bones" : "items"].push(
    id,
  );
  return id;
}
function enter(s, id) {
  const p = s.players[s.turn];
  p.region = 2;
  p.pos = 6;
  p.bonus = 15;
  s.ending = id;
  s.phase = "move";
  s.choices = destinations(p, 1, s);
  applyAction(s, p.id, { type: "move", region: 3, pos: 0 });
  return p;
}
function fight(s, p, q, values = [10, 1], extra = {}) {
  s.phase = "encounter";
  p.region = q.region = 0;
  p.pos = q.pos = 1;
  applyAction(s, p.id, { type: "attack", target: q.id });
  applyAction(s, p.id, { type: "combat-choice", weapon: null, ...extra });
  random(values, () =>
    applyAction(s, q.id, { type: "combat-choice", weapon: null }),
  );
}
test("active roster and researched encounter decks retain their expected counts", () => {
  assert.equal(ROSTER.length, 18);
  assert.equal(ENDINGS.length, 10);
  assert.deepEqual(
    [0, 1, 2].map((r) =>
      CARDS.filter((c) => c.deck === r).reduce((n, c) => n + c.copies, 0),
    ),
    [101, 90, 69],
  );
  assert.equal(CARDS.filter((c) => c.deck === "bone").length, 13);
  assert.equal(
    CARDS.filter((c) => c.deck === "purchase").reduce(
      (n, c) => n + c.copies,
      0,
    ),
    40,
  );
  assert.ok(
    CARDS.filter((c) => c.deck !== "ending").every((c) => c.rules && c.source),
  );
  assert.equal(
    CARDS.some((c) => c.name === "Last Guardian"),
    false,
  );
});
test("all playable characters start with audited unique records and starting Items", () => {
  for (const c of ROSTER) {
    const p = newPlayer("s", c.name, c.name, 0);
    assert.equal(p.life, c.startingLife);
    assert.equal(p.maxLife, c.maxLife);
    assert.equal(p.bonus, c.baseCombatBonus);
    assert.equal(p.cash, c.startingCash);
    assert.deepEqual(p.items.map(cardName), c.startingItems);
  }
  assert.equal(newPlayer("s", "J", "Violent J", 0).life, 4);
  assert.equal(newPlayer("s", "C", "Cemetery Girl", 0).bonus, 0);
});
test("highest starting roll wins; one ready player cannot start", () => {
  const s = makeRoom("ABC234", "s", "A", "Digital Duke");
  assert.throws(() => applyAction(s, s.host, { type: "start" }), /two ready/);
  const q = newPlayer("b", "B", "Double A", 1);
  s.players.push(q);
  assert.throws(() => applyAction(s, s.host, { type: "start" }), /ready/);
  q.ready = true;
  random([2, 9], () => applyAction(s, s.host, { type: "start" }));
  assert.equal(s.turn, 1);
});
test("starting Items come from finite Purchase stock", () => {
  const s = game();
  assert.equal(s.purchase.length, 36);
  const all = [...s.purchase, ...s.players.flatMap((p) => p.items)];
  assert.equal(new Set(all).size, 40);
});
test("private deck order, ending and session tokens never leave server", () => {
  const s = game(),
    v = publicState(s, "s0");
  for (const key of ["decks", "endingPool", "boneDeck"])
    assert.equal(v[key], undefined);
  assert.equal(v.ending, null);
  assert.ok(v.players.every((p) => !("session" in p)));
  assert.equal(v.me, s.host);
});
test("wrong turn, repeat rolls and illegal moves are rejected", () => {
  const s = game(),
    [p, q] = s.players;
  assert.throws(() => applyAction(s, q.id, { type: "roll" }), /Wait/);
  random([3], () => applyAction(s, p.id, { type: "roll" }));
  assert.throws(() => applyAction(s, p.id, { type: "roll" }), /beginning/);
  assert.throws(
    () => applyAction(s, p.id, { type: "move", region: 3, pos: 0 }),
    /highlighted/,
  );
  assert.throws(() => applyAction(s, p.id, { type: "end" }), /Finish/);
});
test("Pipeline costs $100; Portal costs an Item; base CB gates Shangri-La", () => {
  const s = game(),
    p = s.players[0];
  p.region = 0;
  p.pos = 11;
  p.cash = 0;
  assert.ok(destinations(p, 1, s).every((d) => d.region === 0));
  p.cash = 100;
  assert.ok(
    destinations(p, 1, s).some((d) => d.region === 1 && d.toll === 100),
  );
  p.region = 1;
  p.pos = 18;
  p.cash = 0;
  assert.ok(destinations(p, 1, s).some((d) => d.region === 2 && d.itemToll));
  p.items = [];
  assert.ok(destinations(p, 1, s).every((d) => d.region !== 2));
  p.region = 2;
  p.pos = 6;
  p.bonus = 14;
  assert.ok(destinations(p, 1, s).every((d) => d.region !== 3));
  p.bonus = 15;
  assert.ok(destinations(p, 1, s).some((d) => d.region === 3));
});
test("Magic Ninja pays neither toll but still needs base CB 15", () => {
  const s = game(["Magic Ninja", "Mack Benjamin"]),
    p = s.players[0];
  p.cash = 0;
  p.region = 1;
  p.pos = 18;
  p.items = [];
  assert.ok(
    destinations(p, 1, s).some((d) => d.region === 2 && !d.itemToll && !d.toll),
  );
  p.region = 2;
  p.pos = 6;
  p.bonus = 14;
  assert.ok(destinations(p, 1, s).every((d) => d.region !== 3));
});
test("Portal requires a real discarded Item, which returns to Purchase stock", () => {
  const s = game(),
    p = s.players[0],
    id = p.items[0];
  p.region = 1;
  p.pos = 18;
  s.phase = "move";
  s.choices = destinations(p, 1, s);
  assert.throws(
    () => applyAction(s, p.id, { type: "move", region: 2, pos: 11 }),
    /one Item/,
  );
  applyAction(s, p.id, { type: "move", region: 2, pos: 11, item: id });
  assert.ok(!p.items.includes(id));
  assert.ok(s.purchase.includes(id));
  assert.equal(p.cash, 100);
});
test("existing cards are encountered before the printed space", () => {
  const s = game(),
    p = s.players[0];
  s.phase = "encounter";
  p.pos = 0;
  const id = s.decks[0].pop();
  s.board["0:0"] = [id];
  applyAction(s, p.id, { type: "location" });
  assert.equal(s.encounter, id);
  assert.equal(s.locationDone, false);
});
test("board rules use real healing prices and skip-turn effects", () => {
  const s = game(),
    p = s.players[0];
  p.pos = 25;
  p.life = 2;
  p.cash = 100;
  s.phase = "encounter";
  applyAction(s, p.id, { type: "location" });
  applyAction(s, p.id, { type: "heal", amount: 1 });
  assert.equal(p.life, 3);
  assert.equal(p.cash, 0);
  p.pos = 18;
  s.phase = "encounter";
  s.locationDone = false;
  applyAction(s, p.id, { type: "location" });
  assert.equal(p.skip, 1);
  assert.equal(s.phase, "end");
});
test("automatic fiend reward uses the printed Combat Bonus", () => {
  const s = game(),
    p = s.players[0];
  const id = s.decks[2].find(
    (id) => card(id).kind === "fiend" && card(id).automatic,
  );
  const c = card(id);
  s.phase = "encounter";
  s.encounter = id;
  s.board["0:1"] = [id];
  p.pos = 1;
  const old = p.bonus;
  applyAction(s, p.id, { type: "resolve" });
  random([10], () =>
    applyAction(s, p.id, { type: "combat-choice", weapon: null }),
  );
  assert.equal(p.bonus, old + c.reward);
  assert.ok(s.discards[2].includes(id));
});
test("PvP waits for both combat choices and winner chooses cash penalty", () => {
  const s = game(),
    [p, q] = s.players;
  q.cash = 450;
  fight(s, p, q);
  assert.equal(s.phase, "penalty");
  assert.equal(s.penalty.winner, p.id);
  assert.throws(
    () => applyAction(s, q.id, { type: "penalty", choice: "cash" }),
    /winner/,
  );
  applyAction(s, p.id, { type: "penalty", choice: "cash" });
  assert.equal(p.cash, 400);
  assert.equal(q.cash, 150);
  assert.equal(p.bonus, 1);
});
test("both natural 10s tie regardless of bonuses", () => {
  const s = game(),
    [p, q] = s.players;
  p.bonus = 50;
  fight(s, p, q, [10, 10]);
  assert.equal(s.phase, "end");
  assert.equal(s.penalty, null);
});
test("Digital Duke combat 9 is treated as 10", () => {
  const s = game(["Digital Duke", "Mack Benjamin"]),
    [p, q] = s.players;
  q.bonus = 100;
  fight(s, p, q, [9, 8]);
  assert.equal(s.penalty.winner, p.id);
});
test("weapon breakage returns a Purchase Item to stock", () => {
  const s = game(),
    [p, q] = s.players;
  const weapon = p.items.find((id) => card(id).weapon);
  fight(s, p, q, [1, 7], { weapon });
  assert.ok(!p.items.includes(weapon));
  assert.ok(s.purchase.includes(weapon));
});
test("ranged attacker cannot be damaged by a melee defender", () => {
  const s = game(["Mack Benjamin", "Violent J"]),
    [p, q] = s.players;
  p.pos = 1;
  q.pos = 2;
  s.phase = "encounter";
  const life = p.life;
  applyAction(s, p.id, { type: "ranged", target: q.id });
  applyAction(s, p.id, {
    type: "combat-choice",
    weapon: p.items.find((id) => card(id).ranged),
  });
  random([2, 10], () =>
    applyAction(s, q.id, {
      type: "combat-choice",
      weapon: q.items.find((id) => card(id).weapon),
    }),
  );
  assert.equal(p.life, life);
  assert.equal(s.phase, "end");
});
test("armor can prevent a chosen combat Life penalty", () => {
  const s = game(),
    [p, q] = s.players;
  fight(s, p, q);
  s.penalty.defense = q.items.find((id) => card(id).use === "armor");
  const life = q.life;
  random([8], () => applyAction(s, p.id, { type: "penalty", choice: "life" }));
  assert.equal(q.life, life);
});
test("consented trades transfer only Items and Cash", () => {
  const s = game(),
    [p, q] = s.players;
  q.pos = p.pos;
  const id = p.items[0];
  applyAction(s, p.id, { type: "trade", target: q.id, give: id, askCash: 100 });
  assert.ok(p.items.includes(id));
  assert.throws(
    () => applyAction(s, p.id, { type: "trade-accept" }),
    /addressed/,
  );
  applyAction(s, q.id, { type: "trade-accept" });
  assert.ok(q.items.includes(id));
  assert.equal(q.cash, 0);
  assert.equal(p.cash, 200);
});
test("unautomated card effects require a visible ruling, not invented automatic results", () => {
  const s = game(),
    p = s.players[0];
  const id = s.decks[0].find((id) => card(id).kind === "event");
  s.board["0:0"] = [id];
  s.encounter = id;
  s.phase = "encounter";
  applyAction(s, p.id, { type: "resolve" });
  assert.equal(s.phase, "ruling");
  const before = p.cash;
  applyAction(s, p.id, {
    type: "ruling-adjust",
    stat: "cash",
    amount: 100,
    reason: "Test source effect",
  });
  assert.equal(p.cash, before + 100);
  assert.match(s.log[0], /Test source effect/);
  applyAction(s, p.id, { type: "ruling-finish", choice: "discard" });
  assert.equal(s.phase, "end");
  assert.ok(s.discards[0].includes(id));
});
test("manual adjustments require an open ruling and authorized resolver", () => {
  const s = game(),
    [p, q] = s.players;
  assert.throws(
    () =>
      applyAction(s, p.id, {
        type: "ruling-adjust",
        stat: "cash",
        amount: 100,
        reason: "test",
      }),
    /No table ruling/,
  );
  applyAction(s, p.id, { type: "table-rule", reason: "Resolve a card" });
  assert.throws(
    () =>
      applyAction(s, q.id, {
        type: "ruling-adjust",
        stat: "cash",
        amount: 100,
        reason: "test",
      }),
    /resolving player/,
  );
});
test("a seventh Item pauses for inventory choice; Backpack permits nine", () => {
  const s = game(),
    p = s.players[0];
  for (const name of ["Knife", "Tomahawk", "Pistol", "Herb"]) own(s, p, name);
  s.phase = "end";
  s.locationDone = true;
  p.cash = 10000;
  p.pos = 0;
  const id = s.purchase.find((id) => cardName(id) === "Axe");
  applyAction(s, p.id, { type: "buy", item: id });
  assert.equal(s.phase, "overflow");
  applyAction(s, p.id, { type: "overflow-discard", item: id });
  assert.equal(p.items.length, 6);
  assert.equal(s.phase, "end");
  own(s, p, "Backpack");
  applyAction(s, p.id, {
    type: "buy",
    item: s.purchase.find((id) => cardName(id) === "Axe"),
  });
  assert.equal(p.items.length, 8);
  assert.equal(s.overflow, null);
});
test("first death changes character, inherits Cash and returns at next turn", () => {
  const s = game(["Violent J", "Mack Benjamin", "Killnor"]),
    p = s.players[0],
    old = p.character;
  p.life = 1;
  p.cash = 400;
  applyAction(s, p.id, { type: "table-rule", reason: "Verified life loss" });
  random([1, 6, 6], () =>
    applyAction(s, p.id, {
      type: "ruling-adjust",
      stat: "life",
      amount: -1,
      reason: "Verified life loss",
    }),
  );
  assert.notEqual(p.character, old);
  assert.equal(p.rebirth, true);
  assert.equal(p.respawn, true);
  assert.ok(p.cash >= 500);
  assert.ok(s.usedCharacters.includes(old));
});
test("The Unveiling immediately wins", () => {
  const s = game(),
    p = enter(s, "unveiling");
  assert.equal(s.status, "finished");
  assert.equal(s.winner, p.id);
});
test("17th Dimension eliminates entrant and never re-enables rebirth", () => {
  const s = game(["Violent J", "Mack Benjamin", "Killnor"]),
    p = enter(s, "dimension");
  assert.ok(p.dead);
  assert.ok(s.finalEntered);
  assert.equal(s.finalRevealed, false);
  applyAction(s, p.id, { type: "end" });
  const q = s.players[s.turn];
  applyAction(s, q.id, { type: "table-rule", reason: "Lethal effect" });
  applyAction(s, q.id, {
    type: "ruling-adjust",
    stat: "life",
    amount: -20,
    reason: "Lethal effect",
  });
  assert.ok(q.dead);
  assert.equal(q.rebirth, false);
});
test("Diamond Rain wins on sixth holder turn", () => {
  const s = game(),
    p = enter(s, "diamond");
  assert.equal(s.endingProgress[p.id], 1);
  for (let i = 0; i < 5; i++) {
    s.phase = "roll";
    applyAction(s, p.id, { type: "roll" });
  }
  assert.equal(s.winner, p.id);
  assert.equal(s.endingProgress[p.id], 6);
});
test("The Wraith retains per-player failures and then wins", () => {
  const s = game(),
    p = enter(s, "wraith"),
    life = p.life;
  random([2], () => applyAction(s, p.id, { type: "ending-roll" }));
  assert.equal(p.life, life - 1);
  assert.equal(s.endingProgress[p.id], 1);
  s.phase = "roll";
  random([5], () => applyAction(s, p.id, { type: "roll" }));
  assert.equal(s.winner, p.id);
});
test("Drunken Ninja Master win and Mr Rotten Treats three wins", () => {
  const s = game(),
    p = enter(s, "ninja");
  random([10], () =>
    applyAction(s, p.id, { type: "combat-choice", weapon: null }),
  );
  assert.equal(s.winner, p.id);
  const t = game(),
    q = enter(t, "rotten");
  for (let i = 0; i < 3; i++)
    random([10], () =>
      applyAction(t, q.id, { type: "combat-choice", weapon: null }),
    );
  assert.equal(t.winner, q.id);
});
test("Outer Space executes at most three elimination rounds and allows shared victory", () => {
  const s = game();
  random([6, 6, 6, 6, 6, 6], () => enter(s, "outer-space"));
  assert.equal(s.status, "finished");
  assert.equal(s.winners.length, 2);
});
test("Wand targets the selected player and can eliminate on 10", () => {
  const s = game(),
    p = enter(s, "wand"),
    q = s.players[1];
  assert.ok(p.items.includes("ending-wand@0"));
  random([10], () =>
    applyAction(s, p.id, { type: "ending-target", target: q.id }),
  );
  assert.ok(q.dead);
  assert.equal(s.winner, p.id);
});
test("Crystal Skull starts Mortal Combat against target", () => {
  const s = game(),
    p = enter(s, "skull"),
    q = s.players[1];
  applyAction(s, p.id, { type: "ending-target", target: q.id });
  assert.equal(s.combat.mortal, true);
  assert.equal(p.region, q.region);
  assert.equal(p.pos, q.pos);
  assert.equal(score(p, s, null, q, false, true), p.bonus + 3);
});
test("Necronomicon is an Item and wins at a cemetery-adjacent destination", () => {
  const s = game(),
    p = enter(s, "book");
  assert.ok(p.items.includes("ending-book@0"));
  p.region = 0;
  p.pos = 7;
  s.phase = "move";
  s.choices = destinations(p, 1, s);
  applyAction(s, p.id, { type: "move", region: 0, pos: 8 });
  assert.equal(s.winner, p.id);
});
test("legacy rooms are readable but cannot be changed into mixed rules", () => {
  const s = game();
  delete s.rulesVersion;
  const v = publicState(s, "s0");
  assert.equal(v.legacy, true);
  assert.ok(v.players.every((p) => !("session" in p)));
  assert.throws(() => applyAction(s, s.host, { type: "roll" }), /old rules/);
});


test("removed characters cannot be created or selected through lobby actions", () => {
  const s = makeRoom("ABC234", "s0", "First", "Violent J");
  for (const name of ["Jamie Madrox", "Monoxide", "Blaze"]) {
    assert.ok(!CHARACTERS.includes(name));
    assert.throws(() => newPlayer("s1", "Guest", name, 1), /available roster/);
    assert.throws(() => applyAction(s, s.host, {type: "character", character: name}), /available roster/);
    assert.equal(s.players[0].character, "Violent J");
  }
  while (s.players.length < 6) applyAction(s, s.host, {type: "add-bot"});
  assert.ok(s.players.every(p => CHARACTERS.includes(p.character)));
  assert.equal(publicState(s, "s0").coverage.characters, 18);
});

test("saved seats using retired character rules still reconnect", () => {
  for (const name of ["Jamie Madrox", "Monoxide", "Blaze"]) {
    const s = game();
    s.players[0].character = name;
    const view = publicState(s, "s0");
    assert.equal(view.me, s.host);
    assert.equal(view.players[0].character, name);
    assert.ok(view.yourPowers.length > 0);
  }
});
