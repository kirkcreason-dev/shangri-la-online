import test from "node:test";
import assert from "node:assert/strict";
import {
  makeRoom,
  newPlayer,
  applyAction,
  publicState,
  CARDS,
  card,
  cardName,
  options,
  score,
  findSpace,
} from "../lib/game.ts";
function game() {
  const s = makeRoom("ABC234", "s0", "First", "Violent J");
  s.players.push(newPlayer("s1", "Second", "Mack Benjamin", 1));
  s.status = "playing";
  s.turnsTaken = Object.fromEntries(s.players.map((p) => [p.id, 1]));
  for (const p of s.players) {
    p.items = [];
    p.homies = [];
    p.region = 0;
    p.pos = 1;
    p.bonus = 3;
    p.cash = 500;
  }
  return s;
}
function take(s, name) {
  const c = CARDS.find((c) => c.name === name);
  assert.ok(c, name);
  for (const d of [
    ...s.decks,
    ...s.discards,
    s.purchase,
    s.boneDeck,
    s.boneDiscard,
  ]) {
    const i = d.findIndex((id) => card(id).key === c.key);
    if (i >= 0) return d.splice(i, 1)[0];
  }
  throw Error("Missing " + name);
}
function own(s, p, name) {
  const id = take(s, name);
  p[
    card(id).kind === "homie"
      ? "homies"
      : card(id).kind === "bone"
        ? "bones"
        : "items"
  ].push(id);
  return id;
}
function random(values, fn) {
  const old = crypto.getRandomValues;
  crypto.getRandomValues = (a) => {
    a[0] = (values.shift() ?? 6) - 1;
    return a;
  };
  try {
    return fn();
  } finally {
    crypto.getRandomValues = old;
  }
}
function act(s, p, a, rolls = []) {
  random(rolls, () => applyAction(s, p.id, a));
}
function respond(s, choice, rolls = []) {
  assert.ok(s.flow, "pending card choice");
  const id = s.flow.prompt.player;
  random(rolls, () => applyAction(s, id, { type: "card-response", choice }));
}
function use(s, p, item, extra = {}, rolls = []) {
  act(s, p, { type: "item-use", item, ...extra }, rolls);
}
function attack(s, p, q) {
  s.phase = "encounter";
  act(s, p, { type: "attack", target: q.id });
}
function combat(s, p, q, weapon = null, rolls = [10, 1]) {
  attack(s, p, q);
  act(s, p, { type: "combat-choice", weapon });
  act(s, q, { type: "combat-choice", weapon: null }, rolls);
}
function fiend(s, p) {
  const c = CARDS.find((c) => c.kind === "fiend" && c.automatic);
  const id = take(s, c.name);
  s.board[`${p.region}:${p.pos}`] = [id];
  s.encounter = id;
  s.phase = "encounter";
  act(s, p, { type: "resolve" });
  return id;
}
function drawBone(s, p, name) {
  const id = take(s, name);
  s.boneDeck.push(id);
  s.phase = "roll";
  act(s, p, { type: "table-rule", reason: "Source effect test" });
  act(s, p, {
    type: "ruling-adjust",
    stat: "draw",
    deck: "bone",
    reason: "Source effect test",
  });
  return id;
}

