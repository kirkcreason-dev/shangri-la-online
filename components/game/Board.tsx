"use client";
import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { CardSelect, ChoiceFace } from './ChoiceCards';
import { BoardArtwork } from "./BoardArtwork";
import { BOARD_SPACES, REGION_INKS, boardPosition as position, spaceInfo, sameSpace, searchSpaces, destinationCost, destinationContext, confirmedDestination, type BoardAddress, type BoardDestination } from "@/lib/board-display";
import board from "@/lib/board.json";
import { GATES, REGIONS } from "@/lib/game";
import { OVERVIEW, cameraCorners, facingRotation, fitCamera, nearestAngle, panCamera, zoomCamera, type Camera, type Point } from "@/lib/board-camera";
export { REGIONS } from "@/lib/game";
export function spaceName(r: number, p: number) {
  return r === 3 ? "Shangri-La" : (board.regions[r]?.[p] ?? "Unknown space");
}
type Piece = { id: string; name: string; character?: string; region: number; pos: number; color: string; dead?: boolean; absentUntil?: number };
type Gesture = { points: Map<number, Point>; start: Point; camera: Camera; distance?: number; angle?: number; moved: boolean; spin: boolean };
export default function Board({ players = [], choices = [], onMove, active, focus, disabled = false, dice = [], turnKey = "", tollItems = [], tollItem = "", onTollItemChange }: {
  players?: Piece[];
  choices?: BoardDestination[];
  turnKey?: string;
  tollItems?: {id: string; label: string}[];
  tollItem?: string;
  onTollItemChange?: (id: string) => void;
  onMove?: (r: number, p: number) => void;
  active?: string;
  focus?: string;
  disabled?: boolean;
  dice?: number[];
}) {
  const id = useId().replaceAll(":", "");
  const details = useRef<HTMLElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [original, setOriginal] = useState(false);
  const [labels, setLabels] = useState(true);
  const [search, setSearch] = useState("");
  const [selection, setSelection] = useState<{at: BoardAddress; context: string} | null>(null);
  useEffect(() => {
    if(selection) details.current?.scrollIntoView({block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
  }, [selection]);
  const [tabStop, setTabStop] = useState("0:0");
  const context = destinationContext(turnKey, choices);
  const destination = confirmedDestination(selection, context, choices);
  useEffect(() => {
    try { const v = JSON.parse(localStorage.getItem("qsl_board_view") ?? "{}"); setOriginal(v.original === true); setLabels(v.labels !== false); } catch { /* Defaults remain usable. */ }
  }, []);
  function saveView(photo: boolean, names: boolean) {
    setOriginal(photo); setLabels(names);
    try { localStorage.setItem("qsl_board_view", JSON.stringify({original: photo, labels: names})); } catch { /* Optional preference. */ }
  }
  useEffect(() => {
    if (!expanded) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    shell.current?.querySelector<HTMLElement>("button")?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setExpanded(false); }
      if (event.key !== "Tab") return;
      const elements = [...(shell.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, [tabindex="0"]') ?? [])].filter(e => e.getClientRects().length);
      const first = elements[0], last = elements.at(-1);
      if (event.shiftKey && (document.activeElement === first || !shell.current?.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", key);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", key); previous?.focus(); };
  }, [expanded]);
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
  const inspected = spaceInfo(selection?.at ?? (location ? {region: location.region, pos: location.pos} : {region: 0, pos: 0}));
  const occupants = visiblePlayers.filter(p => sameSpace(p, inspected));
  const results = searchSpaces(search);
  function inspect(at: BoardAddress, frame = false) {
    setSelection({at, context}); setTabStop(`${at.region}:${at.pos}`);
    if (frame) { setMode("free"); const point = position(at.region, at.pos); setCamera(c => fitCamera([point], facingRotation(point, c.rotation))); }
    setSearch("");
  }
  function regionView(region: number) {
    setMode("free"); setSelection(null);
    setCamera(c => fitCamera(board.spaces[region].map(s => position(region, s.index)), nearestAngle(0, c.rotation)));
  }
  function tileKey(event: React.KeyboardEvent<SVGRectElement>, at: BoardAddress) {
    if (["Enter", " "].includes(event.key)) { event.preventDefault(); inspect(at); return; }
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) || at.region === 3) return;
    event.preventDefault();
    const count = board.spaces[at.region].length;
    const pos = (at.pos + (["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1) + count) % count;
    setTabStop(`${at.region}:${pos}`);
    setMode("free"); setCamera(c => fitCamera([position(at.region, pos)], facingRotation(position(at.region, pos), c.rotation)));
    shell.current?.querySelector<SVGRectElement>(`[data-space="${at.region}:${pos}"]`)?.focus();
  }
  function confirmMove() {
    const next = confirmedDestination(selection, context, choices);
    if (next && !disabled && (!next.itemToll || tollItems.some(item => item.id === tollItem))) { onMove?.(next.region, next.pos); setSelection(null); setMode("me"); }
  }
  return (
    <div ref={shell} className={`board-wrap interactive-board rebuilt-board${expanded ? " board-expanded" : ""}`} role={expanded ? "dialog" : undefined} aria-modal={expanded || undefined} aria-label={expanded ? "Expanded game board" : undefined}>
      <div className="board-edition-toolbar">
        <div className="board-edition-title"><span>THE WORLD OF SHANGRI-LA</span><strong>{original ? "Original board" : "The living board"}</strong></div>
        <div className="board-display-options">
          <button type="button" aria-pressed={!original} onClick={() => saveView(false, labels)}>Enhanced</button>
          <button type="button" aria-pressed={original} onClick={() => saveView(true, labels)}>Original</button>
          <button type="button" disabled={original} aria-pressed={labels && !original} onClick={() => saveView(original, !labels)}>Aa <span>Labels</span></button>
          <button type="button" className="expand-board" onClick={() => setExpanded(!expanded)}>{expanded ? "✕ Close" : "⛶ Expand"}</button>
        </div>
      </div>
      <div className="board-explorer">
        <div className="board-region-tabs" aria-label="Explore a region">{REGIONS.map((name,r) => <button type="button" key={name} style={{color:REGION_INKS[r]}} onClick={() => regionView(r)}><i style={{background:REGION_INKS[r]}}/>{name}</button>)}</div>
        <div className="board-search"><label className="sr-only" htmlFor={`${id}-search`}>Find a board space</label><input id={`${id}-search`} placeholder="Find a space…" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => {if(e.key === "Escape") {e.stopPropagation();setSearch("");}}}/>
          {search.trim() && <div className="board-search-results" aria-label="Matching spaces">{results.length ? results.map(s => <button type="button" key={`${s.region}:${s.pos}`} onClick={() => inspect(s, true)}><strong>{s.name}</strong><span>{REGIONS[s.region]} · {s.pos+1}</span></button>) : <p>No matching spaces.</p>}</div>}
        </div>
      </div>
      <div className="board-camera-toolbar" aria-label="Board camera controls">
        <div className="board-view-modes">
          <button type="button" aria-pressed={mode === "me" && !!own} disabled={!own} onClick={() => {setSelection(null);resetFollow("me");}}>◎ Follow me</button>
          <button type="button" aria-pressed={mode === "turn"} disabled={!current} onClick={() => {setSelection(null);resetFollow("turn");}}>Follow turn</button>
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
      <div className="board-workspace">
      <div className="board-stage">
      <div className={"photo-board board-viewport" + (dragging ? " is-dragging" : "")}
        ref={viewport} tabIndex={0} role="region" aria-label="Interactive game board. Select a space to read it. Drag to pan. Shift-drag to rotate. Use arrow keys to pan, plus and minus to zoom, and Home to follow your piece."
        onPointerDown={startGesture} onPointerMove={moveGesture} onPointerUp={endGesture} onPointerCancel={endGesture}
        onPointerLeave={e => { setHover(null); if (!e.currentTarget.hasPointerCapture(e.pointerId)) endGesture(e); }}
        onClickCapture={e => { if (suppressClick.current && e.detail !== 0) { e.preventDefault(); e.stopPropagation(); } }}
        onKeyDown={e => {
          if (e.target !== e.currentTarget) return;
          const arrows: Record<string, [number, number]> = { ArrowLeft: [80, 0], ArrowRight: [-80, 0], ArrowUp: [0, 80], ArrowDown: [0, -80] };
          if (arrows[e.key]) { e.preventDefault(); setMode("free"); setCamera(c => panCamera(c, ...arrows[e.key])); }
          else if (["+", "=", "-", "Home", "[", "]"].includes(e.key)) {
            e.preventDefault();
            if (e.key === "Home") { if(own) resetFollow("me"); else overview(); }
            else if (e.key === "[") spin(-90);
            else if (e.key === "]") spin(90);
            else zoom(e.key === "-" ? 1 / 1.25 : 1.25);
          }
        }}>
        <svg className="board-scene" viewBox="0 0 800 800" aria-label="Game board; highlighted spaces are legal destinations">
          <g className="board-camera" data-camera-x={camera.x.toFixed(1)} data-camera-y={camera.y.toFixed(1)} data-camera-rotation={camera.rotation.toFixed(1)} style={{ transform: `translate(400px, 400px) scale(${camera.zoom}) rotate(${camera.rotation}deg) translate(${-camera.x}px, ${-camera.y}px)` }}>
            <BoardArtwork id={id} rotation={camera.rotation} labels={labels} original={original}/>
            {BOARD_SPACES.map(s => {
              const legal = choices.some(c => sameSpace(c,s));
              const selected = sameSpace(selection?.at,s);
              return <g key={`${s.region}:${s.pos}`}>
                <rect x={s.column*100+4} y={s.row*100+4} width="92" height="92" rx="4"
                  data-space={`${s.region}:${s.pos}`} className={`board-space inspectable${legal ? " legal" : ""}${selected ? " inspected" : ""}`}
                  role="button" tabIndex={tabStop === `${s.region}:${s.pos}` || (!tabStop.startsWith(`${s.region}:`) && s.pos === 0) ? 0 : -1} aria-pressed={selected}
                  aria-label={`Inspect ${s.name}, ${REGIONS[s.region]} ${s.pos+1}${legal ? ", available destination" : ""}`}
                  onPointerEnter={() => { if(!gesture.current?.moved) setHover({name:s.name,region:REGIONS[s.region]}); }}
                  onFocus={() => setHover({name:s.name,region:REGIONS[s.region]})} onBlur={() => setHover(null)}
                  onClick={() => inspect(s)} onKeyDown={e => tileKey(e,s)}/>
                {s.pos === GATES[s.region] && <g pointerEvents="none" className="board-upright" style={{transform:`translate(${s.column*100+82}px, ${s.row*100+17}px) rotate(${-camera.rotation}deg)`}}><circle r="10" fill="#20171e" stroke="#f2d095" strokeWidth="1.3"/><text y="4" fill="#ffe0a2" fontSize="13" textAnchor="middle">◇</text></g>}
                {legal && <circle className="destination-spark" cx={s.column*100+15} cy={s.row*100+15} r="5" pointerEvents="none"/>}
              </g>;
            })}
            <rect x="306" y="306" width="188" height="188" rx="5" data-space="3:0" className={`board-space inspectable${choices.some(c=>c.region===3)?" legal":""}${selection?.at.region===3?" inspected":""}`}
              role="button" tabIndex={0} aria-label="Inspect Shangri-La" aria-pressed={selection?.at.region===3} onClick={() => inspect({region:3,pos:0})} onKeyDown={e => tileKey(e,{region:3,pos:0})}/>
            {visiblePlayers.map(p => {
              const q=position(p.region,p.pos), same=visiblePlayers.filter(o=>sameSpace(o,p)), i=same.findIndex(o=>o.id===p.id);
              const offset = (i-(same.length-1)/2)*19;
              return <g key={p.id} className="board-pawn" style={{transform:`translate(${q.x}px, ${q.y}px)`}} pointerEvents="none">
                <g className="board-upright" style={{transform:`rotate(${-camera.rotation}deg)`}}>
                  <g transform={`translate(${offset} -12)`}>
                    {p.id===active && <circle className="pawn-turn-ring" r="22" fill="none" stroke="#fff3ce" strokeWidth="1.5" strokeDasharray="4 4"/>}
                    <circle className="pawn-shadow" r={p.id===focus?18:15} fill="#151222" stroke={p.color} strokeWidth="3"/>
                    <circle r="11" fill={p.color}/><text y="4" textAnchor="middle" fill="#16121b" fontSize="12" fontWeight="800">{p.name[0]?.toUpperCase()}</text>
                    {p.id===focus && <><rect x="-13" y="14" width="26" height="10" rx="3" fill="#fff2cf"/><text y="21.5" textAnchor="middle" fontSize="6" fontWeight="bold" fill="#21182c">YOU</text></>}
                    <circle key={`${p.region}:${p.pos}`} className="pawn-arrival" r="25" fill="none" stroke={p.color} strokeWidth="2"/>
                  </g>
                </g>
              </g>;
            })}
          </g>
        </svg>
        {choices.length > 0 && <div className="board-move-prompt" role="status"><span className="live-dot"/>Preview a destination <b>{choices.length}</b></div>}
        {dice.length > 0 && <div className="board-last-roll" aria-label={`Last roll: ${dice.join(", ")}`}><span>LAST ROLL</span><div>{dice.map((value,i)=><b key={`${i}:${value}`} className="board-die">{value}</b>)}</div></div>}
      </div>
      <div className="board-camera-hint"><span>{hover ? `${hover.name} · ${hover.region}` : "Tap a space to read its rules"}</span><span>Drag · Shift-drag to spin · Pinch to zoom</span></div>
      </div>
      <aside ref={details} className="board-detail" aria-label="Space details">
        <div className="board-detail-heading"><span className="eyebrow">{destination ? "DESTINATION PREVIEW" : selection ? "EXPLORING" : location ? "CURRENT SPACE" : "EXPLORE THE BOARD"}</span><button type="button" className="quiet" onClick={() => {setSelection(null);overview();}}>↗ Overview</button></div>
        <div className="board-detail-title"><div><span style={{color:REGION_INKS[inspected?.region ?? 0] ?? "#efd18b"}}>{inspected?.region===3 ? "The final destination" : `${REGIONS[inspected?.region ?? 0]} · Space ${(inspected?.pos ?? 0)+1}`}</span><h3>{inspected?.name}</h3></div>
        <svg className="board-detail-map" viewBox="0 0 800 800" aria-label="Board overview">
          <rect width="800" height="800" rx="30" fill="#15121d"/>
          {[0,1,2].map(r=><rect key={r} x={20+r*100} y={20+r*100} width={760-r*200} height={760-r*200} rx="10" fill="none" stroke={REGION_INKS[r]} strokeWidth="10" opacity=".7"/>)}
          <polygon points={cameraCorners(camera).map(p=>`${p.x},${p.y}`).join(' ')} fill="#fff1" stroke="#fff6" strokeWidth="6"/>
          {inspected && <circle cx={position(inspected.region,inspected.pos).x} cy={position(inspected.region,inspected.pos).y} r="27" fill="#fff0ca"/>}
          {visiblePlayers.map(p=><circle key={p.id} cx={position(p.region,p.pos).x} cy={position(p.region,p.pos).y} r="20" fill={p.color} stroke="#14111c" strokeWidth="6"/>)}
        </svg></div>
        <p className="board-space-rules">{inspected?.rules}</p>
        {occupants.length>0 && <div className="board-occupants">{occupants.map(p=><span key={p.id}><i style={{background:p.color}}/>{p.name}{p.id===focus?" (you)":""}<small>{p.character}</small></span>)}</div>}
        {destination ? <div className="board-confirm"><p>{destinationCost(destination)}</p>{destination.itemToll && <label className="board-toll-label">Choose an Item to pay at the Portal<CardSelect value={tollItem} onChange={e=>onTollItemChange?.(e.target.value)}><option value="">Select the Item to discard</option>{tollItems.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</CardSelect></label>}<button type="button" className="primary" disabled={disabled || (destination.itemToll && !tollItems.some(item=>item.id===tollItem))} onClick={confirmMove}>Move to {inspected?.name} →</button><span>Only this button moves your piece.</span></div> : selection && choices.length>0 ? <p className="board-not-destination">This space is not an available destination for this roll.</p> : null}
        {choices.length>0 && <div className="board-destinations" id="available-destinations" tabIndex={-1}><span>YOUR AVAILABLE DESTINATIONS</span><div>{choices.map(c=><button type="button" className="choice-card destination-card" aria-label={spaceName(c.region,c.pos)} key={`${c.region}:${c.pos}`} aria-pressed={sameSpace(selection?.at,c) && !!destination} onClick={()=>inspect(c,true)}><ChoiceFace label={spaceName(c.region,c.pos)}/><span className="choice-foot">{c.toll?`$${c.toll} toll`:c.itemToll?"1 Item toll":"Preview destination →"}</span></button>)}</div></div>}
        <p className="board-preserved">Same 60-space layout · Original tile artwork<br/>Names and controls stay readable as the board turns.</p>
      </aside>
      </div>
    </div>
  );
}
