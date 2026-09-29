export * from "./rules/engine.ts";
import { publicState as correctedPublicState } from "./rules/engine.ts";
import type { State } from "./rules/types.ts";
export function publicState(s: State, session: string) {
  if (s.rulesVersion === 3) return correctedPublicState(s, session);
  const old = s as any;
  return {
    rulesVersion: old.rulesVersion ?? 1,
    legacy: true,
    code: old.code,
    status: old.status,
    rev: old.rev,
    host: old.host,
    turn: old.turn,
    round: old.round,
    log: old.log,
    players: old.players.map(({ session, ...p }: any) => ({
      ...p,
      items: [],
      homies: [],
      bones: [],
      notes: "",
    })),
    me: old.players.find((p: any) => p.session === session)?.id ?? null,
    options: [],
    choices: [],
    winners: old.winner ? [old.winner] : [],
  };
}
