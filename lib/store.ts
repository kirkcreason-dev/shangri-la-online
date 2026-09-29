import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import type { State } from "./game";
import { FirestoreRooms } from "./online/firestore";
import { ConflictError, OnlineError } from "./online/errors";
import { appendChat, chatInput, type ChatHistory } from "./online/chat";
export { ConflictError, OnlineError };
type Source = { firebase?: FirestoreRooms; token?: string };
const sources = new WeakMap<State, Source>();
function firebase() {
  if (!env.FIREBASE_PROJECT_ID) return null;
  if (env.FIRESTORE_EMULATOR_HOST && process.env.NODE_ENV === "production")
    throw new OnlineError("The online database configuration is invalid.");
  return new FirestoreRooms({
    projectId: env.FIREBASE_PROJECT_ID,
    serviceAccount: env.FIREBASE_SERVICE_ACCOUNT,
    emulatorHost: env.FIRESTORE_EMULATOR_HOST,
  });
}
export function database() {
  if (!env.DB)
    throw new OnlineError(
      "Saved games are temporarily unavailable. Please try again.",
    );
  return env.DB;
}
export async function session() {
  const c = await cookies();
  let token = c.get("qsl_session")?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (x) =>
      x.toString(16).padStart(2, "0"),
    ).join("");
    c.set("qsl_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
}
export async function readRoom(code: string) {
  if (!/^[A-Z2-9]{6}$/.test(code)) return null;
  const fb = firebase();
  if (fb) {
    const found = await fb.read(code);
    if (found) {
      sources.set(found.state, { firebase: fb, token: found.token });
      return found.state;
    }
  }
  if (!env.DB) return null;
  const row = await database()
    .prepare("SELECT state,revision FROM rooms WHERE code = ?")
    .bind(code)
    .first<{ state: string; revision: number }>();
  if (!row) return null;
  const s = JSON.parse(row.state) as State;
  s.rev = row.revision;
  sources.set(s, {});
  return s;
}
export async function createRoom(s: State, owner: string) {
  const fb = firebase();
  if (fb) {
    if (
      env.DB &&
      (await database()
        .prepare("SELECT code FROM rooms WHERE code = ?")
        .bind(s.code)
        .first())
    )
      return false;
    return fb.create(s, owner);
  }
  const db = database(),
    count = await db
      .prepare(
        "SELECT COUNT(*) AS n FROM rooms WHERE owner = ? AND created_at > ?",
      )
      .bind(owner, Date.now() - 3600000)
      .first<{ n: number }>();
  if ((count?.n ?? 0) >= 10)
    throw new OnlineError(
      "You have opened several tables. Reuse an existing room or try again in an hour.",
      429,
    );
  const r = await db
    .prepare(
      "INSERT OR IGNORE INTO rooms (code,state,revision,owner,created_at,updated_at) VALUES (?,?,0,?,?,?)",
    )
    .bind(s.code, JSON.stringify(s), owner, Date.now(), Date.now())
    .run();
  return r.meta.changes === 1;
}
export async function saveRoom(s: State, rev: number) {
  const source = sources.get(s);
  s.rev = rev + 1;
  if (source?.firebase) {
    source.token = await source.firebase.save(s, source.token!);
    return;
  }
  const r = await database()
    .prepare(
      "UPDATE rooms SET state = ?, revision = ?, updated_at = ? WHERE code = ? AND revision = ?",
    )
    .bind(JSON.stringify(s), s.rev, Date.now(), s.code, rev)
    .run();
  if (r.meta.changes !== 1)
    throw new ConflictError(
      "The table changed. Your game has refreshed; try again.",
    );
}
export function storageKind(s: State) {
  return sources.get(s)?.firebase ? "firebase" : "saved";
}
async function chatRecord(s: State) {
  const fb = sources.get(s)?.firebase;
  if (fb) return fb.readChat(s.code);
  const row = await database()
    .prepare("SELECT history, revision FROM room_chat WHERE code = ?")
    .bind(s.code)
    .first<{ history: string; revision: number }>();
  return {
    history: row
      ? (JSON.parse(row.history) as ChatHistory)
      : { messages: [], lastSent: {} },
    token: row ? String(row.revision) : null,
  };
}
export async function readChat(s: State) {
  return (await chatRecord(s)).history.messages;
}
export async function sendChat(
  s: State,
  sid: string,
  value: Record<string, unknown>,
) {
  const sender = s.players.find((p) => p.session === sid);
  if (!sender) throw new OnlineError("Join this table to use room chat.", 403);
  const input = chatInput(value),
    fb = sources.get(s)?.firebase;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { history, token } = await chatRecord(s);
    if (!appendChat(history, input, sender)) return history.messages;
    try {
      if (fb) await fb.saveChat(s.code, history, token);
      else {
        const r =
          token === null
            ? await database()
                .prepare(
                  "INSERT OR IGNORE INTO room_chat (code,history,revision) VALUES (?,?,0)",
                )
                .bind(s.code, JSON.stringify(history))
                .run()
            : await database()
                .prepare(
                  "UPDATE room_chat SET history = ?, revision = revision + 1 WHERE code = ? AND revision = ?",
                )
                .bind(JSON.stringify(history), s.code, Number(token))
                .run();
        if (r.meta.changes !== 1)
          throw new ConflictError("Chat changed while sending.");
      }
      return history.messages;
    } catch (e) {
      if (!(e instanceof ConflictError) || attempt === 2) throw e;
    }
  }
  throw new OnlineError("Your message was not sent. Please retry.");
}
export function result(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export function fail(e: unknown) {
  const known = e instanceof Error ? e.message : "Something went wrong.";
  console.error("Room request:", known);
  return result(
    { error: known },
    e instanceof ConflictError
      ? 409
      : e instanceof OnlineError
        ? e.status
        : 400,
  );
}
export async function body(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin)
    throw new Error("This request must come from the game.");
  const raw = await req.text();
  if (raw.length > 8192) throw new Error("Request too large.");
  return JSON.parse(raw);
}
export function playerInput(b: Record<string, unknown>) {
  if (typeof b.name !== "string" || !b.name.trim() || b.name.trim().length > 24)
    throw new Error("Enter a name from 1 to 24 characters.");
  return b.name.trim();
}
