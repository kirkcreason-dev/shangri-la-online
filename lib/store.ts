import {env} from 'cloudflare:workers';
import {cookies} from 'next/headers';
import type {State} from './game';
export function database(){if(!env.DB)throw new Error('Saved games are temporarily unavailable. Please try again.');return env.DB}
export async function session(){const c=await cookies();let token=c.get('qsl_session')?.value;if(!token||!/^[a-f0-9]{64}$/.test(token)){token=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');c.set('qsl_session',token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:60*60*24*30});}const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('')}
export async function readRoom(code:string){if(!/^[A-Z2-9]{6}$/.test(code))return null;const row=await database().prepare('SELECT state,revision FROM rooms WHERE code = ?').bind(code).first<{state:string;revision:number}>();if(!row)return null;const s=JSON.parse(row.state) as State;s.rev=row.revision;return s}
export async function saveRoom(s:State,rev:number){s.rev=rev+1;const r=await database().prepare('UPDATE rooms SET state = ?, revision = ?, updated_at = ? WHERE code = ? AND revision = ?').bind(JSON.stringify(s),s.rev,Date.now(),s.code,rev).run();if(r.meta.changes!==1)throw new ConflictError('The table changed. Your game has refreshed; try again.');}
export class ConflictError extends Error{}
export function result(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}})}
export function fail(e:unknown){const known=e instanceof Error?e.message:'Something went wrong.';console.error('Room request:',known);return result({error:known},e instanceof ConflictError?409:400)}
export async function body(req:Request){const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)throw new Error('This request must come from the game.');const raw=await req.text();if(raw.length>8192)throw new Error('Request too large.');return JSON.parse(raw)}
export function playerInput(b:Record<string,unknown>){if(typeof b.name!=='string'||!b.name.trim()||b.name.trim().length>24)throw new Error('Enter a name from 1 to 24 characters.');return b.name.trim()}
