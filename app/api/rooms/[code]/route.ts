import { CHARACTERS, newPlayer, publicState, addLog } from "@/lib/game";
import {
  session,
  readRoom,
  saveRoom,
  body,
  playerInput,
  result,
  fail,
} from "@/lib/store";
type Context = { params: Promise<{ code: string }> };
export async function GET(_req: Request, c: Context) {
  try {
    const { code } = await c.params;
    const s = await readRoom(code.toUpperCase());
    if (!s)
      return result(
        { error: "That room was not found. Check the invite code." },
        404,
      );
    const sid = await session();
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
    if (s.rulesVersion !== 2)
      throw new Error("Create a new table to use the corrected rules.");
    if (s.status !== "lobby")
      throw new Error(
        "This game has already started. You can watch it, but new seats are closed.",
      );
    if (s.players.length >= 6) throw new Error("This table is full.");
    const character =
      CHARACTERS.includes(b.character) &&
      !s.players.some((p) => p.character === b.character)
        ? b.character
        : CHARACTERS.find((x) => !s.players.some((p) => p.character === x))!;
    const rev = s.rev;
    s.players.push(newPlayer(sid, name, character, s.players.length));
    addLog(s, `${name} joined the table.`);
    await saveRoom(s, rev);
    return result(publicState(s, sid));
  } catch (e) {
    return fail(e);
  }
}
