declare const __GAME_API_URL__: string | undefined;
declare const __GAME_BASE_PATH__: string | undefined;
const apiOrigin = typeof __GAME_API_URL__ === "string" ? __GAME_API_URL__ : "";
export const gameBasePath = typeof __GAME_BASE_PATH__ === "string" ? __GAME_BASE_PATH__ : "/";
let savedToken: string | undefined;
function playerToken() {
  if (savedToken) return savedToken;
  const key = "shangri-la-online:seat:v1";
  let token: string | null = null;
  try { token = localStorage.getItem(key); } catch { /* Keep a session in memory if storage is disabled. */ }
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
    try { localStorage.setItem(key, token); } catch { /* The current tab can still play. */ }
  }
  savedToken = token;
  return token;
}
export async function gameFetch(path: string, options: RequestInit = {}) {
  if (!path.startsWith("/api/rooms")) throw new Error("Unknown game endpoint.");
  if (typeof navigator !== "undefined" && navigator.onLine === false)
    throw new Error("You’re offline. Your table is saved; reconnect to continue.");
  const controller = new AbortController();
  const cancel = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) cancel();
  else options.signal?.addEventListener("abort", cancel, {once: true});
  const timeout = setTimeout(() => controller.abort(new Error("The connection is taking too long. Reconnect and check the table before trying again.")), 12000);
  const headers = new Headers(options.headers);
  if (apiOrigin) headers.set("X-Game-Session", playerToken());
  try {
    return await fetch(apiOrigin + path, {...options, headers, signal: controller.signal, ...(apiOrigin ? {credentials: "omit" as const} : {})});
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", cancel);
  }
}

export function gameAsset(file: string) {
  return gameBasePath + file.replace(/^\//, "");
}
export function gameInvite(code: string) {
  const url = new URL(gameBasePath, window.location.origin);
  url.searchParams.set("room", code);
  return url.toString();
}
