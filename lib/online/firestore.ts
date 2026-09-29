import type { State } from "../rules/types.ts";
import type { ChatHistory } from "./chat.ts";
import { ConflictError, OnlineError } from "./errors.ts";
export type FirebaseConfig = {
  projectId: string;
  serviceAccount?: string;
  emulatorHost?: string;
};
type Document = {
  name: string;
  updateTime: string;
  fields: Record<string, { stringValue?: string; integerValue?: string }>;
};
const encoder = new TextEncoder();
function encoded(value: string | Uint8Array) {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
let cached: { identity: string; token: string; expires: number } | undefined;
async function accessToken(config: FirebaseConfig) {
  if (config.emulatorHost) return "owner";
  let account;
  try {
    account = JSON.parse(config.serviceAccount ?? "");
  } catch {
    throw new OnlineError("The online game connection is not configured yet.");
  }
  if (
    account.project_id !== config.projectId ||
    typeof account.client_email !== "string" ||
    !account.client_email.endsWith(".iam.gserviceaccount.com") ||
    typeof account.private_key !== "string"
  )
    throw new OnlineError(
      "The online game connection is not configured correctly.",
    );
  const identity = encoded(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        encoder.encode(account.private_key + account.client_email),
      ),
    ),
  );
  if (cached?.identity === identity && cached.expires > Date.now() + 60000)
    return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const unsigned =
    encoded(JSON.stringify({ alg: "RS256", typ: "JWT" })) +
    "." +
    encoded(
      JSON.stringify({
        iss: account.client_email,
        scope: "https://www.googleapis.com/auth/datastore",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      }),
    );
  let key: CryptoKey;
  try {
    const pem = account.private_key
      .replace(/-----[^-]+-----/g, "")
      .replace(/\s/g, "");
    const bytes = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
    key = await crypto.subtle.importKey(
      "pkcs8",
      bytes,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"],
    );
  } catch {
    throw new OnlineError(
      "The online game connection needs a valid server credential.",
    );
  }
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      encoder.encode(unsigned),
    ),
  );
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: unsigned + "." + encoded(signature),
    }),
    signal: AbortSignal.timeout(15000),
  });
  const data = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!response.ok || !data.access_token)
    throw new OnlineError("The online game could not sign in to its database.");
  cached = {
    identity,
    token: data.access_token,
    expires: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return cached.token;
}
export class FirestoreRooms {
  config: FirebaseConfig;
  root: string;
  base: string;
  constructor(config: FirebaseConfig) {
    if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(config.projectId))
      throw new OnlineError("Choose a valid Firebase project for online play.");
    if (
      config.emulatorHost &&
      !/^(127\.0\.0\.1|localhost):\d{2,5}$/.test(config.emulatorHost)
    )
      throw new OnlineError("The local database address is invalid.");
    this.config = config;
    this.root = `projects/${config.projectId}/databases/(default)/documents`;
    this.base = config.emulatorHost
      ? `http://${config.emulatorHost}/v1/`
      : "https://firestore.googleapis.com/v1/";
  }
  async request(path: string, method = "GET", body?: unknown) {
    let response: Response;
    try {
      response = await fetch(this.base + path, {
        method,
        headers: {
          Authorization: "Bearer " + (await accessToken(this.config)),
          "Content-Type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(15000),
      });
    } catch (e) {
      if (e instanceof OnlineError) throw e;
      throw new OnlineError(
        "Online rooms are temporarily unreachable. Your unsent changes are safe to retry.",
      );
    }
    if (response.status === 404) return null;
    if (response.status === 409 || response.status === 412)
      throw new ConflictError("The table changed. Refresh and try again.");
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as {
        error?: { status?: string };
      };
      if (
        ["ALREADY_EXISTS", "FAILED_PRECONDITION", "ABORTED"].includes(
          data.error?.status ?? "",
        )
      )
        throw new ConflictError("The table changed. Refresh and try again.");
      console.error(
        "Firebase request failed:",
        response.status,
        data.error?.status ?? "unknown",
      );
      throw new OnlineError(
        "Online rooms could not be saved or loaded. Please try again.",
      );
    }
    return response.json();
  }
  async document(path: string): Promise<Document | null> {
    return (await this.request(this.root + "/" + path)) as Document | null;
  }
  async read(code: string) {
    const d = await this.document("shangriLaRooms/" + code);
    if (!d) return null;
    const state = JSON.parse(d.fields.state.stringValue!) as State;
    state.rev = Number(d.fields.revision.integerValue);
    return { state, token: d.updateTime };
  }
  async create(state: State, owner: string) {
    const budgetPath = "shangriLaLimits/" + owner,
      now = Date.now();
    const budget = await this.document(budgetPath),
      previous = budget ? JSON.parse(budget.fields.value.stringValue!) : null;
    const value =
      previous && previous.since > now - 3600000
        ? { since: previous.since, count: previous.count + 1 }
        : { since: now, count: 1 };
    if (value.count > 10)
      throw new OnlineError(
        "You have opened several tables. Reuse a room or try again in an hour.",
        429,
      );
    try {
      const r = await this.request(this.root + ":commit", "POST", {
        writes: [
          {
            update: {
              name: this.root + "/shangriLaRooms/" + state.code,
              fields: {
                state: { stringValue: JSON.stringify(state) },
                revision: { integerValue: "0" },
                owner: { stringValue: owner },
                createdAt: { integerValue: String(now) },
              },
            },
            currentDocument: { exists: false },
          },
          {
            update: {
              name: this.root + "/" + budgetPath,
              fields: { value: { stringValue: JSON.stringify(value) } },
            },
            currentDocument: budget
              ? { updateTime: budget.updateTime }
              : { exists: false },
          },
        ],
      });
      if (!r)
        throw new OnlineError(
          "Create the Firestore database before opening online rooms.",
        );
      return true;
    } catch (e) {
      if (e instanceof ConflictError) return false;
      throw e;
    }
  }
  async save(state: State, token: string) {
    const result = (await this.request(this.root + ":commit", "POST", {
      writes: [
        {
          update: {
            name: this.root + "/shangriLaRooms/" + state.code,
            fields: {
              state: { stringValue: JSON.stringify(state) },
              revision: { integerValue: String(state.rev) },
            },
          },
          updateMask: { fieldPaths: ["state", "revision"] },
          currentDocument: { updateTime: token },
        },
      ],
    })) as { writeResults: { updateTime: string }[] } | null;
    if (!result) throw new ConflictError("This room is no longer available.");
    return result.writeResults[0].updateTime;
  }
  async readChat(code: string) {
    const d = await this.document(`shangriLaRooms/${code}/chat/history`);
    return {
      history: d
        ? (JSON.parse(d.fields.value.stringValue!) as ChatHistory)
        : { messages: [], lastSent: {} },
      token: d?.updateTime ?? null,
    };
  }
  async saveChat(code: string, history: ChatHistory, token: string | null) {
    const result = await this.request(this.root + ":commit", "POST", {
      writes: [
        {
          update: {
            name: this.root + `/shangriLaRooms/${code}/chat/history`,
            fields: {
              value: { stringValue: JSON.stringify(history) },
            },
          },
          currentDocument: token ? { updateTime: token } : { exists: false },
        },
      ],
    });
    if (!result) throw new OnlineError("Room chat is temporarily unavailable.");
  }
}
