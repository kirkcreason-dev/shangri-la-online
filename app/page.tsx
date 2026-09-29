"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Board, { spaceName } from "@/components/game/Board";
import {
  CHARACTERS,
  ROSTER,
  REGIONS,
  COUNTS,
  CARDS,
  card,
  cardName,
  character as characterRecord,
} from "@/lib/rules/catalog";
import type { Action, Player, State, Option } from "@/lib/rules/types";
type PublicRoom = Omit<
  State,
  | "players"
  | "ending"
  | "decks"
  | "discards"
  | "endingPool"
  | "boneDeck"
  | "boneDiscard"
> & {
  players: Omit<Player, "session">[];
  me: string | null;
  control: string | null;
  legacy: boolean;
  ending: { name: string; rules: string; id: string } | null;
  options: Option[];
  deckCounts: number[];
  discardCards: string[];
  yourPowers: { id: string; summary: string; optional: boolean }[];
  space: { name: string; rules: string } | null;
};
async function api(path: string, data?: unknown) {
  const r = await fetch(path, {
    method: data ? "POST" : "GET",
    headers: data ? { "Content-Type": "application/json" } : undefined,
    body: data ? JSON.stringify(data) : undefined,
    cache: "no-store",
  });
  const value = (await r.json()) as PublicRoom & { error?: string };
  if (!r.ok) throw new Error(value.error ?? "The table could not be reached.");
  return value as PublicRoom;
}
function CardView({ id, onUse }: { id: string; onUse?: (id: string) => void }) {
  const c = card(id);
  return (
    <article className="game-card">
      <div className="row">
        <span className="eyebrow">
          {c.weapon ? "Weapon" : c.kind}
          {c.allegiance ? ` · ${c.allegiance}` : ""}
        </span>
        {c.strength !== undefined && (
          <span className="pill">
            Strength {c.strength} · +{c.reward} CB
          </span>
        )}
      </div>
      <h3>{c.name}</h3>
      <p>{c.rules}</p>
      {!c.automatic && (
        <span className="manual-label">
          Apply special effects with table controls
        </span>
      )}
      {!c.verified && (
        <p className="small">Source uncertainty: {c.notes?.join(" ")}</p>
      )}
      <div className="row">
        {onUse && (
          <button className="quiet" onClick={() => onUse(id)}>
            Use / resolve effect
          </button>
        )}
        {c.source && (
          <a className="small" href={c.source} target="_blank" rel="noreferrer">
            Source image ↗
          </a>
        )}
      </div>
    </article>
  );
}
function CombatForm({
  room,
  p,
  act,
  busy,
}: {
  room: PublicRoom;
  p: PublicRoom["players"][0];
  act: (a: Action) => void;
  busy: boolean;
}) {
  const [weapon, setWeapon] = useState(""),
    [drink, setDrink] = useState(""),
    [defense, setDefense] = useState(""),
    [finisher, setFinisher] = useState(false),
    [escape, setEscape] = useState(false),
    [suppress, setSuppress] = useState(false),
    [modifier, setModifier] = useState(0),
    [reason, setReason] = useState("");
  const f = room.combat!;
  const powers = characterRecord(p.character).powers;
  const has = (id: string) => powers.some((x) => x.id === id);
  if (f.choices[p.id])
    return <p>Your combat choice is locked. Waiting for the other player.</p>;
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        act({
          type: "combat-choice",
          weapon: weapon || null,
          drink: drink || null,
          defense: defense || null,
          finisher,
          escape,
          suppress,
          modifier,
          reason,
        });
      }}
    >
      <h3>
        {f.mortal
          ? "Mortal combat"
          : f.ranged
            ? "Ranged combat"
            : "Choose your combat equipment"}
      </h3>
      <p className="small">
        Each combatant chooses before the dice are rolled. A natural 10 wins and
        a natural 1 loses; matching automatic results tie.
      </p>
      <label>
        Weapon
        <select value={weapon} onChange={(e) => setWeapon(e.target.value)}>
          <option value="">No Weapon</option>
          {p.items
            .filter(
              (id) =>
                card(id).weapon &&
                (!f.ranged || p.id !== f.attacker || card(id).ranged),
            )
            .map((id) => (
              <option key={id} value={id}>
                {cardName(id)} (+{card(id).combat})
              </option>
            ))}
        </select>
      </label>
      <label>
        Consume a 2-liter for +2
        <select value={drink} onChange={(e) => setDrink(e.target.value)}>
          <option value="">Save my drinks</option>
          {p.items
            .filter((id) => card(id).use === "drink")
            .map((id) => (
              <option key={id} value={id}>
                {cardName(id)}
              </option>
            ))}
        </select>
      </label>
      <label>
        Protect against Life loss
        <select value={defense} onChange={(e) => setDefense(e.target.value)}>
          <option value="">No armor</option>
          {p.items
            .filter((id) => card(id).use === "armor")
            .map((id) => (
              <option key={id} value={id}>
                {cardName(id)}
              </option>
            ))}
        </select>
      </label>
      {has("fiend_finishing_move") && !f.defender && (
        <label className="check">
          <input
            type="checkbox"
            checked={finisher}
            onChange={(e) => setFinisher(e.target.checked)}
          />
          Finishing move: +2; lose 2 Lives on defeat
        </label>
      )}
      {has("escape_attempt") && (
        <label className="check">
          <input
            type="checkbox"
            checked={escape}
            onChange={(e) => setEscape(e.target.checked)}
          />
          Attempt escape: +5; a win becomes a tie
        </label>
      )}
      {has("suppress_opponent_homies") && (
        <label className="check">
          <input
            type="checkbox"
            checked={suppress}
            onChange={(e) => setSuppress(e.target.checked)}
          />
          Suppress opponent’s Homies
        </label>
      )}
      <details>
        <summary>Other card modifiers</summary>
        <p className="small">
          Weapons and simple equipment bonuses are counted automatically. Add
          only conditional card effects you have checked.
        </p>
        <label>
          Additional combat modifier
          <input
            type="number"
            min="-100"
            max="100"
            value={modifier}
            onChange={(e) => setModifier(Number(e.target.value))}
          />
        </label>
        <label>
          Card / rule used
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required={modifier !== 0}
            maxLength={200}
          />
        </label>
      </details>
      <button className="primary" disabled={busy}>
        Lock choice & roll when ready
      </button>
    </form>
  );
}
function TableControls({
  room,
  p,
  act,
  busy,
}: {
  room: PublicRoom;
  p: PublicRoom["players"][0];
  act: (a: Action) => void;
  busy: boolean;
}) {
  const [target, setTarget] = useState(room.ruling?.actor ?? p.id),
    [stat, setStat] = useState("life"),
    [amount, setAmount] = useState(1),
    [reason, setReason] = useState(""),
    [item, setItem] = useState(""),
    [recipient, setRecipient] = useState(""),
    [region, setRegion] = useState(0),
    [pos, setPos] = useState(0),
    [deck, setDeck] = useState("0");
  const chosen = room.players.find((x) => x.id === target) ?? p;
  return (
    <div className="ruling-panel">
      <h3>Resolve the printed effect</h3>
      <p>{room.ruling?.reason}</p>
      <p className="small">
        These are shared tabletop controls. Follow the card, agree on choices
        with the table, and record each adjustment. The game logs every action.
      </p>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          act({
            type: "ruling-adjust",
            target,
            stat,
            amount,
            item: item || undefined,
            choice: recipient || undefined,
            region,
            pos,
            deck: deck === "bone" ? "bone" : Number(deck),
            reason: reason || room.ruling?.reason || "Card effect",
          });
        }}
      >
        <label>
          Player
          <select
            value={target}
            onChange={(e) => {
              setTarget(e.target.value);
              setItem("");
            }}
          >
            {room.players
              .filter((p) => !p.dead)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Apply effect
          <select
            value={stat}
            onChange={(e) => {
              setStat(e.target.value);
              setItem("");
            }}
          >
            {[
              ["life", "Change Life"],
              ["cash", "Change Cash"],
              ["bonus", "Change base Combat Bonus"],
              ["boost", "Modifier for next combat roll"],
              ["skip", "Change missed turns"],
              ["extra", "Change extra turns"],
              ["move", "Move token"],
              ["draw", "Draw a card"],
              ["discard", "Discard a held card"],
              ["transfer", "Transfer a held card"],
              ["retrieve", "Take a discard / Purchase Item"],
              ["note", "Save a condition or reminder"],
              ["reverse", "Reverse turn order"],
              ["eliminate", "Eliminate player"],
              ["win", "Declare card-based victory"],
            ].map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {["life", "cash", "bonus", "boost", "skip", "extra"].includes(stat) && (
          <label>
            Amount (+ gain / − loss)
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </label>
        )}
        {["discard", "transfer", "retrieve"].includes(stat) && (
          <label>
            Card
            <select
              required
              value={item}
              onChange={(e) => setItem(e.target.value)}
            >
              <option value="">Choose a card</option>
              {(stat === "retrieve"
                ? [...room.discardCards, ...room.purchase]
                : [...chosen.items, ...chosen.homies, ...chosen.bones]
              ).map((id) => (
                <option key={id} value={id}>
                  {cardName(id)}
                </option>
              ))}
            </select>
          </label>
        )}
        {stat === "transfer" && (
          <label>
            Give to
            <select
              value={recipient}
              required
              onChange={(e) => setRecipient(e.target.value)}
            >
              <option value="">Choose a player</option>
              {room.players
                .filter((p) => !p.dead && p.id !== target)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>
        )}
        {stat === "move" && (
          <>
            <label>
              Region
              <select
                value={region}
                onChange={(e) => {
                  setRegion(Number(e.target.value));
                  setPos(0);
                }}
              >
                {[...REGIONS, "Shangri-La"].map((r, i) => (
                  <option key={r} value={i}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Space
              <select
                value={pos}
                onChange={(e) => setPos(Number(e.target.value))}
              >
                {Array.from({ length: COUNTS[region] ?? 1 }, (_, i) => (
                  <option value={i} key={i}>
                    {spaceName(region, i)} · {i + 1}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        {stat === "draw" && (
          <label>
            Deck
            <select value={deck} onChange={(e) => setDeck(e.target.value)}>
              {REGIONS.map((r, i) => (
                <option key={r} value={i}>
                  {r}
                </option>
              ))}
              <option value="bone">Bones</option>
            </select>
          </label>
        )}
        <label>
          Rule / condition / reason
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={240}
            placeholder="Use the displayed rule, or add a note"
          />
        </label>
        <button disabled={busy} className="secondary">
          Apply & record
        </button>
      </form>
    </div>
  );
}
function TradeForm({
  room,
  p,
  act,
  busy,
}: {
  room: PublicRoom;
  p: PublicRoom["players"][0];
  act: (a: Action) => void;
  busy: boolean;
}) {
  const others = room.players.filter(
    (q) => !q.dead && q.id !== p.id && q.region === p.region && q.pos === p.pos,
  );
  const [target, setTarget] = useState(""),
    [give, setGive] = useState(""),
    [ask, setAsk] = useState(""),
    [giveCash, setGiveCash] = useState(0),
    [askCash, setAskCash] = useState(0);
  if (!others.length) return null;
  const q = others.find((q) => q.id === target);
  return (
    <details>
      <summary>Offer a trade</summary>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          act({
            type: "trade",
            target,
            give: give || null,
            ask: ask || null,
            giveCash,
            askCash,
          });
        }}
      >
        <label>
          Trade with
          <select
            value={target}
            required
            onChange={(e) => {
              setTarget(e.target.value);
              setAsk("");
            }}
          >
            <option value="">Choose a player</option>
            {others.map((q) => (
              <option key={q.id} value={q.id}>
                {q.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Give Item
          <select value={give} onChange={(e) => setGive(e.target.value)}>
            <option value="">No Item</option>
            {p.items.map((id) => (
              <option key={id} value={id}>
                {cardName(id)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Give Cash
          <input
            min="0"
            max={p.cash}
            type="number"
            value={giveCash}
            onChange={(e) => setGiveCash(Number(e.target.value))}
          />
        </label>
        <label>
          Request Item
          <select value={ask} onChange={(e) => setAsk(e.target.value)}>
            <option value="">No Item</option>
            {q?.items.map((id) => (
              <option key={id} value={id}>
                {cardName(id)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Request Cash
          <input
            min="0"
            type="number"
            value={askCash}
            onChange={(e) => setAskCash(Number(e.target.value))}
          />
        </label>
        <button disabled={busy} className="secondary">
          Offer trade
        </button>
      </form>
    </details>
  );
}
export default function Home() {
  const [room, setRoom] = useState<PublicRoom | null>(null),
    [code, setCode] = useState(""),
    [joinCode, setJoinCode] = useState(""),
    [name, setName] = useState(""),
    [character, setCharacter] = useState(CHARACTERS[0]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [connection, setConnection] = useState(""),
    [toast, setToast] = useState(""),
    [recent, setRecent] = useState<string[]>([]),
    [tollItem, setTollItem] = useState(""),
    [search, setSearch] = useState(""),
    [wager, setWager] = useState(0);
  const rules = useRef<HTMLDialogElement>(null),
    busyRef = useRef(false),
    roomRef = useRef(room);
  roomRef.current = room;
  const update = useCallback(
    (next: PublicRoom) =>
      setRoom((old) =>
        old?.code === next.code && old.rev > next.rev ? old : next,
      ),
    [],
  );
  useEffect(() => {
    const c = new URLSearchParams(window.location.search)
      .get("room")
      ?.toUpperCase();
    if (c && /^[A-Z2-9]{6}$/.test(c)) {
      setCode(c);
      setJoinCode(c);
    }
    try {
      const saved = JSON.parse(localStorage.getItem("qsl_recent") ?? "[]");
      setRecent(
        Array.isArray(saved)
          ? saved
              .filter(
                (x: unknown) =>
                  typeof x === "string" && /^[A-Z2-9]{6}$/.test(x),
              )
              .slice(0, 5)
          : [],
      );
      setName(localStorage.getItem("qsl_name") ?? "");
    } catch {}
  }, []);
  useEffect(() => {
    if (!code) return;
    let cancelled = false,
      running = false;
    async function load() {
      if (running || busyRef.current) return;
      running = true;
      try {
        const next = await api("/api/rooms/" + code);
        if (!cancelled) {
          update(next);
          setConnection("");
        }
      } catch (e) {
        if (!cancelled) setConnection((e as Error).message);
      } finally {
        running = false;
      }
    }
    void load();
    const timer = setInterval(load, 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [code, update]);
  function remember(c: string) {
    try {
      const list = [c, ...recent.filter((x) => x !== c)].slice(0, 5);
      localStorage.setItem("qsl_recent", JSON.stringify(list));
      localStorage.setItem("qsl_name", name);
      setRecent(list);
    } catch {}
    window.history.replaceState({}, "", `?room=${c}`);
    setCode(c);
    setJoinCode(c);
  }
  async function enter(join: boolean) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      if (join && !/^[A-Z2-9]{6}$/.test(joinCode.trim().toUpperCase()))
        throw new Error("Enter the six-character room code.");
      const next = await api(
        join ? "/api/rooms/" + joinCode.trim().toUpperCase() : "/api/rooms",
        { name, character },
      );
      update(next);
      remember(next.code);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  const act = useCallback(
    async (a: Action) => {
      const r = roomRef.current;
      if (!r || busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setError("");
      try {
        const next = await api(`/api/rooms/${r.code}/action`, {
          ...a,
          actor: a.actor ?? r.control ?? r.me ?? undefined,
          version: r.rev,
        });
        update(next);
        return { phase: next.phase, status: next.status, revision: next.rev };
      } catch (e) {
        setError((e as Error).message);
        try {
          update(await api("/api/rooms/" + r.code));
        } catch {}
        throw e;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [update],
  );
  function action(a: Action) {
    void act(a).catch(() => {});
  }
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const tools = [
      {
        name: "read_game_table",
        title: "Read the game table",
        description: "Read the current room, active player and legal choices.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
        execute: () => roomRef.current ?? { status: "no_room" },
      },
      {
        name: "take_game_action",
        title: "Take a game action",
        description:
          "Perform a listed game action as your own seat. Changes the shared table. Turn ownership and revision are checked on the server.",
        inputSchema: {
          type: "object",
          properties: {
            type: { type: "string" },
            region: { type: "integer" },
            pos: { type: "integer" },
            item: { type: "string" },
            choice: { type: "string" },
          },
          required: ["type"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false },
        execute: async (input: Action) => act(input),
      },
    ];
    for (const tool of tools)
      try {
        Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {}
    return () => lifecycle.abort();
  }, [act]);
  const me = room?.players.find((p) => p.id === room.me),
    p = room?.players.find((p) => p.id === room.control) ?? me,
    active = room?.players[room.turn],
    myTurn =
      !!p && p.id === active?.id && room?.status === "playing" && !room.legacy,
    host = me?.id === room?.host,
    choices = myTurn ? (room?.choices ?? []) : [],
    roster = characterRecord(character);
  const groups = [...new Set(room?.options?.map((o) => o.group) ?? [])];
  const inCombat =
    room?.combat &&
    p &&
    [room.combat.attacker, room.combat.defender].includes(p.id);
  const canRule = room?.ruling && p && (room.ruling.actor === p.id || host);
  const canUse =
    (myTurn || !!inCombat) &&
    ["roll", "move", "encounter", "end", "combat", "ending"].includes(
      room?.phase ?? "",
    );
  function closeView() {
    setRoom(null);
    setCode("");
    setJoinCode("");
    setConnection("");
    setError("");
    setToast("");
    window.history.replaceState({}, "", "/");
  }
  function move(region: number, pos: number) {
    action({ type: "move", region, pos, item: tollItem || undefined });
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/?room=${room?.code}`,
      );
      setToast("Invite link copied.");
    } catch {
      setToast(`Share room code ${room?.code}`);
    }
  }
  return (
    <main>
      <header className="topbar">
        <div className="wordmark">
          <span className="brand-mark">◇</span>
          <div>
            THE QUEST FOR <strong>SHANGRI-LA</strong>
          </div>
        </div>
        <span className="edition">UNOFFICIAL · ASSISTED TABLETOP</span>
        <div className="row">
          {room && (
            <button className="quiet" onClick={closeView} disabled={busy}>
              Tables
            </button>
          )}
          <button className="quiet" onClick={() => rules.current?.showModal()}>
            Rules & cards
          </button>
        </div>
      </header>
      <div className={"game-layout " + (room ? "playing" : "")}>
        <section className="table">
          <div className="table-heading">
            <div>
              <span className="eyebrow">
                {room
                  ? `ROOM ${room.code} · ${room.status === "lobby" ? "WAITING FOR PLAYERS" : `ROUND ${room.round}`}`
                  : "GATHER YOUR HOMIES"}
              </span>
              <h1>
                {room?.legacy
                  ? "Saved prototype table"
                  : room?.status === "finished"
                    ? "The quest is complete."
                    : room?.status === "playing"
                      ? myTurn
                        ? p?.bot
                          ? "Practice opponent’s choice."
                          : "Your move."
                        : `${active?.name}’s turn.`
                      : "Your quest starts here."}
              </h1>
            </div>
            <span className="table-note">
              {room ? `${room.players.length}/6 seated` : "2–6 players"}
            </span>
          </div>
          {connection && (
            <div className="error" role="status">
              {connection} Reconnecting automatically.
            </div>
          )}
          {room?.legacy && (
            <div className="notice">
              <strong>This saved table uses the old prototype rules.</strong>
              <p>
                Its history is preserved. Create a new table to play with the
                researched cards, character records and endings.
              </p>
              <button className="primary" onClick={closeView}>
                Create a corrected table
              </button>
            </div>
          )}
          <Board
            players={room?.players}
            choices={choices}
            active={room?.status === "playing" ? active?.id : undefined}
            disabled={busy}
            onMove={move}
          />
          <div className="table-footer">
            <span>
              60 mapped spaces ·{" "}
              {room?.space?.name ?? "Original board reference"}
            </span>
            <span>18 characters · 10 endings</span>
          </div>
          {room?.ending && (
            <section className="panel ending-panel">
              <span className="eyebrow">SHANGRI-LA REVEALED</span>
              <h2>{room.ending.name}</h2>
              <p>{room.ending.rules}</p>
              {room.endingHolder && (
                <p>
                  Holder:{" "}
                  {room.players.find((p) => p.id === room.endingHolder)?.name}
                </p>
              )}
            </section>
          )}
          {room && (
            <section className="panel">
              <div className="row">
                <h3>At the table</h3>
                <span className="small">Saved automatically</span>
              </div>
              <div className="players player-grid">
                {room.players.map((q) => (
                  <details
                    key={q.id}
                    className={
                      "player-detail " + (q.id === active?.id ? "active" : "")
                    }
                  >
                    <summary>
                      <span className="avatar" style={{ background: q.color }}>
                        {q.name[0].toUpperCase()}
                      </span>
                      <span>
                        <strong>
                          {q.name}
                          {q.id === me?.id ? " · you" : ""}
                        </strong>
                        <span className="stats">{q.character}</span>
                        <span className="stats">
                          {q.dead
                            ? "Eliminated"
                            : `♥ ${q.life}/${q.maxLife} · CB ${q.bonus} · $${q.cash}`}
                        </span>
                      </span>
                    </summary>
                    <p className="small">
                      {q.allegiance} · {spaceName(q.region, q.pos)}
                      {q.skip ? ` · ${q.skip} missed turn(s)` : ""}
                    </p>
                    {q.notes && <p className="notice">{q.notes}</p>}
                    {!room.legacy && (
                      <>
                        <h4>
                          Items ({q.items.length}) · Homies ({q.homies.length})
                        </h4>
                        {[...q.items, ...q.homies, ...q.bones].map((id) => (
                          <CardView key={id} id={id} />
                        ))}
                      </>
                    )}
                  </details>
                ))}
              </div>
            </section>
          )}
          {room && !room.legacy && Object.keys(room.board ?? {}).length > 0 && (
            <details className="panel">
              <summary>Cards on the board</summary>
              {Object.entries(room.board).map(([key, ids]) => {
                const [r, pos] = key.split(":").map(Number);
                return (
                  <div key={key}>
                    <h3>
                      {spaceName(r, pos)} · {REGIONS[r]}
                    </h3>
                    {ids.map((id) => (
                      <CardView id={id} key={id} />
                    ))}
                  </div>
                );
              })}
            </details>
          )}
        </section>
        <aside className="sidebar">
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {(!room || (!me && !room.legacy)) && (
            <section className="panel join-panel">
              <span className="eyebrow">TAKE A SEAT</span>
              <h2>{room ? "Join this table." : "Choose your character."}</h2>
              <form
                className="stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  void enter(!!room);
                }}
              >
                <label>
                  Your name
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="What should we call you?"
                    maxLength={24}
                    autoComplete="nickname"
                    required
                  />
                </label>
                <label>
                  Character
                  <select
                    value={character}
                    onChange={(e) => setCharacter(e.target.value)}
                  >
                    {CHARACTERS.map((c) => (
                      <option
                        key={c}
                        disabled={room?.players.some((p) => p.character === c)}
                      >
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="character-record">
                  <strong>{roster.name}</strong>
                  <p>
                    ♥ {roster.startingLife} Life · CB {roster.baseCombatBonus}{" "}
                    · ${roster.startingCash}
                  </p>
                  <p className="small">
                    {roster.allegiance} · starts at {roster.startingSpace}
                  </p>
                  <p className="small">
                    Starting Items: {roster.startingItems.join(", ") || "none"}
                  </p>
                  <details>
                    <summary>Character powers</summary>
                    {roster.powers.map((power) => (
                      <p key={power.id} className="small">
                        {power.summary}
                      </p>
                    ))}
                  </details>
                </div>
                <p className="small">
                  Shared multiplayer table with researched mechanics. Movement
                  and basic combat are automated; special cards and powers use
                  logged table controls.
                </p>
                <button
                  className="primary"
                  disabled={
                    busy ||
                    room?.status === "playing" ||
                    room?.status === "finished"
                  }
                >
                  {busy
                    ? "Opening table…"
                    : room
                      ? "Join table"
                      : "Create a table"}
                </button>
              </form>
              {!room && (
                <>
                  <div className="divider">OR JOIN A TABLE</div>
                  <form
                    className="stack"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void enter(true);
                    }}
                  >
                    <label>
                      Room code
                      <input
                        value={joinCode}
                        onChange={(e) =>
                          setJoinCode(
                            e.target.value
                              .toUpperCase()
                              .replace(/[^A-Z2-9]/g, ""),
                          )
                        }
                        maxLength={6}
                        required
                        placeholder="ABC234"
                      />
                    </label>
                    <button
                      className="secondary"
                      disabled={busy || !name.trim()}
                    >
                      Join table
                    </button>
                  </form>
                </>
              )}
            </section>
          )}
          {room && me && !room.legacy && (
            <section className="panel">
              <div className="row">
                <div>
                  <span className="eyebrow">INVITE YOUR FRIENDS</span>
                  <div className="room-code">{room.code}</div>
                </div>
                <button className="quiet" onClick={copy}>
                  Copy invite
                </button>
              </div>
              {toast && (
                <p className="toast" role="status">
                  {toast}
                </p>
              )}
              {room.status === "lobby" ? (
                <>
                  <h2>Gather at the table.</h2>
                  <p>
                    The highest d10 roll takes the first turn. A hidden ending
                    waits in Shangri-La.
                  </p>
                  <label>
                    Your character
                    <select
                      value={me.character}
                      disabled={busy}
                      onChange={(e) =>
                        action({ type: "character", character: e.target.value })
                      }
                    >
                      {CHARACTERS.map((c) => (
                        <option
                          key={c}
                          disabled={room.players.some(
                            (p) => p.character === c && p.id !== me.id,
                          )}
                        >
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="actions">
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => action({ type: "ready" })}
                    >
                      {me.ready ? "Ready · click to unready" : "I’m ready"}
                    </button>
                    {host && (
                      <>
                        <button
                          className="primary"
                          disabled={
                            busy ||
                            room.players.length < 2 ||
                            room.players.some((p) => !p.ready)
                          }
                          onClick={() => action({ type: "start" })}
                        >
                          Start the quest
                        </button>
                        <button
                          className="quiet"
                          disabled={busy || room.players.length >= 6}
                          onClick={() => action({ type: "add-bot" })}
                        >
                          Add practice opponent
                        </button>
                        <p className="small">
                          You make the practice opponent’s special-card and
                          combat choices.
                        </p>
                      </>
                    )}
                  </div>
                </>
              ) : room.status === "finished" ? (
                <>
                  <h2>
                    {room.winners
                      .map((id) => room.players.find((p) => p.id === id)?.name)
                      .join(" & ") || "No survivors"}
                  </h2>
                  <button className="primary" onClick={closeView}>
                    Open a new table
                  </button>
                </>
              ) : (
                <>
                  <hr className="panel-rule" />
                  <span className="eyebrow">
                    {p?.bot
                      ? "HOST CONTROLS PRACTICE OPPONENT"
                      : myTurn
                        ? "YOUR TURN"
                        : me.dead
                          ? "SPECTATING"
                          : `WAITING FOR ${active?.name.toUpperCase()}`}
                  </span>
                  {room.lastDice?.length > 0 && (
                    <div
                      className="dice-row"
                      aria-label={`Latest dice: ${room.lastDice.join(", ")}`}
                    >
                      {room.lastDice.map((d, i) => (
                        <span className="dice" key={i}>
                          {d}
                        </span>
                      ))}
                    </div>
                  )}
                  {room.phase === "encounter" &&
                    !room.encounter &&
                    room.space && (
                      <div className="card">
                        <h3>{room.space.name}</h3>
                        <p>{room.space.rules}</p>
                      </div>
                    )}
                  {room.encounter && <CardView id={room.encounter} />}{" "}
                  {myTurn && room.phase === "move" && (
                    <>
                      <p>Choose a highlighted destination.</p>
                      {choices.some((d) => d.itemToll) && (
                        <label>
                          Item to pay at the Portal
                          <select
                            value={tollItem}
                            onChange={(e) => setTollItem(e.target.value)}
                          >
                            <option value="">
                              Choose only if crossing inward
                            </option>
                            {p?.items
                              .filter((id) => !id.startsWith("ending-"))
                              .map((id) => (
                                <option key={id} value={id}>
                                  {cardName(id)}
                                </option>
                              ))}
                          </select>
                        </label>
                      )}
                      <div className="actions">
                        {choices.map((d, i) => (
                          <button
                            key={`${d.region}:${d.pos}:${i}`}
                            disabled={busy || (d.itemToll && !tollItem)}
                            onClick={() => move(d.region, d.pos)}
                          >
                            {spaceName(d.region, d.pos)}
                            <span className="choice-detail">
                              {REGIONS[d.region] ?? "Shangri-La"}
                              {d.toll ? ` · $${d.toll}` : ""}
                              {d.itemToll ? " · discard 1 Item" : ""}
                              {d.reason ? ` · ${d.reason}` : ""}
                            </span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  {inCombat && p && (
                    <CombatForm
                      key={JSON.stringify(room.combat?.choices)}
                      room={room}
                      p={p}
                      act={action}
                      busy={busy}
                    />
                  )}{" "}
                  {canRule && p && (
                    <TableControls
                      key={`${room.ruling?.reason}:${room.ruling?.actor}`}
                      room={room}
                      p={p}
                      act={action}
                      busy={busy}
                    />
                  )}{" "}
                  {room.trade && (
                    <div className="notice">
                      <strong>Trade offered</strong>
                      <p>
                        {
                          room.players.find((p) => p.id === room.trade!.from)
                            ?.name
                        }{" "}
                        offers{" "}
                        {room.trade.give
                          ? cardName(room.trade.give)
                          : "no Item"}{" "}
                        + ${room.trade.giveCash} for{" "}
                        {room.trade.ask ? cardName(room.trade.ask) : "no Item"}{" "}
                        + ${room.trade.askCash}.
                      </p>
                    </div>
                  )}
                  {groups.map((group) => (
                    <div className="option-group" key={group}>
                      <h3>{group}</h3>
                      <div className="actions">
                        {room.options
                          .filter((o) => o.group === group)
                          .map((o, i) => (
                            <button
                              className={
                                group === "Turn" ? "primary" : "secondary"
                              }
                              disabled={busy}
                              key={i}
                              onClick={() => action(o.action)}
                            >
                              {o.label}
                            </button>
                          ))}
                      </div>
                    </div>
                  ))}
                  {myTurn &&
                    room.phase === "end" &&
                    p?.region === 0 &&
                    p.pos === 23 &&
                    !p.used.includes("gamble") && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          action({ type: "gamble", amount: wager });
                        }}
                      >
                        <label>
                          Casino wager
                          <input
                            type="number"
                            min="0"
                            max={p.cash}
                            value={wager}
                            onChange={(e) => setWager(Number(e.target.value))}
                          />
                        </label>
                        <button disabled={busy} className="secondary">
                          Place wager
                        </button>
                      </form>
                    )}
                  {canUse && p && (
                    <>
                      <TradeForm room={room} p={p} act={action} busy={busy} />
                      <button
                        className="quiet wide"
                        disabled={busy}
                        onClick={() =>
                          action({
                            type: "table-rule",
                            reason:
                              "Resolve a special card, character power, or board rule by agreement with the table.",
                          })
                        }
                      >
                        Resolve another rule
                      </button>
                    </>
                  )}
                </>
              )}
            </section>
          )}
          {room && p && !room.legacy && (
            <section className="panel">
              <span className="eyebrow">
                {p.bot ? "PRACTICE OPPONENT" : "YOUR CHARACTER"}
              </span>
              <h2>{p.character}</h2>
              <p>
                {p.allegiance} · ♥ {p.life}/{p.maxLife} · CB {p.bonus} · $
                {p.cash}
              </p>
              <details>
                <summary>Powers & timing</summary>
                {(room.yourPowers ?? characterRecord(p.character).powers).map(
                  (power) => (
                    <div className="power" key={power.id}>
                      <p>{power.summary}</p>
                      {canUse && (
                        <button
                          disabled={busy}
                          className="quiet"
                          onClick={() =>
                            action({
                              type: "table-rule",
                              reason: power.summary,
                            })
                          }
                        >
                          Resolve using table controls
                        </button>
                      )}
                    </div>
                  ),
                )}
              </details>
              {p.notes && <p className="notice">{p.notes}</p>}
              <h3>
                Items · {p.items.length}/
                {p.items.some((id) => cardName(id) === "Backpack") ? 9 : 6}
              </h3>
              {p.items.length === 0 && <p className="small">No Items.</p>}
              {p.items.map((id) => (
                <CardView
                  key={id}
                  id={id}
                  onUse={
                    canUse
                      ? (id) =>
                          action({
                            type: "table-rule",
                            item: id,
                            reason: card(id).rules,
                          })
                      : undefined
                  }
                />
              ))}
              <h3>Homies · {p.homies.length}</h3>
              {p.homies.map((id) => (
                <CardView
                  key={id}
                  id={id}
                  onUse={
                    canUse
                      ? (id) =>
                          action({
                            type: "table-rule",
                            item: id,
                            reason: card(id).rules,
                          })
                      : undefined
                  }
                />
              ))}
              {p.bones.length > 0 && <h3>Bone effects</h3>}
              {p.bones.map((id) => (
                <CardView
                  key={id}
                  id={id}
                  onUse={
                    canUse
                      ? (id) =>
                          action({
                            type: "table-rule",
                            item: id,
                            reason: card(id).rules,
                          })
                      : undefined
                  }
                />
              ))}
            </section>
          )}
          {room && (
            <section className="panel">
              <span className="eyebrow">THE STORY SO FAR</span>
              <ul className="log" aria-live="polite">
                {room.log.slice(0, 20).map((x, i) => (
                  <li key={`${room.rev - i}-${x}`}>{x}</li>
                ))}
              </ul>
            </section>
          )}
          {!room && recent.length > 0 && (
            <section className="panel">
              <h3>Return to a table</h3>
              <div className="row">
                {recent.map((c) => (
                  <button
                    key={c}
                    className="quiet"
                    onClick={() => {
                      setCode(c);
                      setJoinCode(c);
                      window.history.replaceState({}, "", `?room=${c}`);
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </section>
          )}
          <section className="panel edition-panel">
            <span className="eyebrow">ABOUT THIS EDITION</span>
            <p className="small">
              Reconstructed from the scanned rulebook and community component
              photographs. Rules are paraphrased. Special effects and their
              timing need manual resolution, and the recovered card counts have
              unresolved duplicates. This is not an official or perfect replica.
            </p>
            <button
              className="quiet wide"
              onClick={() => rules.current?.showModal()}
            >
              Browse rules & source notes
            </button>
          </section>
        </aside>
      </div>
      <dialog ref={rules} className="rules-dialog">
        <div className="modal">
          <div className="modal-head">
            <h2>Rules & card library</h2>
            <button className="quiet" onClick={() => rules.current?.close()}>
              Close
            </button>
          </div>
          <p className="notice">
            Unofficial assisted tabletop. Special card effects require players
            to apply the displayed rules using shared controls. Automatic rules
            do not cover every interaction.
          </p>
          <h3>Playing a turn</h3>
          <ol>
            <li>
              Apply start-of-turn powers and Items, then roll movement. Choose a
              highlighted destination.
            </li>
            <li>
              Pay $100 to enter Nethervoid, or discard one Item to enter Dark
              Carnival. Magic Ninja waives these tolls. Enter Shangri-La with at
              least 15 base Combat Bonus.
            </li>
            <li>
              Encounter existing cards before the printed space. You can instead
              challenge another player on your space, or make a ranged attack
              against an adjacent target in the same region.
            </li>
            <li>
              Combat adds d10, base Combat Bonus, one Weapon and applicable card
              effects. Both players declare their choices first. A player-combat
              winner chooses Life loss, up to $300, an Item, or discarding one
              Homie.
            </li>
            <li>
              Use table controls for effects marked manual. Roll dice, adjust
              stats, move or transfer cards and record conditions. Every change
              is visible in the log.
            </li>
            <li>
              Keep up to six Items (nine with Backpack); Homies do not use Item
              slots. End the turn after resolving the encounter.
            </li>
          </ol>
          <h3>What is automated</h3>
          <p>
            Character starting stats and equipment, movement paths and tolls,
            ordinary combat, natural 1/10 results, weapon breakage, basic shops,
            trade consent, the first-death replacement character, and the ten
            ending structures. Check conditional Items, Homies, Bones and powers
            before rolling: use the combat modifier and table controls where
            needed.
          </p>
          <h3>Source limitations</h3>
          <p>
            The recovered community inventory contains 101 Detroit, 90
            Nethervoid and 69 Dark Carnival cards, 13 Bones, and 40 Purchase
            Items. A Detroit atlas repeats 19 card faces. Three titles are
            unclear. These counts are preserved as evidence, not certified
            physical-edition counts. Board photography has glare and cropping.
            Card artwork is not reproduced here.
          </p>
          <ul>
            <li>
              <a
                href="https://drive.google.com/file/d/1B5uLPQUczukkIaobj1eUxzcDutSJ-1Ml/view"
                target="_blank"
                rel="noreferrer"
              >
                Scanned rulebook
              </a>
            </li>
            <li>
              <a
                href="https://steamcommunity.com/sharedfiles/filedetails/?id=3079987608"
                target="_blank"
                rel="noreferrer"
              >
                Community component source
              </a>
            </li>
          </ul>
          <h3>Card library</h3>
          <label>
            Find a card
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or effect"
            />
          </label>
          <p className="small">
            {
              CARDS.filter(
                (c) =>
                  c.deck !== "ending" &&
                  `${c.name} ${c.rules}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
              ).length
            }{" "}
            matching component records. Duplicate records reflect the source
            inventory.
          </p>
          <div className="card-library">
            {CARDS.filter(
              (c) =>
                c.deck !== "ending" &&
                `${c.name} ${c.rules}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
            )
              .slice(0, 40)
              .map((c) => (
                <CardView key={c.key} id={c.key} />
              ))}
          </div>
        </div>
      </dialog>
    </main>
  );
}
