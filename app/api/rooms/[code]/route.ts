import { joinRoom, publicState, tick } from "@/lib/game";
import {
  session,
  readRoom,
  saveRoom,
  body,
  playerInput,
  result,
  fail,
  ConflictError,
} from "@/lib/store";
type Context = { params: Promise<{ code: string }> };
export async function GET(_req: Request, c: Context) {
  try {
    const { code } = await c.params;
    let s = await readRoom(code.toUpperCase());
    if (!s)
      return result(
        { error: "That room was not found. Check the invite code." },
        404,
      );
    const sid = await session();
    const rev = s.rev;
    if (tick(s))
      try {
        await saveRoom(s, rev);
      } catch (e) {
        if (!(e instanceof ConflictError)) throw e;
        s = (await readRoom(code.toUpperCase()))!;
      }
    return result(publicState(s, sid));
  } catch (e) {
    return fail(e);
  }
}
export async function POST(req: Request, c: Context) {
  try {
    const b = await body(req),
      name = playerInput(b),
      sid = await session(),
      { code } = await c.params;
    const s = await readRoom(code.toUpperCase());
    if (!s) return result({ error: "That room was not found." }, 404);
    if (s.players.some((p) => p.session === sid))
      return result(publicState(s, sid));
    const rev = s.rev;
    joinRoom(s, sid, name, b.character);
    await saveRoom(s, rev);
    return result(publicState(s, sid));
  } catch (e) {
    return fail(e);
  }
}
