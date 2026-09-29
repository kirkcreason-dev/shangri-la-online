export type RecentTable = { code: string; character?: string; playerName?: string; status?: string; round?: number; players?: number; lastSeen?: number };
export function roomCodeFromInput(input: string): string | null {
  let value = input.trim();
  if (/^https?:\/\//i.test(value)) {
    try { value = new URL(value).searchParams.get("room") ?? ""; } catch { return null; }
  }
  value = value.replace(/[\s-]/g, "").toUpperCase();
  return /^[A-Z2-9]{6}$/.test(value) ? value : null;
}
export function parseRecentTables(raw: string | null): RecentTable[] {
  try {
    const values = JSON.parse(raw ?? "[]");
    if (!Array.isArray(values)) return [];
    const result: RecentTable[] = [];
    for (const value of values) {
      const item = typeof value === "string" ? {code: value} : value;
      if (!item || typeof item.code !== "string") continue;
      const code = roomCodeFromInput(item.code);
      if (!code || result.some(r => r.code === code)) continue;
      result.push({code,
        ...(typeof item.character === "string" ? {character: item.character.slice(0, 60)} : {}),
        ...(typeof item.playerName === "string" ? {playerName: item.playerName.slice(0, 24)} : {}),
        ...(["lobby", "playing", "finished"].includes(item.status) ? {status: item.status} : {}),
        ...(Number.isInteger(item.round) && item.round > 0 ? {round: item.round} : {}),
        ...(Number.isInteger(item.players) && item.players >= 1 && item.players <= 6 ? {players: item.players} : {}),
        ...(Number.isFinite(item.lastSeen) && item.lastSeen > 0 ? {lastSeen: item.lastSeen} : {}),
      });
      if (result.length === 5) break;
    }
    return result;
  } catch { return []; }
}
export function rememberTable(tables: RecentTable[], next: RecentTable): RecentTable[] {
  return [next, ...tables.filter(t => t.code !== next.code)].slice(0, 5);
}
