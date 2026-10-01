import { gameAsset } from '@/lib/client-connection';
import { BOARD_SPACES, REGION_INKS, labelLines } from '@/lib/board-display';

// The reference artwork stays in its mapped position. Geometry, type, frame,
// and the center are rendered separately so zooming does not blur the controls.
export function BoardArtwork({ id, rotation, labels, original }: { id: string; rotation: number; labels: boolean; original: boolean }) {
  return <g pointerEvents="none" aria-hidden="true">
    <defs>
      <image id={`${id}-art`} href={gameAsset('board-reference.jpg')} width="800" height="800" preserveAspectRatio="none" />
      <radialGradient id={`${id}-sky`}><stop stopColor="#443869"/><stop offset=".55" stopColor="#211a3f"/><stop offset="1" stopColor="#100e21"/></radialGradient>
      <linearGradient id={`${id}-gold`} x2="1" y2="1"><stop stopColor="#f4dfa9"/><stop offset=".5" stopColor="#956c35"/><stop offset="1" stopColor="#f7dca2"/></linearGradient>
      {BOARD_SPACES.map(s => <clipPath id={`${id}-tile-${s.region}-${s.pos}`} key={`${s.region}:${s.pos}`}><rect x={s.column*100+3} y={s.row*100+3} width="94" height="94" rx="3"/></clipPath>)}
      <clipPath id={`${id}-center`}><rect x="304" y="304" width="192" height="192" rx="5"/></clipPath>
    </defs>
    {original ? <use href={`#${id}-art`}/> : <>
      <rect x="-4" y="-4" width="808" height="808" rx="8" fill="#08090e" stroke={`url(#${id}-gold)`} strokeWidth="5"/>
      {BOARD_SPACES.map(s => <g key={`${s.region}:${s.pos}`}>
        <rect x={s.column*100+1} y={s.row*100+1} width="98" height="98" rx="3" fill="#17131c" stroke={REGION_INKS[s.region]} strokeOpacity=".45" strokeWidth="1"/>
        <use href={`#${id}-art`} clipPath={`url(#${id}-tile-${s.region}-${s.pos})`}/>
        <rect x={s.column*100+3} y={s.row*100+3} width="94" height="94" rx="3" fill="#0c0912" opacity=".12"/>
      </g>)}
      <rect x="101" y="101" width="598" height="598" rx="5" fill="none" stroke="#371c22" strokeWidth="8"/>
      <rect x="101" y="101" width="598" height="598" rx="5" fill="none" stroke="#bc514d" strokeWidth="3"/>
      <rect x="201" y="201" width="398" height="398" rx="5" fill="none" stroke="#201b24" strokeWidth="8"/>
      <rect x="201" y="201" width="398" height="398" rx="5" fill="none" stroke="#ddccb0" strokeWidth="4" strokeDasharray="3 3 10 3"/>
      <g clipPath={`url(#${id}-center)`}>
        <rect x="304" y="304" width="192" height="192" fill={`url(#${id}-sky)`}/>
        {Array.from({length: 34}, (_,i) => <circle key={i} cx={310+(i*47)%181} cy={310+(i*71)%175} r={i%5===0?1.2:.6} fill="#fff2c9" opacity={.25+(i%4)*.15}/>)}
        <circle cx="400" cy="384" r="64" fill="none" stroke="#d4b276" strokeOpacity=".2" strokeWidth=".6"/>
        <path d="M400 307 489 400 400 491 311 400Z M400 320 476 400 400 479 324 400Z" fill="none" stroke="#b7986c" strokeOpacity=".4" strokeWidth="1"/>
        <path d="M299 464 340 421 361 444 385 411 420 451 451 410 502 465V505H299Z" fill="#343054"/>
        <path d="M290 491 347 452 386 475 413 438 456 478 504 459V509H290Z" fill="#121123"/>
        <path d="M382 500 394 451 398 405H402L407 453 428 500" fill="#d6b873" opacity=".16"/>
      </g>
      <rect x="303" y="303" width="194" height="194" rx="5" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="2"/>
    </>}
    {!original && labels && BOARD_SPACES.map(s => {
      const lines=labelLines(s.name);
      return <g key={`${s.region}:${s.pos}`} className="board-upright board-tile-label" style={{transform:`translate(${s.column*100+50}px, ${s.row*100+50}px) rotate(${-rotation}deg)`}}>
        <rect x="-44" y={28-lines.length*11} width="88" height={lines.length*11+7} rx="3" fill="#100e17" fillOpacity=".92" stroke={REGION_INKS[s.region]} strokeOpacity=".45" strokeWidth=".65"/>
        {lines.map((line,i)=><text key={i} x="0" y={38-lines.length*11+i*11} textAnchor="middle" fill="#fff2dc" fontSize="10" fontWeight="400" fontFamily="Bangers, Impact, sans-serif">{line}</text>)}
      </g>;
    })}
    {!original && <g className="board-upright" style={{transform:`translate(400px,400px) rotate(${-rotation}deg)`}}>
      <text y="-38" textAnchor="middle" fill="#cdb180" fontSize="7" letterSpacing="2.1">THE QUEST FOR</text>
      <text y="-4" textAnchor="middle" fill="#ffedb8" fontSize="26" fontFamily="Bangers, Impact, sans-serif">Shangri-La</text>
      <path d="M-55 11H-10M10 11H55M0 7 4 11 0 15-4 11Z" fill="none" stroke="#c8a469" strokeWidth=".7"/>
      <text y="33" textAnchor="middle" fill="#d6c2a0" fontSize="7" letterSpacing="1.4">BEYOND THE DARK CARNIVAL</text>
      <text y="48" textAnchor="middle" fill="#f0dbab" fontSize="8">15+ BASE COMBAT BONUS</text>
    </g>}
  </g>;
}
