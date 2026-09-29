import { ConflictError, OnlineError } from "./errors.ts";
export type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  sentAt: number;
};
export type ChatHistory = {
  messages: ChatMessage[];
  lastSent: Record<string, number>;
};
export function chatInput(value: Record<string, unknown>) {
  if (typeof value.id !== "string" || !/^[a-zA-Z0-9_-]{16,64}$/.test(value.id))
    throw new OnlineError("Please retry this message.", 400);
  if (typeof value.text !== "string")
    throw new OnlineError("Write a message first.", 400);
  const text = value.text.replace(/\r\n?/g, "\n").trim();
  if (!text || text.length > 500)
    throw new OnlineError("Messages must contain 1–500 characters.", 400);
  return { id: value.id, text };
}
export function appendChat(
  history: ChatHistory,
  input: { id: string; text: string },
  sender: { id: string; name: string },
  now = Date.now(),
) {
  const duplicate = history.messages.find((m) => m.id === input.id);
  if (duplicate) {
    if (duplicate.senderId !== sender.id || duplicate.text !== input.text)
      throw new ConflictError("That message identifier is already in use.");
    return false;
  }
  if (now - (history.lastSent[sender.id] ?? 0) < 2000)
    throw new OnlineError(
      "Give the table a moment before sending another message.",
      429,
    );
  history.messages.push({
    ...input,
    senderId: sender.id,
    senderName: sender.name,
    sentAt: now,
  });
  history.messages = history.messages.slice(-100);
  history.lastSent[sender.id] = now;
  return true;
}
