export type TableComfort = { sounds: boolean; reduceMotion: boolean; largeText: boolean };
export const DEFAULT_COMFORT: TableComfort = { sounds: false, reduceMotion: false, largeText: false };
export function parseComfort(value: string | null): TableComfort {
  try {
    const v = JSON.parse(value ?? '{}');
    return { sounds: v?.sounds === true, reduceMotion: v?.reduceMotion === true, largeText: v?.largeText === true };
  } catch { return { ...DEFAULT_COMFORT }; }
}
export function attentionCue(previous: { code?: string; attention: boolean }, next: { code?: string; attention: boolean }) {
  return !!next.code && previous.code === next.code && !previous.attention && next.attention;
}
export function prefersQuietMotion() {
  return document.querySelector('main.reduce-motion') !== null || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
