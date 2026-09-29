"use client";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { gameAsset } from "@/lib/client-connection";
import board from "@/lib/board.json";
import { GATES, REGIONS } from "@/lib/game";
import { OVERVIEW, cameraCorners, facingRotation, fitCamera, nearestAngle, panCamera, zoomCamera, type Camera, type Point } from "@/lib/board-camera";
export { REGIONS } from "@/lib/game";
export function spaceName(r: number, p: number) {
  return r === 3 ? "Shangri-La" : (board.regions[r]?.[p] ?? "Unknown space");
}
function position(region: number, pos: number): Point {
  const space = board.spaces[region]?.[pos];
  return space ? { x: space.column * 100 + 50, y: space.row * 100 + 50 } : { x: 400, y: 450 };
}
type Piece = { id: string; name: string; character?: string; region: number; pos: number; color: string; dead?: boolean; absentUntil?: number };
type Gesture = { points: Map<number, Point>; start: Point; camera: Camera; distance?: number; angle?: number; moved: boolean; spin: boolean };
export default function Board({ players = [], choices = [], onMove, active, focus, disabled = false, dice = [] }: {
  players?: Piece[];
  choices?: { region: number; pos: number }[];
  onMove?: (r: number, p: number) => void;
  active?: string;
  focus?: string;
  disabled?: boolean;
  dice?: number[];
}) {
  const [camera, setCamera] = useState<Camera>(OVERVIEW);
  const [mode, setMode] = useState<"me" | "turn" | "free">("me");
  const [dragging, setDragging] = useState(false);
  const [hover, setHover] = useState<{ name: string; region: string } | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const cameraRef = useRef(camera);
  const gesture = useRef<Gesture | null>(null);
  const suppressClick = useRef(false);
  cameraRef.current = camera;
  const visiblePlayers = players.filter(p => !p.dead && !p.absentUntil);
  const own = visiblePlayers.find(p => p.id === focus);
  const current = visiblePlayers.find(p => p.id === active);
  const target = mode === "turn" ? current ?? own : own ?? current;
  const tracked = mode !== "free" ? target : undefined;
  const choiceKey = choices.map(c => `${c.region}:${c.pos}`).join(",");
  const targetId = tracked?.id, targetRegion = tracked?.region, targetPos = tracked?.pos;
  useEffect(() => {
    if (mode === "free" || targetRegion === undefined || targetPos === undefined) return;
    const at = position(targetRegion, targetPos);
    const destinations = choiceKey ? choiceKey.split(",").map(key => {
      const [r, p] = key.split(":").map(Number); return position(r, p);
    }) : [];
    setCamera(previous => fitCamera([at, ...destinations], facingRotation(at, previous.rotation)));
  }, [targetId, targetRegion, targetPos, choiceKey, mode]);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      // Ordinary scrolling still moves the page; trackpad pinching zooms the board.
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault(); setMode("free");
      setCamera(c => zoomCamera(c, Math.exp(-event.deltaY * 0.008)));
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, []);
  function resetFollow(next: "me" | "turn") {
    setMode(next);
    const p = next === "me" ? own ?? current : current ?? own;
    if (p) setCamera(c => fitCamera([position(p.region, p.pos), ...choices.map(p => position(p.region, p.pos))], facingRotation(position(p.region, p.pos), c.rotation)));
  }
  function overview() { setMode("free"); setCamera(c => ({ ...OVERVIEW, rotation: nearestAngle(0, c.rotation) })); }
  function spin(degrees: number) { setMode("free"); setCamera(c => ({ ...c, rotation: c.rotation + degrees })); }
  function zoom(factor: number) { setMode("free"); setCamera(c => zoomCamera(c, factor)); }
  function startGesture(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const point = { x: event.clientX, y: event.clientY };
    if (!gesture.current) {
      suppressClick.current = false;
      gesture.current = { points: new Map(), start: point, camera: cameraRef.current, moved: false, spin: event.shiftKey };
    }
    const g = gesture.current;
    g.points.set(event.pointerId, point);
    if (g.points.size === 2) {
      const [a, b] = [...g.points.values()];
      g.camera = cameraRef.current;
      g.distance = Math.hypot(b.x - a.x, b.y - a.y);
      g.angle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
      g.moved = true; suppressClick.current = true;
      setDragging(true); setMode("free");
    }
  }
  function moveGesture(event: ReactPointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    if (!g || !g.points.has(event.pointerId)) return;
    const point = { x: event.clientX, y: event.clientY };
    g.points.set(event.pointerId, point);
    const dx = point.x - g.start.x, dy = point.y - g.start.y;
    if (!g.moved && Math.hypot(dx, dy) < 6) return;
    g.moved = true; suppressClick.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true); setHover(null); setMode("free");
    if (g.points.size >= 2 && g.distance && g.angle !== undefined) {
      const [a, b] = [...g.points.values()];
      const angle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
      const next = zoomCamera(g.camera, Math.hypot(b.x - a.x, b.y - a.y) / g.distance);
      setCamera({ ...next, rotation: g.camera.rotation + nearestAngle(angle, g.angle) - g.angle });
    } else if (g.spin) setCamera({ ...g.camera, rotation: g.camera.rotation + dx * 0.45 });
    else {
      const ratio = 800 / event.currentTarget.getBoundingClientRect().width;
      setCamera(panCamera(g.camera, dx * ratio, dy * ratio));
    }
  }
  function endGesture(event: ReactPointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    if (!g) return;
    g.points.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (g.points.size) {
      g.start = [...g.points.values()][0]; g.camera = cameraRef.current;
      g.distance = undefined; g.angle = undefined;
    } else { gesture.current = null; setDragging(false); }
  }
  const location = tracked ?? own ?? current;
  const caption = hover ?? (location ? { name: spaceName(location.region, location.pos), region: location.region === 3 ? "The final destination" : REGIONS[location.region] } : null);
  return (
    <div className="board-wrap interactive-board">
      <div className="board-camera-toolbar" aria-label="Board camera controls">
        <div className="board-view-modes">
          <button type="button" aria-pressed={mode === "me" && !!own} disabled={!own} onClick={() => resetFollow("me")}>◎ Follow me</button>
          <button type="button" aria-pressed={mode === "turn"} disabled={!current} onClick={() => resetFollow("turn")}>Follow turn</button>
          <button type="button" onClick={overview}>Full board</button>
        </div>
        <div className="board-lens-controls">
          <button type="button" aria-label="Rotate board left" title="Rotate left" onClick={() => spin(-90)}>↶</button>
          <button type="button" aria-label="Rotate board right" title="Rotate right" onClick={() => spin(90)}>↷</button>
          <span className="camera-divider" />
          <button type="button" aria-label="Zoom out" disabled={camera.zoom <= .65} onClick={() => zoom(1 / 1.25)}>−</button>
          <output aria-label="Board zoom">{Math.round(camera.zoom * 100)}%</output>
          <button type="button" aria-label="Zoom in" disabled={camera.zoom >= 3} onClick={() => zoom(1.25)}>+</button>
        </div>
      </div>
      <div className={"photo-board board-viewport" + (dragging ? " is-dragging" : "")}
        ref={viewport} tabIndex={0} role="region" aria-label="Interactive game board. Drag to pan. Shift-drag to rotate. Use arrow keys to pan, plus and minus to zoom, and Home to follow your piece."
        onPointerDown={startGesture} onPointerMove={moveGesture} onPointerUp={endGesture} onPointerCancel={endGesture}
        onPointerLeave={e => { setHover(null); if (!e.currentTarget.hasPointerCapture(e.pointerId)) endGesture(e); }}
        onClickCapture={e => { if (suppressClick.current && e.detail !== 0) { e.preventDefault(); e.stopPropagation(); } }}
        onKeyDown={e => {
          if (e.target !== e.currentTarget) return;
          const arrows: Record<string, [number, number]> = { ArrowLeft: [80, 0], ArrowRight: [-80, 0], ArrowUp: [0, 80], ArrowDown: [0, -80] };
          if (arrows[e.key]) { e.preventDefault(); setMode("free"); setCamera(c => panCamera(c, ...arrows[e.key])); }
          else if (["+", "=", "-", "Home", "[", "]"].includes(e.key)) {
            e.preventDefault();
            if (e.key === "Home") resetFollow("me");
            else if (e.key === "[") spin(-90);
            else if (e.key === "]") spin(90);
            else zoom(e.key === "-" ? 1 / 1.25 : 1.25);
          }
        }}>
        <svg className="board-scene" viewBox="0 0 800 800" aria-label="Game board; highlighted spaces are legal destinations">
          <g className="board-camera" data-camera-x={camera.x.toFixed(1)} data-camera-y={camera.y.toFixed(1)} data-camera-rotation={camera.rotation.toFixed(1)} style={{ transform: `translate(400px, 400px) scale(${camera.zoom}) rotate(${camera.rotation}deg) translate(${-camera.x}px, ${-camera.y}px)` }}>
            <image href={gameAsset("board-reference.jpg")} width="800" height="800" preserveAspectRatio="xMidYMid slice" pointerEvents="none" aria-label="The Quest for Shangri-La original board reference photograph" />
            {board.spaces.map((spaces, r) => spaces.map(s => {
              const selected = choices.some(c => c.region === r && c.pos === s.index);
              const here = location?.region === r && location?.pos === s.index;
              return <g key={`${r}:${s.index}`}>
                <rect x={s.column * 100 + 4} y={s.row * 100 + 4} width="92" height="92" rx="6"
                  className={`board-space${selected ? " legal" : ""}${here ? " occupied" : ""}`}
                  role={selected ? "button" : undefined} tabIndex={selected && !disabled ? 0 : undefined}
                  aria-disabled={selected ? disabled : undefined}
                  aria-label={selected ? `Move to ${s.name}, ${REGIONS[r]} ${s.index + 1}` : `${s.name} · ${REGIONS[r]} ${s.index + 1}`}
                  onPointerEnter={() => { if (!gesture.current?.moved) setHover({ name: s.name, region: REGIONS[r] }); }}
                  onFocus={() => setHover({ name: s.name, region: REGIONS[r] })} onBlur={() => setHover(null)}
                  onClick={() => selected && !disabled && onMove?.(r, s.index)}
                  onKeyDown={e => { if (selected && !disabled && ["Enter", " "].includes(e.key)) { e.preventDefault(); onMove?.(r, s.index); } }} />
                {s.index === GATES[r] && <g pointerEvents="none" transform={`translate(${s.column * 100 + 82} ${s.row * 100 + 18})`}><circle r="12" fill="#16131c" stroke="#e7c375" strokeWidth="2"/><text y="6" fill="#ffe0a2" fontSize="18" textAnchor="middle">◇</text></g>}
                {selected && <circle className="destination-spark" cx={s.column * 100 + 18} cy={s.row * 100 + 18} r="7" pointerEvents="none" />}
              </g>;
            }))}
            <rect x="307" y="307" width="186" height="186" rx="12" className={choices.some(c => c.region === 3) ? "board-space legal center-patch" : "center-patch"}
              onClick={() => !disabled && choices.some(c => c.region === 3) && onMove?.(3, 0)}
              role={choices.some(c => c.region === 3) ? "button" : undefined}
              tabIndex={choices.some(c => c.region === 3) && !disabled ? 0 : undefined} aria-label="Enter Shangri-La"
              onKeyDown={e => { if (!disabled && choices.some(c => c.region === 3) && ["Enter", " "].includes(e.key)) { e.preventDefault(); onMove?.(3, 0); } }} />
            <g className="board-upright" style={{ transform: `translate(400px, 400px) rotate(${-camera.rotation}deg)` }} pointerEvents="none">
              <text x="0" y="-35" className="center-small" style={{ fontSize: 13 }}>THE QUEST FOR</text>
              <text x="0" y="1" className="center-title" style={{ fontSize: 32 }}>Shangri-La</text>
              <text x="0" y="30" className="center-small" style={{ fontSize: 12 }}>COMBAT BONUS 15+</text>
            </g>
            {visiblePlayers.map(p => {
              const q = position(p.region, p.pos), same = visiblePlayers.filter(o => o.region === p.region && o.pos === p.pos), i = same.findIndex(o => o.id === p.id);
              return <g key={p.id} className="board-pawn" style={{ transform: `translate(${q.x + (i - (same.length - 1) / 2) * 27}px, ${q.y + 2}px)` }} pointerEvents="none">
                {(p.id === location?.id || p.id === active) && <circle key={`${p.region}:${p.pos}`} className="pawn-arrival" r="32" fill="none" stroke={p.color} strokeWidth="3" />}
                {p.id === active && <circle className="pawn-turn-ring" r="29" fill="none" stroke="white" strokeWidth="2" strokeDasharray="7 5" />}
                <circle className="pawn-shadow" r={p.id === focus ? 25 : 21} fill={p.color} stroke={p.id === focus ? "white" : "#17121f"} strokeWidth="4" />
                <g className="board-upright" style={{ transform: `rotate(${-camera.rotation}deg)` }}>
                  <text y="7" className="pawn-letter" style={{ fontSize: 20 }}>{p.name[0]?.toUpperCase()}</text>
                  {p.id === focus && <><rect x="-23" y="30" width="46" height="19" rx="7" fill="#15111ded"/><text y="43" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#fff">YOU</text></>}
                </g>
              </g>;
            })}
          </g>
        </svg>
        {choices.length > 0 && <div className="board-move-prompt" role="status"><span className="live-dot"/>Choose a glowing space <b>{choices.length}</b></div>}
        {dice.length > 0 && <div className="board-last-roll" aria-label={`Last roll: ${dice.join(", ")}`}><span>LAST ROLL</span><div>{dice.map((value, i) => <b key={`${i}:${value}`} className="board-die">{value}</b>)}</div></div>}
      </div>
      <div className="board-statusbar">
        <div className="board-location" aria-live="polite">
          <span className="board-location-kicker">{hover ? "EXPLORE THE BOARD" : tracked ? `${tracked.id === focus ? "YOUR PIECE" : tracked.name.toUpperCase()} · FOLLOWING` : "FREE LOOK"}</span>
          <strong>{caption?.name ?? "The world awaits."}</strong>
          <span>{caption?.region ?? "Drag, zoom, and spin to explore."}</span>
        </div>
        <button type="button" className="board-minimap" aria-label="Show full board" title="Show full board" onPointerDown={e => { suppressClick.current = false; e.stopPropagation(); }} onClick={overview}>
          <svg viewBox="0 0 800 800" aria-hidden="true">
            <rect x="10" y="10" width="780" height="780" rx="25" fill="#15131d"/>
            {[0, 1, 2].map(r => <rect key={r} x={20 + r * 100} y={20 + r * 100} width={760 - r * 200} height={760 - r * 200} rx="12" fill="none" stroke={["#df7280", "#a994ee", "#e7c375"][r]} strokeWidth="12" opacity=".7"/>)}
            <polygon points={cameraCorners(camera).map(p => `${p.x},${p.y}`).join(" ")} fill="#fff1" stroke="#fff8" strokeWidth="8"/>
            {visiblePlayers.map(p => { const q = position(p.region, p.pos); return <circle key={p.id} cx={q.x} cy={q.y} r={p.id === focus ? 30 : 23} fill={p.color} stroke={p.id === focus ? "white" : "#14111c"} strokeWidth="9"/>; })}
          </svg><span>FULL BOARD</span>
        </button>
      </div>
      <div className="board-camera-hint"><span>Drag to explore · Shift-drag to spin</span><span>Pinch to zoom & rotate</span></div>
      <div className="board-legend"><span><i className="red"/>Detroit</span><span><i className="violet"/>Nethervoid</span><span><i className="gold"/>Dark Carnival</span></div>
    </div>
  );
}
