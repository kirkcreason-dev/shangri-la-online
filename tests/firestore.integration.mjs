// Run with the local Firestore emulator on 8188; never targets production.
import assert from "node:assert/strict";
import { FirestoreRooms } from "../lib/online/firestore.ts";
import { makeRoom } from "../lib/game.ts";
import { appendChat } from "../lib/online/chat.ts";
const fb = new FirestoreRooms({
  projectId: "demo-shangri-la",
  emulatorHost: "127.0.0.1:8188",
});
const code = crypto.randomUUID().slice(0, 8),
  owner = crypto.randomUUID();
const s = makeRoom(code, owner, "Test player", "Violent J");
assert.equal(await fb.create(s, owner), true);
assert.equal(await fb.create(s, owner), false);
const a = await fb.read(code),
  b = await fb.read(code);
a.state.rev = 1;
b.state.rev = 1;
const saves = await Promise.allSettled([
  fb.save(a.state, a.token),
  fb.save(b.state, b.token),
]);
assert.equal(saves.filter((r) => r.status === "fulfilled").length, 1);
assert.equal(
  saves.filter(
    (r) =>
      r.status === "rejected" && r.reason.constructor.name === "ConflictError",
  ).length,
  1,
);
const first = await fb.readChat(code),
  second = await fb.readChat(code);
appendChat(
  first.history,
  { id: "one", text: "hello" },
  { id: "a", name: "Alice" },
);
appendChat(
  second.history,
  { id: "two", text: "hello" },
  { id: "b", name: "Bob" },
);
const chats = await Promise.allSettled([
  fb.saveChat(code, first.history, first.token),
  fb.saveChat(code, second.history, second.token),
]);
assert.equal(chats.filter((r) => r.status === "fulfilled").length, 1);
assert.equal(chats.filter((r) => r.status === "rejected").length, 1);
const history = await fb.readChat(code),
  before = await fb.read(code);
appendChat(
  history.history,
  { id: "three", text: "reconnected" },
  { id: "c", name: "Carol" },
);
await fb.saveChat(code, history.history, history.token);
assert.equal((await fb.readChat(code)).history.messages.length, 2);
assert.equal((await fb.read(code)).token, before.token);
assert.equal((await fb.read(code)).state.rev, 1);
for (let i = 0; i < 9; i++)
  assert.equal(
    await fb.create(
      makeRoom(code + i, owner, "Limit test", "Violent J"),
      owner,
    ),
    true,
  );
await assert.rejects(
  () =>
    fb.create(
      makeRoom(code + "limit", owner, "Limit test", "Violent J"),
      owner,
    ),
  (e) => e.status === 429,
);
console.log(
  "Firestore passed: atomic create, revision conflicts, independent chat, persistence, creation limit.",
);
