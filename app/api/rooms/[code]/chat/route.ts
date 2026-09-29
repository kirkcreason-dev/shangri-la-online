import {
  session,
  readRoom,
  readChat,
  sendChat,
  body,
  result,
  fail,
  OnlineError,
  storageKind,
} from "@/lib/store";
type Context = { params: Promise<{ code: string }> };
async function member(c: Context) {
  const { code } = await c.params,
    sid = await session(),
    room = await readRoom(code.toUpperCase());
  if (!room) throw new OnlineError("That room was not found.", 404);
  if (!room.players.some((p) => p.session === sid))
    throw new OnlineError("Join this table to use room chat.", 403);
  return { room, sid };
}
export async function GET(_req: Request, c: Context) {
  try {
    const { room } = await member(c);
    return result({
      messages: await readChat(room),
      connection: storageKind(room),
    });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(req: Request, c: Context) {
  try {
    const input = await body(req),
      { room, sid } = await member(c);
    return result({
      messages: await sendChat(room, sid, input),
      connection: storageKind(room),
    });
  } catch (e) {
    return fail(e);
  }
}
