"use client";
import { useRef, useState, type ReactNode, type RefObject } from 'react';
import { CARDS } from '@/lib/rules/catalog';
import { filterCards } from '@/lib/card-browser';
import { GameArtwork } from './GameArtwork';
import { ChoiceFace } from './ChoiceCards';
import { CardView } from './GameCard';

export function FieldGuide({dialogRef,children,onLearn}:{dialogRef:RefObject<HTMLDialogElement|null>;children:ReactNode;onLearn:()=>void}) {
  const [section,setSection]=useState('play'),[query,setQuery]=useState(''),[kind,setKind]=useState('all'),[deck,setDeck]=useState('all'),[limit,setLimit]=useState(24),[selected,setSelected]=useState<string|null>(null);
  const results=filterCards(CARDS,query,kind,deck), title=useRef<HTMLHeadingElement>(null),scroll=useRef<HTMLDivElement>(null);
  const selectedIndex=results.findIndex(c=>c.key===selected);
  function changeSection(value:string){setSection(value);setSelected(null);scroll.current?.scrollTo({top:0});}
  function inspect(key:string){setSelected(key);scroll.current?.scrollTo({top:0});title.current?.focus();}
  return <dialog ref={dialogRef} className="field-guide" aria-labelledby="field-guide-title"><div className="field-shell">
    <header className="field-header"><GameArtwork kind="tutorial"/><div><span>KEEP THIS BESIDE YOUR BOARD</span><h2 id="field-guide-title" tabIndex={-1} ref={title}>The field guide</h2></div><button className="quiet" aria-label="Close field guide" onClick={()=>dialogRef.current?.close()}>✕</button></header>
    <nav className="field-tabs" aria-label="Field guide sections"><button aria-pressed={section==='play'} onClick={()=>changeSection('play')}>How to play</button><button aria-pressed={section==='cards'} onClick={()=>changeSection('cards')}>Find a card</button></nav>
    <div className="field-body" ref={scroll}>{section==='play'?<>
      <div className="guide-goal"><GameArtwork kind="end"/><div><span>YOUR GOAL</span><strong>Grow stronger. Reach the center.</strong><p>Build <b>15 base Combat Bonus</b>, cross the Bridge, then complete the revealed ending.</p></div></div>
      <button className="primary wide" onClick={onLearn}>Learn with a two-minute practice turn →</button>
      <div className="field-turns">{[['roll','Roll'],['move','Move'],['power','Encounter'],['end','End turn']].map(([art,label],i)=><div key={art}><GameArtwork kind={art}/><b>{i+1}. {label}</b></div>)}</div>
      <div className="field-rules">{children}</div>
    </>:selected&&selectedIndex>=0?<div className="library-inspection">
      <button className="secondary" onClick={()=>{setSelected(null);title.current?.focus();}}>← Back to {results.length} results</button>
      <CardView id={selected}/>
      <div className="library-pagination"><button className="quiet" disabled={selectedIndex===0} onClick={()=>inspect(results[selectedIndex-1].key)}>← Previous card</button><span>{selectedIndex+1} / {results.length}</span><button className="quiet" disabled={selectedIndex===results.length-1} onClick={()=>inspect(results[selectedIndex+1].key)}>Next card →</button></div>
    </div>:<>
      <div className="library-tools"><label>Find a card<input type="search" placeholder="Try a name, healing, or combat…" value={query} onChange={e=>{setQuery(e.target.value);setLimit(24);}}/></label><label>From which deck?<select value={deck} onChange={e=>{setDeck(e.target.value);setLimit(24);}}><option value="all">All decks</option><option value="0">Detroit</option><option value="1">Nethervoid</option><option value="2">Dark Carnival</option><option value="purchase">Purchase</option><option value="bone">Bones</option></select></label></div>
      <div className="library-filters" role="group" aria-label="Card type">{[['all','All cards'],['weapon','Weapons'],['item','Items'],['homie','Homies'],['fiend','Fiends'],['bone','Bones'],['event','Events'],['location','Locations'],['cash','Cash']].map(([value,label])=><button key={value} aria-pressed={kind===value} onClick={()=>{setKind(value);setLimit(24);}}>{label}</button>)}</div>
      <div className="library-result-count"><span role="status">{results.length} matching records · showing {Math.min(limit,results.length)}</span>{(query||kind!=='all'||deck!=='all')&&<button className="quiet" onClick={()=>{setQuery('');setKind('all');setDeck('all');setLimit(24);}}>Clear filters</button>}</div>
      <div className="library-grid">{results.slice(0,limit).map(c=><button key={c.key} className="choice-card" aria-label={`Read ${c.name}`} onClick={()=>inspect(c.key)}><ChoiceFace label={c.name} value={c.key}/><span className="choice-foot">Read card →</span></button>)}</div>
      {!results.length&&<p className="library-empty">No cards match. Clear a filter or try a shorter search.</p>}
      {results.length>limit&&<button className="secondary wide" onClick={()=>setLimit(n=>n+24)}>Show 24 more cards</button>}
      <p className="library-note">Duplicate records reflect the recovered deck. Hidden ending cards stay hidden.</p>
    </>}</div>
  </div></dialog>;
}
