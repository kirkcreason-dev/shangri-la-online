"use client";
import type { ReactNode } from 'react';
import type { RecentTable } from '@/lib/table-preferences';
import { gameAsset } from '@/lib/client-connection';
import { CHARACTERS } from '@/lib/rules/catalog';
import { GameArtwork } from './GameArtwork';
import { CardSelect, ChoiceFace } from './ChoiceCards';
export function StartGame({name,setName,character,setCharacter,code,setCode,busy,offline,onStart,onLearn,savedGames}:{name:string;setName:(s:string)=>void;character:string;setCharacter:(s:string)=>void;code:string;setCode:(s:string)=>void;busy:boolean;offline:boolean;onStart:(join:boolean,practice?:boolean)=>void;onLearn:()=>void;savedGames?:ReactNode}){
  return <section className="start-game" aria-label="Start playing">
    <div className="intro-brand"><img src={gameAsset('creasonorse-logo.png')} alt="CREASO·NORSE" width={444} height={90}/><span>PRESENTS</span></div><div className="start-heading"><div><span className="eyebrow">THE QUEST STARTS HERE</span><h1>Pick a way to play.</h1><p>Build your strength, gather your crew, and reach Shangri-La.</p></div><GameArtwork kind="carnival" className="intro-carnival"/></div>
    {savedGames}<div className="start-identity"><label>Your name <input value={name} onChange={e=>setName(e.target.value)} maxLength={24} placeholder="Player" autoComplete="nickname"/></label><details className="start-character"><summary><span>YOUR CHARACTER</span><strong>{character}</strong><small>Change character ▾</small></summary><CardSelect aria-label="Character" value={character} onChange={e=>setCharacter(e.target.value)}>{CHARACTERS.map(c=><option key={c}>{c}</option>)}</CardSelect></details></div>
    <div className="start-modes">
      <button className="choice-card start-now" disabled={busy||offline} onClick={()=>onStart(false,true)}><ChoiceFace label="Play now" value="roll"/><span className="start-description">Start instantly with a practice opponent. No invite needed.</span><span className="choice-foot">{busy?'Opening game…':'Start playing →'}</span></button>
      <button className="choice-card" disabled={busy||offline} onClick={()=>onStart(false)}><ChoiceFace label="Host online game"/><span className="start-description">Open a table, invite your friends, then start together.</span><span className="choice-foot">Create your room →</span></button>
      <button className="choice-card" onClick={onLearn}><ChoiceFace label="Learn by playing" value="roll"/><span className="start-description">Try a two-minute guided turn. Learn the controls as you go.</span><span className="choice-foot">Start tutorial →</span></button>
    </div>
    <form className="start-join" onSubmit={e=>{e.preventDefault();onStart(true);}}><label htmlFor="start-room-code">Joining friends?</label><input id="start-room-code" value={code} onChange={e=>setCode(e.target.value)} placeholder="Paste an invite or enter a room code" autoCapitalize="characters" maxLength={2048} required/><button className="primary" disabled={busy||offline||!code.trim()}>Join a game →</button></form>
  </section>;
}
type Seat={id:string;name:string;character:string;ready:boolean;bot?:boolean};
export function GameLobby({code,players,me,host,busy,offline,onReady,onStart,onPractice,onInvite}:{code:string;players:Seat[];me:string;host:string;busy:boolean;offline:boolean;onReady:()=>void;onStart:()=>void;onPractice:()=>void;onInvite:()=>void}){
  const own=players.find(p=>p.id===me),isHost=me===host,waiting=players.filter(p=>!p.ready),ready=players.length>=2&&!waiting.length;
  return <section className="game-lobby" aria-label="Game lobby">
    <div><span className="eyebrow">ROOM {code} · {isHost?'YOU ARE THE HOST':'JOINED SUCCESSFULLY'}</span><h1>{ready?'Everyone is ready.':players.length<2?'Your table is ready for friends.':!own?.ready?'You’re in. Ready to play?':'Waiting for your friends.'}</h1><p>{isHost?(players.length<2?'Copy the invite and send it to a friend, or start with a practice opponent.':waiting.length?`${waiting.map(p=>p.name).join(', ')} ${waiting.length===1?'needs':'need'} to press “I’m ready”.`:'Press Start game below. The game rolls to choose who goes first.'):!own?.ready?'Press “I’m ready” below. The host starts once everyone is ready.':`You’re ready. ${players.find(p=>p.id===host)?.name} will start the game.`}</p></div>
    <ol className="lobby-steps"><li className="done"><b>1</b>Join the table</li><li className={waiting.length?'current':'done'}><b>2</b>Everyone ready</li><li className={ready?'current':''}><b>3</b>Host starts</li></ol>
    <div className="lobby-seats">{players.map(p=><div key={p.id} className={p.ready?'ready':''}><span>{p.ready?'✓':'○'}</span><div><strong>{p.name}{p.id===me?' · you':''}{p.id===host?' · host':''}</strong><small>{p.character}</small></div><b>{p.ready?'Ready':'Not ready'}</b></div>)}</div>
    <div className="lobby-actions">{!own?.ready&&<button className="primary" disabled={busy||offline} onClick={onReady}>I’m ready →</button>}{isHost&&<button className="primary" disabled={busy||offline||!ready} onClick={onStart}>Start game →</button>}{isHost&&players.length===1&&<button className="primary" disabled={busy||offline} onClick={onPractice}>Start with practice opponent →</button>}<button className="secondary" onClick={onInvite}>Copy invite link</button>{own?.ready&&<button className="quiet" disabled={busy||offline} onClick={onReady}>Not ready yet</button>}</div>
  </section>;
}

export function SavedTables({tables,busy,onOpen,onForget}:{tables:RecentTable[];busy:boolean;onOpen:(code:string)=>void;onForget:(code:string)=>void}) {
  const resume=tables.find(t=>t.status!=='finished');
  const title=(t:RecentTable)=>t.status==='finished'?'View final table':t.status==='lobby'?'Return to lobby':t.status==='playing'?`Resume round ${t.round??1}`:'Reopen saved table';
  if(!tables.length)return null;
  return <section className="saved-games" aria-label="Saved games">
    {resume&&<div className="resume-banner"><div><span>CONTINUE YOUR QUEST · {resume.code}</span><strong>{resume.character??'Your saved table'}</strong><small>{resume.playerName?`${resume.playerName} · `:''}{resume.players?`${resume.players} ${resume.players===1?'player':'players'} · `:''}Your seat is saved on this browser.</small></div><button className="primary" disabled={busy} onClick={()=>onOpen(resume.code)}>{title(resume)} →</button></div>}
    <details><summary>{resume?'All saved tables':'Finished tables'} ({tables.length})</summary><div className="recent-tables">{tables.map(t=><div className="recent-table" key={t.code}><button className="recent-table-open" disabled={busy} onClick={()=>onOpen(t.code)}><strong>{t.code}<span>{title(t)}</span></strong><span>{t.character??'Saved seat'}{t.players?` · ${t.players} players`:''}</span></button><button className="quiet forget-table" aria-label={`Forget table ${t.code}`} title="Remove from this device’s list" onClick={()=>onForget(t.code)}>×</button></div>)}</div><p>Use the same browser to return to your saved seat.</p></details>
  </section>;
}
