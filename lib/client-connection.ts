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
export function gameFetch(path: string, options: RequestInit = {}) {
  if (!path.startsWith("/api/rooms")) throw new Error("Unknown game endpoint.");
  if (!apiOrigin) return fetch(path, options);
  const headers = new Headers(options.headers);
  headers.set("X-Game-Session", playerToken());
  return fetch(apiOrigin + path, { ...options, headers, credentials: "omit" });
}
export function gameAsset(file: string) {
  return gameBasePath + file.replace(/^\//, "");
}
export function gameInvite(code: string) {
  const url = new URL(gameBasePath, window.location.origin);
  url.searchParams.set("room", code);
  return url.toString();
}
