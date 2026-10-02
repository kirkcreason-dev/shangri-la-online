import type { ReactNode } from 'react';

export function cardArtwork(c:{weapon?:boolean;use?:string;vehicle?:boolean;kind:string}) {
  return c.weapon?'weapon':c.use==='armor'?'armor':c.use==='drink'?'drink':c.use==='herb'?'herb':c.vehicle?'vehicle':c.kind;
}

// Printed, code-native artwork stays sharp on small cards and a zoomed board.
export function GameArtwork({kind='power',className=''}:{kind?:string;className?:string}) {
  let art:ReactNode;
  switch(kind){
    case 'roll': art=<>
      <g transform="translate(37 25) rotate(-14 32 36)"><path d="M5 8 60 2 69 15 67 67 55 78 0 70Z" fill="#b19362"/><rect x="0" y="2" width="60" height="64" rx="9" fill="#f9e7b5"/><g fill="#392b39" stroke="none">{[[15,17],[44,17],[30,34],[15,50],[44,50]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="5"/>)}</g><path d="M8 7H40M6 18V44" fill="none" stroke="#fff5da" strokeWidth="3"/></g>
      <g transform="translate(100 36) rotate(13 32 32)"><path d="M0 5 54 0 65 12 64 63 54 73 0 64Z" fill="#9b7157"/><rect width="56" height="62" rx="8" fill="#eaa35d"/><g fill="#392b39" stroke="none">{[[14,16],[41,46],[27,31]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="5"/>)}</g></g>
      <path d="m27 83-11 9m29 5-9 15m132-52 14-4m-15-12 8-11" fill="none" stroke="#fff0bd"/>
    </>;break;
    case 'character': case 'homie': art=<>
      {[[-40,8,'#b29ac3'],[40,8,'#96ab73'],[0,-2,'#efca85']].map(([x,y,color],i)=><g key={i} transform={`translate(${x} ${y})`}><path d="M67 107q4-36 33-36t33 36l-8 8H75Z" fill={String(color)}/><path d="M77 29q23-23 46 0v23q-2 27-23 27T77 52Z" fill={String(color)}/><path d="m82 41 14 5-9 13-7-6m38-12-14 5 9 13 7-6" fill="#342637"/><path d="m89 66 11-6 11 6-11 5Z" fill="#342637"/><path d="m85 21 6-12 9 9 9-9 6 12" fill="#aa545c"/></g>)}
    </>;break;
    case 'fiend': case 'bone': art=<>
      <path d="m64 75-20 25m8-34-17 28m105-19 20 25m-8-34 17 28" stroke="#ead3a2" strokeWidth="11"/>
      <path d="M73 33 51 9 58 43m69-10 22-24-7 34" fill="#d79964"/><path d="M65 33q35-28 70 0l6 30-13 24v20l-56 1V88L59 63Z" fill="#eed7a8"/><path d="m69 49 24 7-9 20-16-9m63-18-24 7 9 20 16-9M100 68l-8 15h16Z" fill="#342638"/><path d="M78 96h44m-34-7v17m12-17v17m12-17v17" fill="none"/>
    </>;break;
    case 'drink': art=<><path d="M85 14h30v19l5 8q18 12 18 30v38q-2 11-38 11t-38-11V71q0-18 18-30l5-8Z" fill="#ac7066"/><path d="M81 11h38v13H81Z" fill="#e6c491"/><path d="M67 65h66v37H67Z" fill="#e4c994"/><path d="m100 69 5 10 12 2-9 8 2 12-10-6-10 6 2-12-9-8 12-2Z" fill="#956192"/><path d="M76 55q3-8 12-13m-13 67h15" fill="none" stroke="#e3a98e" strokeWidth="5"/></>;break;
    case 'herb': art=<><path d="M99 113V47m0 40L67 64m32 5 33-29m-32 60 29-21" fill="none" stroke="#c5d08e" strokeWidth="6"/><path d="M96 65Q62 70 48 32q43-4 48 33Zm8 5q-2-44 41-52 0 42-41 52ZM95 99Q52 101 45 68q43-1 50 31Zm10 8q0-36 44-43-4 37-44 43Z" fill="#91ab78"/><path d="m61 42 24 17m52-28-24 30M57 78l29 15m51-16-24 20" fill="none" stroke="#c3ce8b" strokeWidth="2"/><path d="m83 107 34-1-4 13H86Z" fill="#b89367"/></>;break;
    case 'vehicle': art=<><g transform="rotate(-16 100 70)"><path d="M35 75q-14-3-17-18l30 6h105l28-10q-1 22-25 28H47Z" fill="#bc735f"/><path d="M49 72h99" stroke="#e5c99c" strokeWidth="3"/><path d="M56 82v10m87-10v10"/><circle cx="56" cy="98" r="12" fill="#bfb298"/><circle cx="143" cy="98" r="12" fill="#bfb298"/><circle cx="56" cy="98" r="4" fill="#3d2d3b"/><circle cx="143" cy="98" r="4" fill="#3d2d3b"/><path d="m99 35 6 11 13 2-10 9-9-5-9 5-10-9 13-2Z" fill="#dfc691"/></g></>;break;
    case 'cash': art=<>
      <path d="m82 39-14-23 17 4 15-10 13 10 16-4-12 26q32 21 31 53-10 28-49 23-42 5-50-23-1-33 33-53Z" fill="#aaba76"/><path d="m80 39 39 2-3 9-34-3Z" fill="#edd196"/><path d="M113 61q-24-13-26 3-2 11 21 16 18 14-8 18l-13-5m13-37v49" fill="none" strokeWidth="5"/>
      {[30,50,153,170].map((x,i)=><g key={x}><ellipse cx={x} cy={105-i%2*9} rx="13" ry="7" fill="#a97746"/><ellipse cx={x} cy={100-i%2*9} rx="13" ry="7" fill="#efcb7e"/></g>)}
    </>;break;
    case 'health': art=<><path d="M100 109 51 70Q26 35 58 21q22-9 42 17 20-26 42-17 32 14 7 49Z" fill="#c95157"/><path d="m46 47 12-16 17-2m51 65 19-23" stroke="#f18e72" fill="none" strokeWidth="7"/><path d="m72 80 44-50 17 15-44 50Z" fill="#f3d7a2"/><path d="m84 72 12 10m-4-20 12 10m-4-20 12 10" stroke="#ab845e" strokeWidth="2"/></>;break;
    case 'weapon': art=<>
      <g transform="rotate(-35 100 70)"><path d="M95 22h11v91H95Z" fill="#ad7551"/><path d="M83 16q-26 7-29 37l39-3v-8h20v8l33 3q-4-33-29-37l-8 11H94Z" fill="#d0ccbe"/><path d="m60 45 20-19m53 19-17-19" stroke="#fbebbf"/></g>
      <g transform="rotate(35 100 70)"><path d="M95 22h11v91H95Z" fill="#c19463"/><path d="M83 16q-26 7-29 37l39-3v-8h20v8l33 3q-4-33-29-37l-8 11H94Z" fill="#d0ccbe"/></g>
    </>;break;
    case 'armor': art=<><path d="m100 10 50 22-7 51-43 37-43-37-7-51Z" fill="#9c6875"/><path d="m100 22 36 17-6 39-30 27-30-27-6-39Z" fill="#eed293"/><path d="m100 34 7 22 24 1-18 14 5 23-18-13-18 13 5-23-18-14 24-1Z" fill="#a5515c"/></>;break;
    case 'tutorial': art=<><path d="M31 25q39-17 69 3 30-20 69-3l-4 82q-40-13-65 5-25-18-65-5Z" fill="#ab7458"/><path d="M36 16q39-8 64 15v72q-30-22-61-10Zm128 0q-39-8-64 15v72q30-22 61-10Z" fill="#f0d5a1"/><path d="m50 39 32 9m-31 9 30 9m-28 9 27 9m35-31 14-17 15 20-16 18Z" fill="none" stroke="#9a6951" strokeWidth="3"/><path d="M101 27v73" stroke="#c39765"/><path d="m140 91 18-48 22-26-5 38-33 47m9-29 22-37" fill="#cda864"/></>;break;
    case 'move': case 'location': art=<><path d="m39 112 12-90 99 9 13 79-64-8Z" fill="#d8bc85"/><path d="m74 30-7 61m62-48 7 53" fill="none" stroke="#a98968" strokeWidth="2"/><path d="M60 84q67 18 40-26-18-26 32-7" fill="none" stroke="#87556a" strokeDasharray="4 5"/><path d="m83 19 38 5-22 30-18-7Z" fill="#c6585a"/><path d="m82 19-7 49"/><path d="m127 48 15 13m0-16-15 19" stroke="#b14d4f" strokeWidth="5"/></>;break;
    case 'end': art=<><path d="M58 112V52q0-49 42-43 42-6 42 43v60Z" fill="#967168"/><path d="M72 110V50q0-31 28-29 28-2 28 29v60Z" fill="#382b43"/><path d="m79 110 11-23h20l11 23m-36-9h31m-24-10h17" fill="#c9a273"/><path d="m100 31 4 16 17 4-17 4-4 17-4-17-17-4 17-4Z" fill="#f1d28a"/><path d="M60 56h12m-12 24h12m56-24h13m-13 24h13M93 10l2 12m17-11-5 11" fill="none" strokeWidth="2"/></>;break;
    case 'item': art=<><path d="M65 32q0-17 35-17t35 17v21l12 14-4 46H57l-4-46 12-14Z" fill="#b88b5e"/><path d="M68 42h64v28H68Z" fill="#dbc38b"/><path d="M58 78h31v27H58m84-27h-31v27h31M86 20v17m28-17v17" fill="#98724e"/><path d="m92 50 8-4 8 4v10l-8 5-8-5Z" fill="#463342"/><circle cx="100" cy="86" r="8" fill="#e6c27d"/></>;break;
    case 'carnival': art=<><path d="M100 9v20m0-20 30 8-30 8" fill="#bb525c"/><path d="M26 67 100 27l74 40-12 9-14-6-12 9-13-7-23 9-23-9-13 7-12-9-14 6Z" fill="#e3bd79"/><path d="m100 28-36 44 13-1 23-41 23 41 13 1-36-44m-9 4L38 73l14-3Z" fill="#ad4d5a" strokeWidth="2"/><path d="M39 77v40h122V77l-15-3-12 8-11-8-23 9-23-9-11 8-12-8Z" fill="#b76563"/><path d="M85 116V95q15-23 30 0v21Z" fill="#302638"/><path d="M47 87v22m22-24v26m64-26v26m20-24v22" stroke="#e4c38e" strokeWidth="8"/><path d="M16 17q84 39 168 0" fill="none" stroke="#d9bd8d" strokeWidth="2"/>{[29,55,81,107,133,159].map((x,i)=><path key={x} d={`m${x} ${24+Math.sin(i/5*Math.PI)*9} 8 15 9-13Z`} fill={i%2?'#b75765':'#cbab69'} strokeWidth="2"/>)}</>;break;
    default: art=<><g transform="rotate(-9 100 65)"><path d="M60 12h80v107H60Z" fill="#ba785e"/><path d="M67 20h66v91H67Z" fill="#dec48c"/><path d="M74 66q26-37 52 0-26 29-52 0Z" fill="#f0dcb5"/><circle cx="100" cy="65" r="11" fill="#879c72"/><circle cx="100" cy="65" r="5" fill="#34283c"/><path d="m109 24-21 25h16l-12 20 26-28h-15Z" fill="#df9a59"/><path d="M79 97h43" stroke="#9e7459" strokeWidth="2"/></g></>;
  }
  return <svg className={`game-artwork ${className}`} viewBox="0 0 200 130" aria-hidden="true" focusable="false"><g fill="#d9b578" opacity=".18">{Array.from({length:14},(_,i)=><path key={i} d="M96 65 87 0h26L104 65Z" transform={`rotate(${i*360/14} 100 65)`}/>)}</g><g fill="#edd09a" opacity=".75">{[[25,27],[175,96],[29,105],[161,20]].map(([x,y],i)=><path key={i} d={`m${x} ${y-6} 2 4 5 2-5 2-2 5-2-5-5-2 5-2Z`}/>)}</g><ellipse cx="100" cy="117" rx="68" ry="7" fill="#160f20" opacity=".5"/><g stroke="#2b2132" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round">{art}</g><g fill="#281d2d" opacity=".12">{Array.from({length:20},(_,i)=><circle key={i} cx={30+i*43%144} cy={20+i*29%91} r={i%3===0?1.3:.65}/>)}</g></svg>;
}

export function StatToken({kind,value,label}:{kind:'health'|'combat'|'cash';value:ReactNode;label:string}) {
  return <span className={`stat-token token-${kind}`} title={label} aria-label={`${label}: ${value}`}><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">{kind==='health'?<path d="M12 21 3 12C-3 4 7-2 12 5 17-2 27 4 21 12Z"/>:kind==='combat'?<path d="m5 2 15 17-3 3L2 5Zm13 0 4 4L7 20l-3-3ZM1 16l7 7m8-7 7 7"/>:<><circle cx="12" cy="12" r="10"/><path d="M15 7H9v5h6v5H9m3-13v16" fill="none" stroke="#403029" strokeWidth="2"/></>}</svg><b>{value}</b><small>{kind==='health'?'LIFE':kind==='combat'?'BASE CB':'CASH'}</small></span>;
}
