import board from './board.json' with { type: 'json' };
import rules from './rules/spaces.json' with { type: 'json' };

export type BoardAddress = { region: number; pos: number };
export type BoardDestination = BoardAddress & { toll?: number; itemToll?: boolean };
export const REGION_INKS = ['#f1857d', '#b9a0f2', '#efd18b'];
export const BOARD_SPACES = board.spaces.flatMap((spaces, region) => spaces.map(s => ({
  ...s, region, pos: s.index, rules: rules.find(r => r.region === region && r.pos === s.index)?.rules ?? '',
})));
export function sameSpace(a: BoardAddress | null | undefined, b: BoardAddress | null | undefined) {
  return !!a && !!b && a.region === b.region && a.pos === b.pos;
}
export function boardPosition(region: number, pos: number) {
  const s = board.spaces[region]?.[pos];
  return s ? { x: s.column * 100 + 50, y: s.row * 100 + 50 } : { x: 400, y: 400 };
}
export function spaceInfo(at: BoardAddress) {
  if (at.region === 3 && at.pos === 0) return { ...at, name: 'Shangri-La', rules: 'Cross the Bridge with at least 15 base Combat Bonus to enter Shangri-La. The ending determines how the quest is won.' };
  return BOARD_SPACES.find(s => sameSpace(s, at));
}
export function searchSpaces(query: string) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return BOARD_SPACES.filter(s => words.every(w => `${s.name} ${['Detroit', 'Nethervoid', 'Dark Carnival'][s.region]}`.toLowerCase().includes(w)));
}
export function labelLines(name: string): string[] {
  const lines: string[] = [];
  for (const word of name.split(' ')) {
    const last = lines.length - 1;
    if (last >= 0 && (lines[last] + ' ' + word).length <= 14) lines[last] += ' ' + word;
    else lines.push(word);
  }
  return lines;
}
export function destinationCost(d: BoardDestination) {
  return [d.toll ? `$${d.toll} toll` : '', d.itemToll ? 'Discard 1 Item at the Portal' : ''].filter(Boolean).join(' · ') || 'No crossing toll';
}
// A preview is tied to the exact turn and destination set, not just a tile address.
export function destinationContext(turn: string, choices: BoardDestination[]) {
  return `${turn}|${choices.map(c => `${c.region}:${c.pos}:${c.toll ?? 0}:${!!c.itemToll}`).sort().join('|')}`;
}
export function confirmedDestination(selection: { at: BoardAddress; context: string } | null, context: string, choices: BoardDestination[]) {
  return selection?.context === context ? choices.find(c => sameSpace(c, selection.at)) : undefined;
}
