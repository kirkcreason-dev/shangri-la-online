"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Board, { spaceName } from "@/components/game/Board";
import {
  CHARACTERS,
  REGIONS,
  COUNTS,
  CARDS,
  card,
  cardName,
  character as characterRecord,
} from "@/lib/rules/catalog";
import { ChoiceCard, CardSelect } from '@/components/game/ChoiceCards';
import { TableDock, QuestProgress } from '@/components/game/TableDock';
import { TableActivity } from '@/components/game/TableActivity';
import { StartGame, GameLobby, SavedTables } from '@/components/game/StartGame';
import { LearnToPlay } from "@/components/game/LearnToPlay";
import { TableGuide, jumpToTableSection } from "@/components/game/TableGuide";
import { tableGuidance } from "@/lib/table-guide";
import { roomCodeFromInput, parseRecentTables, rememberTable, type RecentTable } from "@/lib/table-preferences";
import { RoomChat } from "@/components/game/RoomChat";
import { gameFetch, gameBasePath, gameInvite } from "@/lib/client-connection";
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
  | "peek"
  | "flow"
> & {
  players: (Omit<Player, "session"> & {
    controller: string;
    capacity: number;
    conditionDetails: {
      id: string;
      name: string;
      rules: string;
      turns: number | null;
      branch: string | null;
      controller: string | null;
    }[];
  })[];
  pendingCard: {
    player: string;
    message: string;
    choices: { id: string; label: string }[];
  } | null;
  peek: string | null;
  serverTime: number;
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
async function api(path: string, data?: unknown, signal?: AbortSignal) {
  const r = await gameFetch(path, {
    method: data ? "POST" : "GET",
    headers: data ? { "Content-Type": "application/json" } : undefined,
    body: data ? JSON.stringify(data) : undefined,
    cache: "no-store",
    signal,
  });
  const value = (await r.json().catch(() => { throw new Error("The table is temporarily unavailable. Please reconnect."); })) as PublicRoom & { error?: string };
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
        {onUse && !c.automatic && (
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
  const powers = room.yourPowers;
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
        <CardSelect aria-label="Weapon" value={weapon} onChange={(e) => setWeapon(e.target.value)}>
          <option value="">No Weapon</option>
          {p.items
            .filter(
              (id) =>
                ![...p.homies, ...p.bones].some((x) =>
                  ["Officer Harry Cox", "Slippery Palms"].includes(cardName(x)),
                ) &&
                card(id).weapon &&
                (!f.ranged || p.id !== f.attacker || card(id).ranged) && !f.cards.some(id=>cardName(id)==='R. O. C.'),
            )
            .map((id) => (
              <option key={id} value={id}>
                {cardName(id)} (+{card(id).combat})
              </option>
            ))}
        </CardSelect>
      </label>
      <label>
        Consume a 2-liter for +2
        <CardSelect aria-label="Consume a 2-liter for +2" value={drink} onChange={(e) => setDrink(e.target.value)}>
          <option value="">Save my drinks</option>
          {p.items
            .filter((id) => card(id).use === "drink")
            .map((id) => (
              <option key={id} value={id}>
                {cardName(id)}
              </option>
            ))}
        </CardSelect>
      </label>
      <label>
        Protect against Life loss
        <CardSelect aria-label="Protect against Life loss" value={defense} onChange={(e) => setDefense(e.target.value)}>
          <option value="">No armor</option>
          {p.items
            .filter((id) => card(id).use === "armor")
            .map((id) => (
              <option key={id} value={id}>
                {cardName(id)}
              </option>
            ))}
        </CardSelect>
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
          Equipment and supported Homie bonuses are counted automatically. Use
          the Items & Homies buttons before locking your choice. Add a modifier
          here only for an effect still marked for table controls.
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
function TeleportForm({
  room,
  act,
  busy,
}: {
  room: PublicRoom;
  act: (a: Action) => void;
  busy: boolean;
}) {
  const eligible = room.players.filter(
    (p) =>
      p.id !== room.itemPrompt?.player &&
      !p.dead &&
      !p.respawn &&
      !(p.absentUntil && p.absentUntil > room.serverTime) &&
      p.region !== 3,
  );
  const [target, setTarget] = useState(eligible[0]?.id ?? ""),
    [region, setRegion] = useState(0),
    [pos, setPos] = useState(0);
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        act({ type: "item-teleport", target, region, pos });
      }}
    >
      <h3>Milenko’s Hat · choose a destination</h3>
      <label>
        Player
        <CardSelect aria-label="Player" value={target} onChange={(e) => setTarget(e.target.value)}>
          {eligible.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </CardSelect>
      </label>
      <label>
        Region
        <CardSelect aria-label="Region"
          value={region}
          onChange={(e) => {
            setRegion(Number(e.target.value));
            setPos(0);
          }}
        >
          {[...REGIONS, "Shangri-La"].map((name, i) => (
            <option key={i} value={i}>
              {name}
            </option>
          ))}
        </CardSelect>
      </label>
      <label>
        Space
        <CardSelect aria-label="Space" value={pos} onChange={(e) => setPos(Number(e.target.value))}>
          {Array.from(
            { length: region === 3 ? 1 : [28, 20, 12][region] },
            (_, i) => (
              <option key={i} value={i}>
                {spaceName(region, i)}
              </option>
            ),
          )}
        </CardSelect>
      </label>
      <button className="primary" disabled={busy || !target}>
        Teleport player
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
    [deck, setDeck] = useState("0"),
    [winners, setWinners] = useState<string[]>([]);
  const chosen = room.players.find((x) => x.id === target) ?? p;
  return (
    <div className="ruling-panel">
      <h3>Resolve the printed effect</h3>
      <p>{room.ruling?.reason}</p>
      <p className="small">
        These are shared tabletop controls. Follow the card, agree on choices
        with the table, and record each adjustment. The game logs every action.
        Table dice are raw rolls; apply noncombat modifiers such as Random Bone
        Generator when interpreting them.
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
            winners: stat === "win" && winners.length ? winners : undefined,
          });
        }}
      >
        <label>
          Player
          <CardSelect aria-label="Player"
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
          </CardSelect>
        </label>
        <label>
          Apply effect
          <CardSelect aria-label="Apply effect"
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
          </CardSelect>
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
        {stat === "win" && (
          <fieldset>
            <legend>Winners (defaults to selected player)</legend>
            {room.players
              .filter((q) => !q.dead)
              .map((q) => (
                <label className="check" key={q.id}>
                  <input
                    type="checkbox"
                    checked={winners.includes(q.id)}
                    onChange={(e) =>
                      setWinners(
                        e.target.checked
                          ? [...winners, q.id]
                          : winners.filter((id) => id !== q.id),
                      )
                    }
                  />
                  {q.name}
                </label>
              ))}
          </fieldset>
        )}
        {["discard", "transfer", "retrieve"].includes(stat) && (
          <label>
            Card
            <CardSelect aria-label="Card"
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
            </CardSelect>
          </label>
        )}
        {stat === "transfer" && (
          <label>
            Give to
            <CardSelect aria-label="Give to"
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
            </CardSelect>
          </label>
        )}
        {stat === "move" && (
          <>
            <label>
              Region
              <CardSelect aria-label="Region"
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
              </CardSelect>
            </label>
            <label>
              Space
              <CardSelect aria-label="Space"
                value={pos}
                onChange={(e) => setPos(Number(e.target.value))}
              >
                {Array.from({ length: COUNTS[region] ?? 1 }, (_, i) => (
                  <option value={i} key={i}>
                    {spaceName(region, i)} · {i + 1}
                  </option>
                ))}
              </CardSelect>
            </label>
          </>
        )}
        {stat === "draw" && (
          <label>
            Deck
            <CardSelect aria-label="Deck" value={deck} onChange={(e) => setDeck(e.target.value)}>
              {REGIONS.map((r, i) => (
                <option key={r} value={i}>
                  {r}
                </option>
              ))}
              <option value="bone">Bones</option>
            </CardSelect>
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
          <CardSelect aria-label="Trade with"
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
          </CardSelect>
        </label>
        <label>
          Give Item
          <CardSelect aria-label="Give Item" value={give} onChange={(e) => setGive(e.target.value)}>
            <option value="">No Item</option>
            {p.items.map((id) => (
              <option key={id} value={id}>
                {cardName(id)}
              </option>
            ))}
          </CardSelect>
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
          <CardSelect aria-label="Request Item" value={ask} onChange={(e) => setAsk(e.target.value)}>
            <option value="">No Item</option>
            {q?.items.map((id) => (
              <option key={id} value={id}>
                {cardName(id)}
              </option>
            ))}
          </CardSelect>
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
  const [learning, setLearning] = useState(false);
  const [learned, setLearned] = useState(false);
  const quitDialog = useRef<HTMLDialogElement>(null);
  const endDialog = useRef<HTMLDialogElement>(null);
  const [endError, setEndError] = useState("");
  const [leaveError,setLeaveError]=useState("");
  const [rolling,setRolling]=useState(false);
  useEffect(() => {
    try { setLearned(localStorage.getItem("qsl_tutorial_complete") === "1"); } catch { /* Optional preference. */ }
    if (new URLSearchParams(window.location.search).get("tutorial") === "1") setLearning(true);
  }, []);
  const [room, setRoom] = useState<PublicRoom | null>(null),
    [code, setCode] = useState(""),
    [joinCode, setJoinCode] = useState(""),
    [name, setName] = useState(""),
    [character, setCharacter] = useState(CHARACTERS[0]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [connection, setConnection] = useState(""),
    [toast, setToast] = useState(""),
    [recent, setRecent] = useState<RecentTable[]>([]),
    [preferencesLoaded, setPreferencesLoaded] = useState(false),
    [offline, setOffline] = useState(false),
    [refreshKey, setRefreshKey] = useState(0),
    [inviteFallback, setInviteFallback] = useState(""),
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
      setRecent(parseRecentTables(localStorage.getItem("qsl_tables") ?? localStorage.getItem("qsl_recent")));
      setName(localStorage.getItem("qsl_name") ?? "");
      const savedCharacter = localStorage.getItem("qsl_character");
      if (savedCharacter && CHARACTERS.includes(savedCharacter)) setCharacter(savedCharacter);
    } catch {}
    setPreferencesLoaded(true);
    const connectionChanged = () => { setOffline(!navigator.onLine); if (navigator.onLine) setRefreshKey(k => k + 1); };
    connectionChanged();
    window.addEventListener("online", connectionChanged);
    window.addEventListener("offline", connectionChanged);
    return () => { window.removeEventListener("online", connectionChanged); window.removeEventListener("offline", connectionChanged); };
  }, []);
  useEffect(() => {
    if (!preferencesLoaded) return;
    try { localStorage.setItem("qsl_tables", JSON.stringify(recent)); localStorage.setItem("qsl_character", character); localStorage.setItem("qsl_name", name); } catch {}
  }, [recent, character, name, preferencesLoaded]);
  useEffect(() => {
    if (!room?.me) return;
    const seat = room.players.find(p => p.id === room.me);
    if (!seat) return;
    if(seat.left){setRecent(old=>old.filter(t=>t.code!==room.code));return;}
    if (CHARACTERS.includes(seat.character)) setCharacter(seat.character);
    setRecent(old => rememberTable(old, {code: room.code, character: seat.character, playerName: seat.name, status: room.status, round: room.round, players: room.players.length, lastSeen: Date.now()}));
  }, [room?.code, room?.rev, room?.me]);
  useEffect(() => {
    if (!code) return;
    let cancelled = false,
      running = false;
    const controller = new AbortController();
    async function load() {
      if (running || busyRef.current || document.hidden || !navigator.onLine) return;
      running = true;
      try {
        const next = await api("/api/rooms/" + code, undefined, controller.signal);
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
    document.addEventListener("visibilitychange", load);
    return () => {
      cancelled = true; controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, [code, update, refreshKey]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  function remember(c: string) {
    try { localStorage.setItem("qsl_name", name); } catch {}
    window.history.replaceState({}, "", gameInvite(c));
    setCode(c); setJoinCode(c);
  }
  function reopen(c: string) {
    setRoom(null); setError(""); setConnection(""); setToast(""); setInviteFallback("");
    remember(c); setRefreshKey(k => k + 1);
  }
  async function enter(join: boolean, practice=false) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const parsedCode = roomCodeFromInput(joinCode);
      if (join && !parsedCode)
        throw new Error("Enter a six-character room code or paste an invite link.");
      const next = await api(
        join ? "/api/rooms/" + parsedCode : "/api/rooms",
        { name: name.trim() || "Player", character, practice },
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
      setRolling(['roll','combat-choice','ruling-die'].includes(a.type));
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
        setBusy(false);setRolling(false);
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
      !!p &&
      room?.control === p.id &&
      p.id === active?.id &&
      room?.status === "playing" &&
      !room.legacy,
    host = me?.id === room?.host,
    choices = myTurn ? (room?.choices ?? []) : [],
    roster = characterRecord(character);
  const groups = [...new Set(room?.options?.map((o) => o.group) ?? [])];
  const inCombat =
    room?.combat &&
    p &&
    room.control === p.id &&
    [room.combat.attacker, room.combat.defender].includes(p.id);
  const canRule = room?.ruling && p && (room.ruling.actor === p.id || host);
  const canUse =
    !room?.pendingCard &&
    !room?.itemPrompt &&
    (myTurn || !!inCombat) &&
    !p?.absentUntil &&
    !me?.absentUntil &&
    !p?.respawn &&
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
    setInviteFallback("");
    window.history.replaceState({}, "", gameBasePath);
  }
  function move(region: number, pos: number) {
    const destination = choices.find(c => c.region === region && c.pos === pos);
    if (destination?.itemToll && !tollItem) { setError("Choose an Item to pay the Portal toll, then select your destination."); jumpToTableSection("table-controls"); return; }
    action({ type: "move", region, pos, item: tollItem || undefined });
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        gameInvite(room!.code),
      );
      setToast("Invite link copied.");
      setInviteFallback("");
    } catch {
      setToast("Select and copy this invite link, or share the room code.");
      setInviteFallback(gameInvite(room!.code));
    }
  }
  const guide = room ? tableGuidance(room) : null;
  useEffect(() => {
    document.title = room ? `${guide?.attention ? "Your move · " : ""}${room.code} · Shangri-La` : "Shangri-La Online · Official Beta";
    return () => { document.title = "Shangri-La Online · Official Beta"; };
  }, [room?.code, guide?.attention]);
  return (
    <main className={room ? "has-table" : ""}>
      <header className="topbar">
        <div className="wordmark">
          <span className="brand-mark">◇</span>
          <div>
            THE QUEST FOR <strong>SHANGRI-LA</strong>
          </div>
        </div>
        <span className="edition">OFFICIAL BETA</span>
        <div className="row">
          {room && (
            <button className="quiet quit-game-trigger" onClick={() => {setLeaveError('');quitDialog.current?.showModal();}} disabled={busy}>
              Quit game
            </button>
          )}
          {room && host && !room.legacy && room.status !== "finished" && <button className="quiet end-game-trigger" disabled={busy || offline} onClick={() => {setEndError("");endDialog.current?.showModal();}}>End game</button>}
          <button className="learn-trigger" onClick={() => setLearning(true)}>Learn to play</button>
          <button className="quiet" onClick={() => rules.current?.showModal()}>
            Rules & cards
          </button>
        </div>
      </header>
          {(connection || offline || (code && !room)) && (
            <div className={connection || offline ? "error connection-banner" : "connection-banner"} role="status">
              <span>{offline ? "You’re offline. Your table is saved." : connection || "Opening your saved table…"}</span>
              {code && <div><button className="quiet" disabled={offline || busy} onClick={() => setRefreshKey(k => k + 1)}>Reconnect</button><button className="quiet" disabled={busy} onClick={closeView}>Back to tables</button></div>}
            </div>
          )}
      {!room&&!code&&<StartGame name={name} setName={setName} character={character} setCharacter={setCharacter} code={joinCode} setCode={setJoinCode} busy={busy} offline={offline} onStart={(join,practice)=>void enter(join,practice)} onLearn={()=>setLearning(true)} savedGames={<SavedTables tables={recent} busy={busy||offline} onOpen={reopen} onForget={c=>setRecent(old=>old.filter(t=>t.code!==c))}/> }/>}
      {room?.status==='lobby'&&me&&<GameLobby code={room.code} players={room.players} me={me.id} host={room.host} busy={busy} offline={offline} onReady={()=>action({type:'ready'})} onStart={()=>action({type:'start'})} onPractice={()=>action({type:'start-practice'})} onInvite={copy}/>}
      {inviteFallback&&<label className="invite-fallback invite-global">Copy this invite link<input readOnly value={inviteFallback} onFocus={e=>e.currentTarget.select()}/><small>Or share room code {room?.code}.</small></label>}
      <div className="table-feedback" aria-label="Game messages">{error&&<div className="error" role="alert"><span>{error}</span><button className="quiet" onClick={()=>setError('')} aria-label="Dismiss error">×</button></div>}{toast&&<div className="toast" role="status">{toast}</div>}</div>
      <div className={"game-layout " + (room ? "playing" : "home-preview") + (room&&!me?' needs-seat':'')}>
        <section className="table" id="table-board" tabIndex={-1}>
          <div className="table-heading">
            <div>
              <span className="eyebrow">
                {room
                  ? `ROOM ${room.code} · ${room.status === "lobby" ? "WAITING FOR PLAYERS" : `ROUND ${room.round}`}`
                  : "GATHER YOUR HOMIES"}
              </span>
              <h1>
                {room?.pendingCard
                  ? `${room.players.find((p) => p.id === room.pendingCard!.player)?.name}’s card choice.`
                  : room?.legacy
                    ? "Saved prototype table"
                    : room?.status === "finished"
                      ? room.endedByHost ? "The game has ended." : "The quest is complete."
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
          {room && guide && room.status === "playing" && !room.legacy && <TableGuide guide={guide} phase={room.phase} stats={me} busy={busy} offline={offline} onAction={action} connection={offline ? "OFFLINE" : connection ? "RECONNECTING" : "LIVE TABLE · SAVED AUTOMATICALLY"} />}
          {room?.status==='playing'&&<TableActivity roomCode={room.code} moments={room.activity} rolling={rolling}/>}
          {me?.left&&<div className="game-ended-banner"><strong>You left this match.</strong><p>You can watch the remaining players, or start a new game.</p><button className="primary" onClick={closeView}>Back to play menu</button></div>}
          {room?.status === "finished" && room.endedByHost && <section className="game-ended-banner" role="status"><strong>The host ended this game.</strong><p>No winner was declared. The final board and history are saved; no further turns can be played.</p><button className="quiet" onClick={closeView}>Back to the main menu</button></section>}
          {!learned && <section className="learn-invitation"><div><span>NEW TO THE QUEST?</span><strong>Learn by playing one short turn.</strong><p>Try moving, drawing a card, and winning a fight. Your real table stays untouched.</p></div><button className="primary" onClick={() => setLearning(true)}>Try the tutorial →</button></section>}
          {room?.legacy && (
            <div className="notice">
              <strong>This saved table uses an earlier rules edition.</strong>
              <p>
                Its history is preserved. Create a new table to play with the
                latest rules and timing fixes.
              </p>
              <button className="primary" onClick={closeView}>
                Create a corrected table
              </button>
            </div>
          )}
          <Board
            key={room?.code ?? "preview"}
            players={room?.players}
            focus={myTurn ? p?.id : me?.id}
            dice={room?.lastDice}
            choices={choices}
            turnKey={`${room?.round}:${room?.turn}:${room?.phase}:${room?.rev}`}
            active={room?.status === "playing" ? active?.id : undefined}
            disabled={busy || offline}
            onMove={move}
            tollItems={p?.items.filter(id => !id.startsWith("ending-")).map(id => ({id, label: cardName(id)}))}
            tollItem={tollItem}
            onTollItemChange={setTollItem}
          />
          <div className="table-footer">
            <span>
              60 mapped spaces ·{" "}
              {room?.space?.name ?? "Explore every space"}
            </span>
            <span>{CHARACTERS.length} characters · 10 endings</span>
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
                          {q.left ? "Left the match" : q.dead
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
                    {q.absentUntil && (
                      <p className="notice">
                        King High Bone: returns in{" "}
                        {Math.max(
                          0,
                          Math.ceil((q.absentUntil - room.serverTime) / 1000),
                        )}{" "}
                        seconds.
                      </p>
                    )}
                    {q.controller !== q.id && (
                      <p className="notice">
                        Controlled by{" "}
                        {room.players.find((p) => p.id === q.controller)?.name}.
                      </p>
                    )}
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
        <aside className="sidebar" id="table-controls" tabIndex={-1}>
          {room && !me && !room.legacy && (
            <section className="panel join-panel">
              <span className="eyebrow">TAKE A SEAT</span>
              <h2>Join this table.</h2>
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
                  />
                </label>
                <button className="primary" disabled={busy||offline||room.status!=='lobby'}>{busy?'Joining…':'Join this game →'}</button>
                <details><summary>Optional · change character ({character})</summary>                <label>
                  Character
                  <CardSelect aria-label="Character"
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
                  </CardSelect>
                </label>
</details>
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

              </form>
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
              {room.status === "lobby" ? (
                <>
                  <details className="lobby-character"><summary>Change your character · {me.character}</summary><CardSelect aria-label="Your character" value={me.character} disabled={busy||offline} onChange={e=>action({type:'character',character:e.target.value})}>{CHARACTERS.map(c=><option key={c} disabled={room.players.some(p=>p.id!==me.id&&p.character===c)}>{c}</option>)}</CardSelect></details>
                  <p className="small">Use the lobby at the top to get ready and start the game.</p>
                </>
              ) : room.status === "finished" ? (
                <>
                  <h2>
                    {room.endedByHost ? "Game ended by the host" : room.endedBecause==='abandoned'?'Table closed':room.winners
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
                    {p && me && p.id !== me.id && !p.bot
                      ? "YOU CONTROL " + p.name.toUpperCase()
                      : p?.bot
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
                  {room.endingPending && (
                    <p className="notice">
                      Resolve Psychopathic Ring before this ending takes effect.
                    </p>
                  )}
                  {room.phase === "waiting" && (
                    <p className="notice">
                      All remaining players are temporarily absent. The table
                      resumes when a timer expires.
                    </p>
                  )}
                  {room.peek && (
                    <div className="private-peek">
                      <h3>Private Crystal Ball view</h3>
                      <CardView id={room.peek} />
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
                  {room.pendingCard && (
                    <div className="notice" role="status">
                      <h3>Card response</h3>
                      <p>{room.pendingCard.message}</p>
                      <p className="small">
                        Waiting for{" "}
                        {
                          room.players.find(
                            (x) => x.id === room.pendingCard!.player,
                          )?.name
                        }
                        . The result will take effect after all card choices are
                        resolved.
                      </p>
                    </div>
                  )}
                  {room.itemPrompt?.kind === "movement" && (
                    <div className="notice">
                      Choose one of the two movement dice below.
                    </div>
                  )}
                  {room.itemPrompt?.kind === "teleport" &&
                    p?.id === room.itemPrompt.player && (
                      <TeleportForm room={room} act={action} busy={busy || offline} />
                    )}
                  {room.encounter && <div className="encounter-reveal" key={room.encounter}><CardView id={room.encounter} /></div>}{" "}
                  {myTurn &&
                    room.phase === "move" &&
                    !room.pendingCard &&
                    !room.itemPrompt && (
                      <>
                        <p>Preview a destination on the board, check its rules and toll, then confirm your move.</p>
                        <button className="primary" onClick={() => jumpToTableSection("table-board")}>Choose on the board ↑</button>
                      </>
                    )}
                  {inCombat && p && !room.pendingCard && !room.itemPrompt && (
                    <CombatForm
                      key={JSON.stringify(room.combat?.choices)}
                      room={room}
                      p={p}
                      act={action}
                      busy={busy || offline}
                    />
                  )}{" "}
                  {canRule && p && !room.pendingCard && !room.itemPrompt && (
                    <TableControls
                      key={`${room.ruling?.reason}:${room.ruling?.actor}`}
                      room={room}
                      p={p}
                      act={action}
                      busy={busy || offline}
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
                      <div className="choice-grid">{room.options.filter(o=>o.group===group).map((o,i)=><ChoiceCard key={JSON.stringify(o.action)+i} option={o} disabled={busy||offline} onChoose={()=>action(o.action)}/>)}</div>
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
                        <button disabled={busy || offline} className="secondary">
                          Place wager
                        </button>
                      </form>
                    )}
                  {canUse && p && (
                    <>
                      <TradeForm room={room} p={p} act={action} busy={busy || offline} />
                      <button
                        className="quiet wide"
                        disabled={busy || offline}
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
            <section className="panel" id="table-character" tabIndex={-1}>
              <span className="eyebrow">
                {p.bot
                  ? "PRACTICE OPPONENT"
                  : p.id === me?.id
                    ? "YOUR CHARACTER"
                    : `${p.name.toUpperCase()} · YOU CONTROL THIS TURN`}
              </span>
              <h2>{p.character}</h2>
              <QuestProgress bonus={p.bonus} region={p.region} dead={p.dead} ending={room.ending?.name}/>
              {p.absentUntil && (
                <p className="notice" role="status">
                  King High Bone: you return in{" "}
                  {Math.max(
                    0,
                    Math.ceil((p.absentUntil - room.serverTime) / 1000),
                  )}{" "}
                  seconds. Participation resumes after the timer.
                </p>
              )}
              {p.casketRecovery && (
                <p className="notice">
                  Casket returns you to Knapp Cemetery with your possessions
                  next turn.
                </p>
              )}
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
                          disabled={busy || offline}
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
                Items · {p.items.length}/{p.capacity}
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
              {p.conditionDetails?.map((c) => (
                <p className="small" key={c.id}>
                  {c.name}
                  {c.turns !== null
                    ? ` · ${c.turns} future turn(s) remaining`
                    : ""}
                  {c.branch ? ` · ${c.branch}` : ""}
                </p>
              ))}
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
          {room && !room.legacy && (
            <RoomChat key={room.code} code={room.code} me={room.me} />
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
          <section className="panel edition-panel">
            <span className="eyebrow">ABOUT THIS EDITION</span>
            <p className="small">
              Reconstructed from the scanned rulebook and community component
              photographs. Rules are paraphrased. Common card effects resolve automatically. Cards marked “manual”
              still need a table ruling. The rulebook lists 110
              Detroit and 70 Dark Carnival cards; this recovered set contains
              101 and 69, with unresolved duplicates. This official beta is
              still being checked against the complete physical game.
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
      {room&&guide&&!room.legacy&&<TableDock guide={guide} busy={busy} offline={offline} reconnecting={!!connection} hasCards={!!p&&!room.legacy} onAction={action}/>}
      <LearnToPlay open={learning} onClose={() => setLearning(false)} onComplete={() => setLearned(true)} current={room && guide ? {...guide, phase: room.phase} : undefined}/>
      <dialog ref={endDialog} className="quit-dialog" aria-labelledby="end-game-title" onCancel={e => {if(busy)e.preventDefault();}}>
        <div className="modal">
          <span className="eyebrow">HOST CONTROL · EVERYONE AT THIS TABLE</span>
          <h2 id="end-game-title">End this game for everyone?</h2>
          <p>This finishes room <strong>{room?.code}</strong> immediately, including any pending turn or card choice. No winner will be declared.</p>
          <p className="quit-note">Everyone can still view the final board and history. This match cannot be resumed; you can start a new table.</p>
          {endError && <p className="error" role="alert">{endError}</p>}
          <div className="quit-actions"><button autoFocus className="quiet" disabled={busy} onClick={() => endDialog.current?.close()}>Keep playing</button><button className="danger-button" disabled={busy || offline || room?.status === "finished"} onClick={async () => {setEndError("");try {await act({type:"end-game",actor:me?.id});endDialog.current?.close();} catch(e) {setEndError((e as Error).message);}}}>{busy?"Ending game…":"End game for everyone"}</button></div>
        </div>
      </dialog>
      <dialog ref={quitDialog} className="quit-dialog" aria-labelledby="quit-title" onCancel={e=>{if(busy)e.preventDefault();}}>
        <div className="modal">
          <span className="eyebrow">LEAVE THE TABLE SCREEN</span>
          <h2 id="quit-title">How would you like to leave?</h2>
          <p><b>Save my seat</b> returns to the menu. Your progress stays saved, and the table may still need your turn.</p>
          {room?.status!=='finished'&&!me?.left&&<p><b>Leave permanently</b> forfeits your seat and passes play to the remaining players. If you’re the host, another player takes over. You cannot rejoin this match.</p>}
          {leaveError&&<p className="error" role="alert">{leaveError}</p>}
          <div className="exit-choices"><button className="secondary" disabled={busy} onClick={()=>{quitDialog.current?.close();closeView();}}>Save my seat · go to menu</button>{room?.status!=='finished'&&me&&!me.left&&<button className="danger-button" disabled={busy||offline} onClick={async()=>{setLeaveError('');try{await act({type:'leave-game',actor:me.id});setRecent(old=>old.filter(t=>t.code!==room!.code));quitDialog.current?.close();closeView();}catch(e){setLeaveError((e as Error).message);}}}>{busy?'Leaving…':'Leave permanently'}</button>}<button autoFocus className="quiet" disabled={busy} onClick={()=>quitDialog.current?.close()}>Keep playing</button></div>
        </div>
      </dialog>
      <dialog ref={rules} className="rules-dialog">
        <div className="modal">
          <div className="modal-head">
            <h2>Rules & card library</h2>
            <button className="quiet" onClick={() => rules.current?.close()}>
              Close
            </button>
          </div>
          <p className="notice">
            Official beta. Special card effects require players
            to apply the displayed rules using shared controls. Automatic rules
            do not cover every interaction.
          </p>
          <button className="primary wide" onClick={() => {rules.current?.close();setLearning(true);}}>Play the beginner tutorial →</button>
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
          <h3>What the game handles</h3>
          <p>
            Character starting stats and equipment, movement paths and tolls,
            ordinary combat, natural 1/10 results, weapon breakage, basic shops,
            trade consent, first-death replacement, Casket resurrection,
            Psychopathic Ring replacement before an ending resolves, nearby
            borrowed powers, Crystal Ball inspection, Bone conditions and the
            ten ending structures. Supported Item and Homie effects offer
            choices before rolls, Life loss and card draws. Use table controls
            for cards still marked for manual resolution.
          </p>
          <h3>Timing at this table</h3>
          <p>
            Timed Bones apply immediately and count future full turns of their
            holder. Skitsofrantic uses the next seat in the lobby order, even if
            turn direction reverses. King High Bone lasts ten real minutes,
            including time disconnected. Amputation limits capacity to three
            even with Backpack; Concussion clears on an unmodified movement
            total of six. Reroll choices go to the roller first, then follow
            lobby order; a replacement must be accepted. Card choices pause play
            until the controlling seat answers. Noosawaa’s beneficial immunity
            is applied automatically. These resolve details the source cards
            leave unclear; conflicting card effects still need a table ruling.
          </p>
          <h3>Source limitations</h3>
          <p>
            The recovered community inventory contains 101 Detroit, 90
            Nethervoid and 69 Dark Carnival cards, 13 Bones, and 40 Purchase
            Items. The printed rulebook lists 110 Detroit, 90 Nethervoid, 70
            Dark Carnival and 42 Purchase cards. A Detroit atlas repeats 19 card
            faces; three titles are unclear. The missing cards and copy counts
            remain unresolved. Board photography has glare and cropping. Card
            artwork is not reproduced here.
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
