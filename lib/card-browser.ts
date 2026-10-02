import type { Card } from './rules/types.ts';
export function filterCards(cards: Card[], query: string, kind = 'all', deck = 'all') {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return cards.filter(c => c.deck !== 'ending' &&
    (kind === 'all' || (kind === 'weapon' ? c.weapon : c.kind === kind)) &&
    (deck === 'all' || String(c.deck) === deck) &&
    words.every(w => `${c.name} ${c.rules} ${c.kind}`.toLowerCase().includes(w)));
}
