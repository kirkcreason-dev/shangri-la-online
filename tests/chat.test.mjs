import test from "node:test";
import assert from "node:assert/strict";
import { appendChat, chatInput } from "../lib/online/chat.ts";
const sender = { id: "seat1", name: "Kirk" };
const blank = () => ({ messages: [], lastSent: {} });
test("chat validates and normalizes text without trusting supplied author", () => {
  assert.deepEqual(
    chatInput({
      id: "abcdefghijklmnop",
      text: "  hello\r\nworld  ",
      senderId: "fake",
    }),
    { id: "abcdefghijklmnop", text: "hello\nworld" },
  );
  for (const value of [
    { id: "short", text: "hi" },
    { id: "abcdefghijklmnop", text: " " },
    { id: "abcdefghijklmnop", text: "x".repeat(501) },
  ])
    assert.throws(() => chatInput(value));
  const h = blank();
  appendChat(
    h,
    { id: "abcdefghijklmnop", text: "<script>hello</script>" },
    sender,
    10000,
  );
  assert.equal(h.messages[0].senderName, "Kirk");
  assert.equal(h.messages[0].text, "<script>hello</script>");
});
test("retries do not duplicate a message or consume another cooldown", () => {
  const h = blank(),
    input = { id: "abcdefghijklmnop", text: "hi" };
  assert.equal(appendChat(h, input, sender, 10000), true);
  assert.equal(appendChat(h, input, sender, 10001), false);
  assert.equal(h.messages.length, 1);
  assert.throws(() =>
    appendChat(h, { ...input, text: "different" }, sender, 10001),
  );
  assert.throws(() =>
    appendChat(h, input, { id: "seat2", name: "Other" }, 10001),
  );
});
test("cooldown is per player and history stays bounded", () => {
  const h = blank();
  appendChat(h, { id: "one", text: "hi" }, sender, 10000);
  assert.throws(
    () => appendChat(h, { id: "two", text: "hi" }, sender, 11999),
    (e) => e.status === 429,
  );
  appendChat(
    h,
    { id: "three", text: "hi" },
    { id: "seat2", name: "Other" },
    10001,
  );
  for (let i = 0; i < 102; i++)
    appendChat(h, { id: String(i), text: "hi" }, sender, 12000 + i * 2000);
  assert.equal(h.messages.length, 100);
  assert.equal(h.messages[0].id, "2");
});
