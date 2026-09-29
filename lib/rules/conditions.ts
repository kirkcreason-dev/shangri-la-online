import { card, cardName, COUNTS } from "./catalog.ts";
import type { Player, State } from "./types.ts";
export const boneId = (p: Player, name: string) =>
  [...p.bones, ...p.items].find((id) => cardName(id) === name);
export const hasBone = (p: Player, name: string) => !!boneId(p, name);
export const absent = (p: Player, now = Date.now()) =>
  !!p.absentUntil && p.absentUntil > now;
export function capacity(p: Player) {
  if (
    p.conditions &&
    Object.values(p.conditions).some((c) => c.branch === "arm")
  )
    return 3;
  return p.items.some((id) => cardName(id) === "Backpack") ? 9 : 6;
}
export function protectedItem(p: Player, id: string) {
  return id === "ending-wand@0" || cardName(id) === "Random Bone Generator";
}
export function movementPenalty(p: Player) {
  return (
    (hasBone(p, "Crabs") ? 2 : 0) +
    (Object.values(p.conditions ?? {}).some((c) => c.branch === "leg")
      ? 2
      : 0) +
    (hasBone(p, "Random Bone Generator") ? 1 : 0)
  );
}
export function controllerFor(s: State, p: Player) {
  if (hasBone(p, "Skitsofrantic")) {
    const cond = Object.entries(p.conditions ?? {}).find(
      ([id]) => cardName(id) === "Skitsofrantic",
    )?.[1];
    if (cond?.controller && s.players.some((q) => q.id === cond.controller))
      return cond.controller;
  }
  return p.id;
}
export function canControl(s: State, actorId: string, p: Player) {
  const owner = controllerFor(s, p);
  const controller = s.players.find((q) => q.id === owner);
  return actorId === owner || (actorId === s.host && controller?.bot === true);
}
export function conditionSummary(s: State, p: Player) {
  return [...p.bones, ...p.items.filter((id) => card(id).deck === "bone")].map(
    (id) => {
      const c = p.conditions?.[id];
      return {
        id,
        name: cardName(id),
        rules: card(id).rules,
        turns:
          c?.expiresAfterTurn === undefined
            ? null
            : Math.max(0, c.expiresAfterTurn - (s.turnsTaken[p.id] ?? 0)),
        branch: c?.branch ?? null,
        controller: c?.controller ?? null,
      };
    },
  );
}
export function distance(a: Player, b: Player) {
  if (a.region !== b.region) return Infinity;
  if (a.region === 3) return 0;
  const n = COUNTS[a.region],
    d = Math.abs(a.pos - b.pos);
  return Math.min(d, n - d);
}
