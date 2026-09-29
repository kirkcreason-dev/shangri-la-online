import { makeRoom, dice, CHARACTERS, publicState, applyAction, runBots } from "@/lib/game";
import {
  createRoom,
  session,
  body,
  playerInput,
  result,
  fail,
} from "@/lib/store";
export async function POST(req: Request) {
  try {
    const b = await body(req);
    const name = playerInput(b);
    const character = CHARACTERS.includes(b.character)
      ? b.character
      : CHARACTERS[0];
    const sid = await session();
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    for (let i = 0; i < 5; i++) {
      const code = Array.from(
        { length: 6 },
        () => alphabet[dice(alphabet.length) - 1],
      ).join("");
      const s = makeRoom(code, sid, name, character);
      if(b.practice===true){applyAction(s,s.host,{type:'start-practice'});runBots(s);}
      if (await createRoom(s, sid)) return result(publicState(s, sid), 201);
    }
    throw new Error("Could not open a table. Please try again.");
  } catch (e) {
    return fail(e);
  }
}
