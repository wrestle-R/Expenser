'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Card} from '@/components/ui/card';
import {useStealthMode} from '@/context/StealthContext';
type Event={workflowId:string;localDate:string;scheduledAt:string;timeZone:string;name:string;amount:number;type:string;status:'upcoming'|'recorded'|'skipped'};
export function ScheduledReminders({onChange}:{onChange:()=>void}) {
 const [events,setEvents]=useState<Event[]>([]),[error,setError]=useState(''),[saving,setSaving]=useState<string|null>(null);
 const {isStealthMode}=useStealthMode();
 const last=useRef(''),callback=useRef(onChange);callback.current=onChange;
 const load=useCallback(async()=>{
  const response=await fetch('/api/workflows/events',{cache:'no-store'});
  if(!response.ok)throw new Error('Could not refresh scheduled workflows. Please retry.');
  const data=await response.json();
  setEvents(data.events);setError('');
  const signature=JSON.stringify(data.events);
  if(signature!==last.current){last.current=signature;callback.current();}
 },[]);
 useEffect(()=>{
  let active=true;
  const refresh=()=>{if(document.visibilityState==='visible')void load().catch(e=>{if(active)setError(e.message);});};
  refresh();const timer=setInterval(refresh,15000);
  window.addEventListener('focus',refresh);
  return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',refresh);};
 },[load]);
 const skip=async(event:Event)=>{
  setSaving(event.workflowId);setError('');
  try{
   const res=await fetch('/api/workflows/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({workflowId:event.workflowId,localDate:event.localDate,action:'skip'})});
   if(!res.ok)throw new Error('Could not skip this event. Please retry.');
   await load();callback.current();
  }catch(e){setError(e instanceof Error?e.message:'Could not update event');}finally{setSaving(null);}
 };
 if(!events.length&&!error)return null;
 return <Card className="gap-3 p-5"><h2 className="font-semibold">Today’s scheduled workflows</h2>{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}{events.map(event=><div key={event.workflowId} className="flex items-center justify-between gap-4 border-t pt-3"><div><p className="text-sm font-medium">{event.name} <span className={isStealthMode?'blur-sm select-none':''}>· ₹{Number(event.amount).toLocaleString('en-IN')}</span></p><p className="text-xs text-muted-foreground">{new Date(event.scheduledAt).toLocaleTimeString('en-IN',{timeZone:event.timeZone,hour:'2-digit',minute:'2-digit'})} · {event.timeZone} · {event.status==='recorded'?'Recorded':event.status==='skipped'?'Skipped today':'Will record automatically'}</p></div>{event.status!=='skipped'&&<Button size="sm" variant="outline" disabled={saving!==null} onClick={()=>void skip(event)}>{saving===event.workflowId?'Saving…':'Not today'}</Button>}</div>)}</Card>;
}
