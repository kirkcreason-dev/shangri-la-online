import type { Option } from "./rules/types.ts";
type GuideRoom = {
  status: string; phase: string; legacy?: boolean; endedByHost?: string; me: string | null; control: string | null; turn: number;
  players: {id: string; name: string; ready?: boolean; left?: boolean; controller?: string; bot?: boolean}[];
  pendingCard?: {player: string} | null; itemPrompt?: {player: string} | null;
  endingPending?: string | null; decision?: {actor: string} | null; overflow?: {player: string} | null; ruling?: {actor: string} | null; penalty?: {winner: string} | null;
  combat?: {attacker: string; defender?: string | null; choices: Record<string, unknown>} | null;
  options: Option[];
};
export function tableGuidance(room: GuideRoom) {
  const active = room.players[room.turn];
  const own = room.players.find(p => p.id === room.me);
  const controlled = room.players.find(p => p.id === room.control);
  const result = (title: string, detail: string, attention = false, quick?: Option) => ({title, detail, attention, quick});
  if (room.legacy) return result("Saved table", "Open a new table to use the current rules.");
  if (room.status === "finished") return result(room.endedByHost ? "Game ended by the host" : "Quest complete", "Your final board and game history are saved.");
  if (room.status === "lobby") {
    const ready = room.players.filter(p => p.ready).length;
    return result("Gather your table", `${ready}/${room.players.length} ready · ${room.players.length < 2 ? "Invite a friend or add a practice opponent." : "Everyone must be ready before the host starts."}`);
  }
  if (!own || own.left) return result("Watching the table", `${active?.name ?? "A player"} is taking their turn.`);
  const response = room.pendingCard?.player ?? room.itemPrompt?.player ?? room.endingPending;
  if (response) {
    const player = room.players.find(p => p.id === response);
    const yours = response === room.control || player?.controller === room.me;
    return result(yours ? "Your choice is needed" : `Waiting for ${player?.name ?? "a player"}`, "Resolve the card response in Controls to continue.", yours);
  }
  if (room.phase === "waiting") return result("Table paused", "A temporary absence timer is running. The game resumes automatically.");
  if (room.combat) {
    const participant = controlled && [room.combat.attacker, room.combat.defender].includes(controlled.id);
    const choosing = !!participant && !room.combat.choices[controlled.id];
    return result(choosing ? "Choose your combat equipment" : "Combat in progress", choosing ? "Pick your weapon and any optional effects in Controls." : "Waiting for combat choices to resolve.", choosing);
  }
  const resolving = room.decision?.actor ?? room.overflow?.player ?? room.penalty?.winner ?? room.ruling?.actor;
  if (resolving) {
    const player = room.players.find(p => p.id === resolving);
    const yours = resolving === room.control || player?.controller === room.me;
    const label = room.overflow ? "Choose an Item to discard" : room.penalty ? "Choose the combat reward" : room.ruling ? "Resolve the card effect" : "Your decision is needed";
    return result(yours ? label : `Waiting for ${player?.name ?? "a player"}`, "Open Controls to resolve the pending effect.", yours);
  }
  if (controlled?.id !== active?.id) return result(`Waiting for ${active?.name ?? "the active player"}`, "You can inspect the board, check your cards, or chat.");
  const prompt = room.decision || room.overflow || room.ruling;
  const quick = !prompt && ["roll", "end", "encounter"].includes(room.phase)
    ? room.options.find(o => (o.action.type === room.phase || room.phase === "encounter" && ["resolve","location"].includes(o.action.type)) && !o.action.choice) : undefined;
  const hints: Record<string, [string, string]> = {
    roll: ["Ready to roll", "Use any start-of-turn powers, then roll for movement."],
    move: ["Choose your destination", "Tap a glowing space to preview its rules and toll, then press Move to confirm."],
    encounter: ["Resolve your encounter", "Open Controls for the space, card, or opponent you landed on."],
    end: ["Wrap up your turn", "Finish any optional shopping or trades, then end your turn."],
    overflow: ["Your inventory is full", "Choose an Item to discard in Controls."],
    ruling: ["Resolve the card effect", "Apply the displayed rules, then finish the ruling in Controls."],
    penalty: ["Choose the combat reward", "Select the winner’s reward or penalty in Controls."],
    decision: ["A decision is waiting", "Choose how to resolve the effect in Controls."],
    ending: ["Face the final challenge", "Resolve the revealed ending in Controls."],
  };
  const [title, detail] = hints[room.phase] ?? ["Your move", "Choose an available action in Controls."];
  return result(controlled?.bot ? `Practice opponent · ${title}` : title, detail, true, quick);
}
