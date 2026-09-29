import { OnlineError } from "./errors.ts";
export const pagesOrigin = "https://kirkcreason-dev.github.io";
export function isGameOrigin(origin: string | null, serverOrigin: string) {
  return !origin || origin === serverOrigin || origin === pagesOrigin;
}
export function remoteSession(headers: Headers) {
  const value = headers.get("X-Game-Session");
  if (value === null) {
    if (headers.get("origin") === pagesOrigin)
      throw new OnlineError("Reload the game to reconnect your player seat.", 401);
    return null;
  }
  if (!/^[a-f0-9]{64}$/.test(value))
    throw new OnlineError("Your player session is invalid. Reload the game.", 401);
  return value;
}
export async function withGameCors(request: Request, handle: () => Promise<Response>): Promise<Response> {
  if (!new URL(request.url).pathname.startsWith("/api/rooms")) return handle();
  const origin = request.headers.get("origin");
  if (!isGameOrigin(origin, new URL(request.url).origin))
    return Response.json({error: "This request must come from the game."}, {status: 403});
  if (origin !== pagesOrigin) return handle();
  const headers = new Headers({
    "Access-Control-Allow-Origin": pagesOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Game-Session",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin",
  });
  if (request.method === "OPTIONS") {
    const method = request.headers.get("Access-Control-Request-Method");
    const requested = (request.headers.get("Access-Control-Request-Headers") ?? "").toLowerCase().split(",").map(s => s.trim()).filter(Boolean);
    if (!method || !["GET", "POST"].includes(method) || requested.some(h => !["content-type", "x-game-session"].includes(h)))
      return new Response(null, {status: 403});
    return new Response(null, {status: 204, headers});
  }
  const result = await handle();
  const response = new Response(result.body, result);
  headers.forEach((value, name) => {
    if (name === "vary") response.headers.append(name, value);
    else response.headers.set(name, value);
  });
  return response;
}
