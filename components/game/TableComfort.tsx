"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_COMFORT, parseComfort, attentionCue, type TableComfort } from '@/lib/table-comfort';
import { GameArtwork } from './GameArtwork';

export function useTableComfort(code:string|undefined, attention:boolean, rolling:boolean) {
  const [preferences,setPreferences]=useState<TableComfort>(DEFAULT_COMFORT),[loaded,setLoaded]=useState(false);
  const audio=useRef<AudioContext|null>(null),last=useRef({code,attention,rolling});
  const play=useCallback((kind:'turn'|'roll'='turn')=>{
    try {
      const context=audio.current && audio.current.state!=='closed'?audio.current:new AudioContext();audio.current=context;
      void context.resume().then(()=>{
        const notes=kind==='turn'?[523.25,659.25,783.99]:[180,230,310];
        notes.forEach((frequency,i)=>{const tone=context.createOscillator(),gain=context.createGain(),start=context.currentTime+i*.085;
          tone.type='sine';tone.frequency.value=frequency;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.045,start+.012);gain.gain.exponentialRampToValueAtTime(.001,start+.18);
          tone.connect(gain);gain.connect(context.destination);tone.start(start);tone.stop(start+.2);tone.onended=()=>{tone.disconnect();gain.disconnect();};
        });
      }).catch(()=>{});
    } catch { /* Sound is optional when the browser does not support it. */ }
  },[]);
  useEffect(()=>{try{setPreferences(parseComfort(localStorage.getItem('qsl_comfort')));}catch{}setLoaded(true);return()=>{const context=audio.current;audio.current=null;if(context && context.state!=='closed')void context.close().catch(()=>{});};},[]);
  useEffect(()=>{if(loaded)try{localStorage.setItem('qsl_comfort',JSON.stringify(preferences));}catch{}},[preferences,loaded]);
  // Returning players unlock optional audio with their next interaction, never on page load.
  useEffect(()=>{if(!preferences.sounds)return;const unlock=()=>{try{if(!audio.current || audio.current.state==='closed')audio.current=new AudioContext();void audio.current.resume().catch(()=>{});}catch{}};window.addEventListener('pointerdown',unlock,{once:true});window.addEventListener('keydown',unlock,{once:true});return()=>{window.removeEventListener('pointerdown',unlock);window.removeEventListener('keydown',unlock);};},[preferences.sounds]);
  useEffect(()=>{if(preferences.sounds&&audio.current){if(attentionCue(last.current,{code,attention}))play('turn');else if(code===last.current.code&&rolling&&!last.current.rolling)play('roll');}last.current={code,attention,rolling};},[code,attention,rolling,preferences.sounds,play]);
  function change(key:keyof TableComfort,value:boolean){setPreferences(p=>({...p,[key]:value}));if(key==='sounds'&&value)play();}
  return {preferences,change,play};
}
export function ComfortSettings({comfort}:{comfort:ReturnType<typeof useTableComfort>}) {
  const dialog=useRef<HTMLDialogElement>(null);
  return <><button className="quiet comfort-trigger" onClick={()=>dialog.current?.showModal()}>Table settings</button><dialog ref={dialog} className="comfort-dialog" aria-labelledby="comfort-title"><div className="comfort-shell"><header><GameArtwork kind="carnival"/><div><span>MAKE YOURSELF AT HOME</span><h2 id="comfort-title">Your table, your way.</h2></div><button className="quiet" aria-label="Close table settings" onClick={()=>dialog.current?.close()}>✕</button></header>
    <p>Saved on this browser. Your friends can choose their own settings.</p>
    {([['sounds','Table sounds','A soft chime when your action is needed, plus a dice cue.'],['reduceMotion','Calmer motion','Stop decorative animations and use instant board scrolling.'],['largeText','Larger reading text','Make card rules, guidance, and chat easier to read.']] as const).map(([key,label,description])=><label className="comfort-option" key={key}><span><strong>{label}</strong><small>{description}</small></span><input type="checkbox" checked={comfort.preferences[key]} onChange={e=>comfort.change(key,e.target.checked)}/><span className="comfort-switch" aria-hidden="true"/></label>)}
    <p className="comfort-note">Sound starts off. Your device’s reduced-motion preference is always respected.</p><button className="primary wide" onClick={()=>dialog.current?.close()}>Back to the game →</button>
  </div></dialog></>;
}
