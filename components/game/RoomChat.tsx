"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { gameFetch } from "@/lib/client-connection";
import type { ChatMessage } from "@/lib/online/chat";
type ChatResponse = { messages: ChatMessage[]; error?: string };
export function RoomChat({ code, me }: { code: string; me: string | null }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]),
    [draft, setDraft] = useState(""),
    [sending, setSending] = useState(false),
    [problem, setProblem] = useState(""),
    [connectionProblem, setConnectionProblem] = useState(""),
    [connected, setConnected] = useState(false);
  const list = useRef<HTMLDivElement>(null),
    retry = useRef<{ id: string; text: string } | null>(null),
    posting = useRef(false),
    firstScroll = useRef(true),
    version = useRef(0);
  const merge = useCallback(
    (incoming: ChatMessage[]) =>
      setMessages((old) => {
        const merged = new Map(old.map((m) => [m.id, m]));
        for (const m of incoming) merged.set(m.id, m);
        return [...merged.values()]
          .sort((a, b) => a.sentAt - b.sentAt || a.id.localeCompare(b.id))
          .slice(-100);
      }),
    [],
  );
  useEffect(() => {
    if (!me) return;
    let stopped = false,
      running = false;
    const controller = new AbortController();
    async function refresh() {
      if (running || document.hidden) return;
      running = true;
      try {
        const r = await gameFetch(`/api/rooms/${code}/chat`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = (await r.json()) as ChatResponse;
        if (!r.ok) throw Error(data.error ?? "Chat is reconnecting.");
        if (!stopped) {
          merge(data.messages);
          setConnected(true);
          setConnectionProblem("");
        }
      } catch (e) {
        if (!stopped) {
          setConnected(false);
          if ((e as Error).name !== "AbortError")
            setConnectionProblem((e as Error).message);
        }
      } finally {
        running = false;
      }
    }
    void refresh();
    const timer = setInterval(refresh, 2000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      stopped = true;
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [code, me, merge]);
  useEffect(() => {
    const node = list.current;
    if (
      node &&
      (firstScroll.current ||
        node.scrollHeight - node.scrollTop - node.clientHeight < 200 ||
        messages.at(-1)?.senderId === me)
    )
      node.scrollTop = node.scrollHeight;
    if (messages.length) firstScroll.current = false;
  }, [messages, me]);
  async function send() {
    const text = draft.trim();
    if (!text || posting.current) return;
    posting.current = true;
    setSending(true);
    setProblem("");
    const stamp = version.current;
    const input =
      retry.current?.text === text
        ? retry.current
        : { id: crypto.randomUUID(), text };
    retry.current = input;
    try {
      const r = await gameFetch(`/api/rooms/${code}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = (await r.json()) as ChatResponse;
      if (!r.ok) throw Error(data.error ?? "Message not sent. Please retry.");
      merge(data.messages);
      retry.current = null;
      if (stamp === version.current) setDraft("");
      setConnected(true);
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      posting.current = false;
      setSending(false);
    }
  }
  return (
    <section className="panel room-chat" aria-label="Room chat">
      <div className="row">
        <h3>Room chat</h3>
        {me && (
          <span className="small">
            {connected ? "Connected" : "Connecting…"}
          </span>
        )}
      </div>
      {!me ? (
        <p className="small">Join this table to read and send messages.</p>
      ) : (
        <>
          <div
            ref={list}
            className="chat-messages"
            role="log"
            aria-live="polite"
            aria-relevant="additions text"
            aria-label="Messages"
          >
            {messages.length === 0 ? (
              <p className="small">
                Say hello to your table. Messages are saved here.
              </p>
            ) : (
              messages.map((m) => (
                <article
                  className={"chat-message" + (m.senderId === me ? " own" : "")}
                  key={m.id}
                >
                  <div>
                    <strong>
                      {m.senderName}
                      {m.senderId === me ? " · you" : ""}
                    </strong>
                    <time dateTime={new Date(m.sentAt).toISOString()}>
                      {new Date(m.sentAt).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>
                  <p>{m.text}</p>
                </article>
              ))
            )}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <label htmlFor={"chat-" + code}>Message your table</label>
            <textarea
              id={"chat-" + code}
              value={draft}
              maxLength={500}
              rows={3}
              onChange={(e) => {
                version.current++;
                setDraft(e.target.value);
              }}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Write a message…"
            />
            <div className="row chat-send">
              <span className="small">
                {draft.length}/500 · Shift+Enter for a new line
              </span>
              <button className="primary" disabled={sending || !draft.trim()}>
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
            {(problem || connectionProblem) && (
              <p className="error" role="status">
                {problem || connectionProblem}
              </p>
            )}
          </form>
        </>
      )}
    </section>
  );
}