test("Toy Box suspends a cross-player die, persists through reload, hides random tape and applies only once", () => {
  let s = game();
  let [p, q] = s.players;
  const toy = own(s, q, "Toy Box");
  act(s, p, { type: "roll" }, [2]);
  assert.ok(s.flow);
  assert.equal(s.phase, "roll");
  const view = publicState(s, "s1");
  assert.equal(view.control, q.id);
  assert.equal(view.pendingCard.player, q.id);
  assert.equal(view.flow, undefined);
  assert.equal(view.decks, undefined);
  assert.equal(publicState(s, "spectator").options.length, 0);
  assert.throws(
    () => applyAction(s, p.id, { type: "card-response", choice: "toy" }),
    /controlling/,
  );
  assert.throws(
    () => applyAction(s, q.id, { type: "card-response", choice: "invalid" }),
    /displayed/,
  );
  s = JSON.parse(JSON.stringify(s));
  [p, q] = s.players;
  respond(s, "toy", [5]);
  assert.equal(s.roll, 5);
  assert.ok(!q.items.includes(toy));
  assert.ok(!s.flow);
  assert.throws(() =>
    applyAction(s, q.id, { type: "card-response", choice: "toy" }),
  );
});
test("Behind the Paint is declared before rolling and leaves a natural six unchanged", () => {
  for (const [raw, expected] of [
    [4, 5],
    [6, 6],
  ]) {
    const s = game(),
      p = s.players[0];
    own(s, p, "Behind the Paint");
    act(s, p, { type: "roll" });
    assert.match(s.flow.prompt.message, /Before/);
    respond(s, "paint", [raw]);
    assert.equal(s.roll, expected);
  }
});
test("Bridget affects a movement die once and is discarded", () => {
  const s = game(),
    p = s.players[0],
    id = own(s, p, "Bridget");
  act(s, p, { type: "roll" });
  respond(s, "bridget", [3]);
  assert.equal(s.roll, 5);
  assert.ok(!p.homies.includes(id));
});
test("Ice Man rerolls a natural one once even if the replacement is another one", () => {
  const s = game(),
    p = s.players[0];
  own(s, p, "The Ice Man");
  act(s, p, { type: "roll" }, [1]);
  respond(s, "ice", [1]);
  assert.equal(s.roll, 1);
  assert.ok(!s.flow);
});
test("a declined cross-player Toy Box does not reroll the recorded die", () => {
  const s = game(),
    [p, q] = s.players;
  own(s, q, "Toy Box");
  act(s, p, { type: "roll" }, [4]);
  respond(s, "keep", [1]);
  assert.equal(s.roll, 4);
});
test("each regional movement Homie persists both rolls for a die choice", () => {
  for (const [region, name] of ["Stefan", "Moon Glorious", "Choko"].entries()) {
    const s = game(),
      p = s.players[0];
    p.region = region;
    own(s, p, name);
    act(s, p, { type: "roll", choice: "pick" }, [2, 5]);
    assert.deepEqual(s.itemPrompt.values, [2, 5]);
    const saved = JSON.parse(JSON.stringify(s));
    act(saved, saved.players[0], { type: "movement-choice", amount: 0 });
    assert.equal(saved.roll, 2);
    assert.equal(saved.phase, "move");
  }
});
test("Black Truck sums two dice without movement Item or Homie bonuses", () => {
  const s = game(),
    p = s.players[0];
  own(s, p, "Black Truck");
  own(s, p, "Behind the Paint");
  own(s, p, "Bridget");
  own(s, p, "The Ice Man");
  act(s, p, { type: "roll", choice: "truck" }, [1, 5]);
  assert.equal(s.roll, 6);
  assert.ok(!s.flow);
  assert.equal(p.homies.length, 2);
});
test("Regal offers one- and two-space movement without consuming a die", () => {
  const s = game(),
    p = s.players[0],
    id = own(s, p, "’84 Regal");
  p.pos = 3;
  use(s, p, id);
  assert.equal(s.phase, "move");
  assert.deepEqual(
    s.choices.map((d) => d.pos).sort((a, b) => a - b),
    [1, 2, 4, 5],
  );
  assert.deepEqual(s.lastDice, []);
});
test("Wagon lasts exactly two consecutive turns and Morton gives exactly three turns", () => {
  for (const [name, total] of [
    ["Wagon", 2],
    ["Morton's List", 3],
  ]) {
    const s = game(),
      p = s.players[0],
      id = own(s, p, name);
    use(s, p, id);
    for (let turn = 1; turn <= total; turn++) {
      assert.equal(s.players[s.turn].id, p.id);
      if (name === "Wagon") {
        act(s, p, { type: "roll" });
        assert.equal(s.choices.length, 61);
      }
      s.phase = "end";
      act(s, p, { type: "end" });
    }
    assert.notEqual(s.players[s.turn].id, p.id);
    s.phase = "end";
    act(s, s.players[s.turn], { type: "end" });
    assert.equal(p.wagonUntil, undefined);
  }
});
test("start-turn healing rejects late or foreign actions and consumes the Item", () => {
  for (const name of ["Health Insurance Card", "The Book of Life"]) {
    const s = game(),
      [p, q] = s.players,
      id = own(s, p, name);
    p.life = 1;
    const snapshot = JSON.stringify(s);
    assert.throws(() => use(s, q, id));
    assert.equal(JSON.stringify(s), snapshot);
    s.phase = "end";
    assert.throws(() => use(s, p, id));
    s.phase = "roll";
    use(s, p, id);
    assert.equal(p.life, name === "The Book of Life" ? p.maxLife : 2);
    assert.ok(!p.items.includes(id));
  }
});
test("Spider charges once per round and becomes available on the next Mortal Combat round", () => {
  const s = game(),
    [p, q] = s.players,
    id = own(s, p, "Spider");
  attack(s, p, q);
  s.combat.mortal = true;
  use(s, p, id);
  assert.equal(p.cash, 400);
  assert.throws(() => use(s, p, id));
  act(s, p, { type: "combat-choice", weapon: null });
  act(s, q, { type: "combat-choice", weapon: null }, [10, 10]);
  assert.ok(s.combat);
  use(s, p, id);
  assert.equal(p.cash, 300);
});
test("Face Paint and Ghost of Dolemite consume for a single combat boost", () => {
  for (const name of ["Face Paint", "Ghost of Dolemite"]) {
    const s = game(),
      [p, q] = s.players,
      id = own(s, p, name);
    p.allegiance = "Dark Carnival";
    attack(s, p, q);
    use(s, p, id);
    assert.equal(p.boost, 3);
    assert.ok(![...p.items, ...p.homies].includes(id));
    act(s, p, { type: "combat-choice", weapon: null });
    act(s, q, { type: "combat-choice", weapon: null }, [5, 5]);
    assert.equal(s.penalty.winner, p.id);
    assert.equal(p.boost, 0);
  }
});
test("conditional combat bonuses distinguish ranged, PvP and Mortal Combat", () => {
  const s = game(),
    [p, q] = s.players;
  const baseline = score(p, s, null, q);
  own(s, p, "Rude Boy");
  p.allegiance = "Dark Carnival";
  assert.equal(score(p, s, null, q), baseline + 2);
  assert.equal(score(p, s, null), baseline);
  own(s, p, "The China Man");
  assert.equal(score(p, s, null, q, true), baseline + 4);
  own(s, p, "Iced-Out Charm");
  assert.equal(score(p, s, null, q, false, true), baseline + 5);
  const gun = own(s, p, "Ninja Detector Gun");
  assert.equal(score(p, s, gun, q, false), baseline + 2);
  assert.equal(score(p, s, gun, q, true), baseline + 7);
});
test("Officer Harry Cox blocks weapon declarations and leaves at Chaos District", () => {
  const s = game(),
    [p, q] = s.players,
    id = own(s, p, "Officer Harry Cox"),
    w = own(s, p, "Rusty Axe");
  attack(s, p, q);
  assert.throws(
    () => act(s, p, { type: "combat-choice", weapon: w }),
    /prevents/,
  );
  s.combat = null;
  s.phase = "move";
  s.choices = [{ ...findSpace("Chaos District"), toll: 0 }];
  act(s, p, { type: "move", ...findSpace("Chaos District") });
  assert.ok(!p.homies.includes(id));
});
test("Mr Johnsons Head wins without rolling and cannot be used in Mortal Combat", () => {
  const s = game(),
    [p, q] = s.players,
    id = own(s, p, "Mr. Johnson's Head");
  p.allegiance = "Nethervoid";
  attack(s, p, q);
  s.combat.mortal = true;
  assert.throws(() => use(s, p, id));
  s.combat.mortal = false;
  use(s, p, id);
  act(s, p, { type: "combat-choice", weapon: null });
  act(s, q, { type: "combat-choice", weapon: null }, [1, 10]);
  assert.deepEqual(s.lastDice, []);
  assert.equal(s.penalty.winner, p.id);
});
test("Kittie forces a defensive tie and transfers to the attacker", () => {
  const s = game(),
    [p, q] = s.players,
    id = own(s, q, "Fat Tittie Kittie");
  attack(s, p, q);
  use(s, q, id);
  assert.equal(s.combat, null);
  assert.equal(s.phase, "end");
  assert.ok(p.homies.includes(id));
  assert.ok(!q.homies.includes(id));
});
test("Human Highlight Reel removes one Fiend without granting its reward", () => {
  const s = game(),
    p = s.players[0],
    id = own(s, p, "The Human Highlight Reel"),
    f = fiend(s, p),
    before = p.bonus;
  use(s, p, id);
  assert.equal(p.bonus, before);
  assert.ok(s.discards.flat().includes(f));
  assert.ok(!p.homies.includes(id));
});
test("Green Book redirects a Fiend and discards it even when the target loses", () => {
  const s = game(),
    [p, q] = s.players,
    id = own(s, p, "The Green Book"),
    f = fiend(s, p),
    life = q.life;
  use(s, p, id, { target: q.id });
  assert.equal(s.combat.attacker, q.id);
  act(s, q, { type: "combat-choice", weapon: null }, [1]);
  assert.equal(q.life, life - 1);
  assert.ok(s.discards.flat().includes(f));
  assert.ok(!s.board["0:1"]);
  assert.equal(s.phase, "end");
});
test("Evil Dead prevents a combat loss of Life without consuming the Homie", () => {
  const s = game(),
    [p, q] = s.players,
    id = own(s, q, "Evil Dead"),
    life = q.life;
  combat(s, p, q);
  act(s, p, { type: "penalty", choice: "life" }, [8]);
  assert.equal(q.life, life);
  assert.ok(q.homies.includes(id));
});
test("Jellynutz pauses lethal damage and can save the last Life", () => {
  const s = game(),
    [p, q] = s.players,
    id = own(s, q, "Jellynutz");
  q.life = 1;
  combat(s, p, q);
  act(s, p, { type: "penalty", choice: "life" });
  assert.equal(q.life, 1);
  assert.ok(s.flow);
  respond(s, "save");
  assert.equal(q.life, 1);
  assert.ok(!q.homies.includes(id));
  assert.equal(s.penalty, null);
});
test("Rocket Launcher is consumed and applies melee recoil after the selected penalty", () => {
  const s = game(),
    [p, q] = s.players,
    w = own(s, p, "Rocket Launcher"),
    life = p.life;
  combat(s, p, q, w);
  assert.ok(!p.items.includes(w));
  assert.equal(p.life, life);
  act(s, p, { type: "penalty", choice: "cash" });
  assert.equal(p.life, life - 1);
  assert.ok(!s.recoil);
});
test("Rocket Launcher has no recoil at range", () => {
  const s = game(),
    [p, q] = s.players,
    w = own(s, p, "Rocket Launcher"),
    life = p.life;
  q.pos = 2;
  s.phase = "encounter";
  act(s, p, { type: "ranged", target: q.id });
  act(s, p, { type: "combat-choice", weapon: w });
  act(s, q, { type: "combat-choice", weapon: null }, [10, 1]);
  assert.equal(p.life, life);
  assert.ok(!p.items.includes(w));
});
test("Blow-up Doll can save a selected Homie from a combat penalty", () => {
  const s = game(),
    [p, q] = s.players,
    h = own(s, q, "Stefan"),
    d = own(s, q, "Blow-up Doll");
  combat(s, p, q);
  act(s, p, { type: "penalty", choice: "homie", item: h });
  respond(s, "doll");
  assert.ok(q.homies.includes(h));
  assert.ok(!q.items.includes(d));
});
test("Dinglenut remembers three creations and borrowed weapons break after one use", () => {
  const s = game(),
    [p, q] = s.players,
    id = own(s, p, "Dr. Dinglenut");
  const w = s.purchase.find((x) => cardName(x) === "Axe");
  use(s, p, id, { choice: w });
  assert.ok(p.temporaryItems.includes(w));
  combat(s, p, q, w);
  assert.ok(!p.items.includes(w));
  act(s, p, { type: "penalty", choice: "cash" });
  for (let i = 0; i < 2; i++) {
    const x = s.purchase.find((x) => cardName(x) === "Axe");
    use(s, p, id, { choice: x });
  }
  assert.equal(p.cardUses[id], 3);
  assert.ok(!p.homies.includes(id));
});
test("borrowed Skateboard is discarded after its prevention roll", () => {
  const s = game(),
    p = s.players[0],
    skate = own(s, p, "Skateboard");
  p.temporaryItems = [skate];
  drawBone(s, p, "Crabs");
  assert.equal(s.phase, "decision");
  act(s, p, { type: "bone-decision", choice: "skateboard" }, [8]);
  assert.ok(!p.items.includes(skate));
  assert.equal(p.bones.length, 0);
});
test("Tony requires an attack after landing on another player", () => {
  const s = game(),
    [p, q] = s.players;
  own(s, p, "2 Tuff Tony");
  p.landed = true;
  s.phase = "encounter";
  assert.throws(() => act(s, p, { type: "location" }), /Tony/);
  assert.ok(!options(s, p.id).some((o) => o.action.type === "location"));
  assert.ok(options(s, p.id).some((o) => o.action.type === "attack"));
  assert.equal(score(p, s, null), p.bonus + 1);
});
test("landing theft transfers a chosen Homie once and consumes the source card", () => {
  for (const name of ["PuBu Gear", "Preacherman"]) {
    const s = game(),
      [p, q] = s.players,
      id = own(s, p, name),
      h = own(s, q, "Stefan");
    p.allegiance = "Nethervoid";
    s.phase = "encounter";
    assert.throws(() => use(s, p, id, { target: q.id, choice: h }));
    p.landed = true;
    use(s, p, id, { target: q.id, choice: h });
    assert.ok(p.homies.includes(h));
    assert.ok(!q.homies.includes(h));
    assert.ok(![...p.homies, ...p.items].includes(id));
  }
});
test("Betty discards other Homies, and Superballs removes Betty and itself", () => {
  const s = game(),
    p = s.players[0];
  own(s, p, "Stefan");
  for (const name of ["Fat Sweaty Betty", "Superballs"]) {
    const id = take(s, name);
    s.encounter = id;
    s.board["0:1"] = [id];
    s.phase = "encounter";
    act(s, p, { type: "resolve" });
    if (name === "Fat Sweaty Betty") assert.deepEqual(p.homies, [id]);
    else assert.equal(p.homies.length, 0);
  }
});
test("delivery rewards apply on arrival", () => {
  for (const [name, where, stat, gain] of [
    ["Steve at the Office", "Psychopathic Records", "cash", 500],
    ["Hype Engine", "Oz", "bonus", 1],
  ]) {
    const s = game(),
      p = s.players[0],
      id = own(s, p, name),
      before = p[stat],
      to = findSpace(where);
    s.phase = "move";
    s.choices = [{ ...to, toll: 0 }];
    act(s, p, { type: "move", ...to });
    assert.equal(p[stat], before + gain);
    assert.ok(![...p.homies, ...p.items].includes(id));
  }
});
test("Masked Negotiator sells Items or itself during another players turn", () => {
  const s = game(),
    [p, q] = s.players,
    id = own(s, q, "Masked Negotiator"),
    item = own(s, q, "Herb");
  q.allegiance = "Nethervoid";
  const cash = q.cash;
  use(s, q, id, { choice: item });
  use(s, q, id, { choice: id });
  assert.equal(q.cash, cash + 200);
  assert.ok(!q.homies.includes(id));
});
test("Witchs Hat lets another player replace a new draw before acquisition", () => {
  const s = game(),
    [p, q] = s.players,
    hat = own(s, q, "The Witch's Hat"),
    original = take(s, "Stefan"),
    replacement = take(s, "Spider");
  s.decks[0].push(replacement, original);
  const drawSpace = { region: 0, pos: 1 };
  Object.assign(p, drawSpace);
  s.phase = "encounter";
  act(s, p, { type: "location" });
  assert.ok(s.flow);
  respond(s, "replace");
  assert.equal(s.encounter, replacement);
  assert.ok(s.discards[0].includes(original));
  assert.ok(!q.items.includes(hat));
});
test("Voodoo for Morons redirects a freshly drawn immediate Bone before it applies", () => {
  const s = game(),
    [p, q] = s.players,
    id = own(s, p, "Voodoo for Morons");
  drawBone(s, p, "The Runs");
  assert.ok(s.flow);
  respond(s, q.id);
  assert.equal(p.skip, 0);
  assert.equal(q.skip, 1);
  assert.ok(!p.items.includes(id));
});
test("Voodoo for Morons preserves remaining duration when transferring an existing Bone", () => {
  const s = game(),
    [p, q] = s.players,
    id = own(s, p, "Voodoo for Morons"),
    b = own(s, p, "Insanity");
  s.turnsTaken[p.id] = 5;
  s.turnsTaken[q.id] = 2;
  p.conditions = { [b]: { expiresAfterTurn: 7 } };
  use(s, p, id, { target: q.id, choice: b });
  assert.equal(q.conditions[b].expiresAfterTurn, 4);
  assert.ok(!p.bones.includes(b));
  assert.ok(q.bones.includes(b));
});
test("Cotton Candy removes every Bone including the Item form", () => {
  const s = game(),
    p = s.players[0],
    id = own(s, p, "Cotton Candy");
  own(s, p, "Crabs");
  own(s, p, "Random Bone Generator");
  use(s, p, id);
  assert.equal(p.bones.length, 0);
  assert.equal(p.items.length, 0);
});
test("Twilight Scroll retrieves one discarded Item and Mirror Mirror transfers base CB", () => {
  const s = game(),
    [p, q] = s.players,
    id = own(s, p, "Twilight Scroll"),
    item = take(s, "Backpack");
  s.discards[card(item).deck].push(item);
  use(s, p, id, { choice: item });
  assert.ok(p.items.includes(item));
  assert.ok(!s.discards.flat().includes(item));
  const mirror = own(s, p, "Mirror Mirror");
  use(s, p, mirror, { target: q.id });
  assert.equal(p.bonus, 4);
  assert.equal(q.bonus, 2);
});
test("Circus Tent applies all losses on five and a win on six", () => {
  for (const roll of [5, 6]) {
    const s = game(),
      p = s.players[0],
      id = own(s, p, "Circus Tent"),
      life = p.life;
    own(s, p, "Stefan");
    use(s, p, id, {}, [roll]);
    if (roll === 5) {
      assert.equal(p.life, life - 2);
      assert.equal(p.cash, 0);
      assert.equal(p.items.length, 0);
      assert.equal(p.homies.length, 0);
    } else assert.equal(s.winner, p.id);
  }
});
test("Milenkos Hat validates its teleport target and leaves unclear arrival timing for a ruling", () => {
  const s = game(),
    [p, q] = s.players,
    id = own(s, p, "Milenko's Hat");
  use(s, p, id, {}, [5]);
  assert.equal(s.itemPrompt.kind, "teleport");
  assert.throws(() =>
    act(s, p, { type: "item-teleport", target: p.id, region: 0, pos: 1 }),
  );
  act(s, p, { type: "item-teleport", target: q.id, region: 2, pos: 2 });
  assert.deepEqual([q.region, q.pos], [2, 2]);
  assert.equal(s.phase, "ruling");
  assert.match(s.ruling.reason, /off-turn/);
});
test("Dr Dinglenuts used charges follow the Homie when stolen", () => {
  const s = game(),
    [p, q] = s.players,
    id = own(s, q, "Dr. Dinglenut"),
    gear = own(s, p, "PuBu Gear");
  q.cardUses = { [id]: 2 };
  s.phase = "encounter";
  p.landed = true;
  use(s, p, gear, { target: q.id, choice: id });
  assert.equal(p.cardUses[id], 2);
  const w = s.purchase.find((x) => cardName(x) === "Axe");
  use(s, p, id, { choice: w });
  assert.ok(!p.homies.includes(id));
});
test("a lethal point-blank blast resolves before an ending victory is awarded", () => {
  const s = game(),
    p = s.players[0],
    weapon = own(s, p, "Rocket Launcher");
  p.life = 1;
  p.region = 3;
  p.pos = 0;
  s.finalEntered = true;
  s.finalRevealed = true;
  s.ending = "ninja";
  s.phase = "combat";
  s.combat = {
    attacker: p.id,
    cards: [],
    region: 3,
    pos: 0,
    ranged: false,
    mortal: false,
    choices: {},
    ending: true,
  };
  act(s, p, { type: "combat-choice", weapon }, [10]);
  assert.ok(p.dead);
  assert.notEqual(s.winner, p.id);
  assert.equal(s.winner, s.players[1].id);
  assert.equal(s.pendingVictory, undefined);
});
test("Cryptic List teleports to the matching printed destination", () => {
  const s = game(),
    p = s.players[0],
    id = own(s, p, "The Cryptic List");
  use(s, p, id, {}, [2]);
  const dest = findSpace("Yellow Brick Alleyway");
  assert.equal(p.region, dest.region);
  assert.equal(p.pos, dest.pos);
  assert.equal(s.phase, "encounter");
});
test("Voodoo Doll respects a targets Bone immunity", () => {
  const s = game(),
    [p, q] = s.players,
    id = own(s, p, "Voodoo Doll");
  own(s, q, "Noosawaa");
  const before = s.boneDeck.length;
  use(s, p, id, { target: q.id });
  assert.equal(q.bones.length, 0);
  assert.equal(s.boneDeck.length, before);
  assert.ok(!p.items.includes(id));
});
test("Random Bone Generator modifies a protective Homie die, not the combat die", () => {
  const s = game(),
    [p, q] = s.players;
  own(s, q, "Random Bone Generator");
  own(s, q, "Evil Dead");
  const life = q.life;
  combat(s, p, q);
  assert.deepEqual(s.lastDice, [10, 1]);
  act(s, p, { type: "penalty", choice: "life" }, [8]);
  assert.equal(q.life, life - 1);
  assert.ok(s.log.some((x) => x.includes("rolled 7 for Evil Dead")));
});
