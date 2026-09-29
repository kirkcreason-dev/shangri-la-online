// Rules execute synchronously. A suspended reaction retains only its random tape,
// submitted action, and answered prompts; the uncommitted game state is restored.
import type { Action, State } from "./types.ts";
export type Prompt = {
  player: string;
  message: string;
  choices: { id: string; label: string }[];
};
export type Flow = {
  actor: string;
  action: Action;
  tape: { sides: number; value: number }[];
  answers: string[];
  prompt: Prompt;
};
type Context = {
  tape: Flow["tape"];
  answers: string[];
  randomIndex: number;
  questionIndex: number;
};
let context: Context | null = null;
export class Pause extends Error {
  prompt: Prompt;
  constructor(prompt: Prompt) {
    super("Waiting for a card choice.");
    this.prompt = prompt;
  }
}
export function randomValue(sides: number, generate: () => number) {
  if (!context) return generate();
  const i = context.randomIndex++,
    existing = context.tape[i];
  if (existing) {
    if (existing.sides !== sides)
      throw Error("Saved roll no longer matches this action.");
    return existing.value;
  }
  const value = generate();
  context.tape.push({ sides, value });
  return value;
}
export function ask(prompt: Prompt) {
  if (!context) throw Error("Card choices need an active action.");
  const answer = context.answers[context.questionIndex++];
  if (answer === undefined) throw new Pause(prompt);
  if (!prompt.choices.some((c) => c.id === answer))
    throw Error("Saved card choice is no longer available.");
  return answer;
}
function restore(s: State, before: State) {
  const players = new Map(s.players.map((p) => [p.id, p]));
  for (const key of Object.keys(s)) delete (s as any)[key];
  Object.assign(s, before);
  s.players = before.players.map((p) => {
    const old = players.get(p.id);
    if (!old) return p;
    for (const k of Object.keys(old)) delete (old as any)[k];
    Object.assign(old, p);
    return old;
  });
}
export function transaction(
  s: State,
  actor: string,
  action: Action,
  run: () => void,
  prior?: Flow,
) {
  const before = structuredClone(s),
    tape = structuredClone(prior?.tape ?? []),
    answers = [...(prior?.answers ?? [])];
  delete s.flow;
  context = { tape, answers, randomIndex: 0, questionIndex: 0 };
  try {
    run();
  } catch (e) {
    restore(s, before);
    if (e instanceof Pause) {
      s.flow = { actor, action, tape, answers, prompt: e.prompt };
      return;
    }
    throw e;
  } finally {
    context = null;
  }
}
