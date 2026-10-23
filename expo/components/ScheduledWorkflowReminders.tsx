import React,{useCallback,useEffect,useRef,useState} from 'react';
import {View,Text,TouchableOpacity,AppState} from 'react-native';
import {api} from '../lib/api';
import {syncService} from '../lib/sync';
import {enqueueOutbox,getOutbox,getStoredWorkflowEvents,setStoredWorkflowEvents} from '../lib/storage';
import {ScheduledWorkflowEvent} from '../lib/types';
import {useTheme} from '../context/ThemeContext';
import {useStealthMode} from '../context/StealthContext';
import {useUserContext} from '../context/UserContext';
import {Colors} from '../constants/theme';
export default function ScheduledWorkflowReminders() {
 const {isDark}=useTheme(),{isStealthMode}=useStealthMode();const colors=isDark?Colors.dark:Colors.light;
 const {isOnline,profile,syncing,manualRefresh}=useUserContext();
 const [events,setEvents]=useState<ScheduledWorkflowEvent[]>([]),[error,setError]=useState(''),[saving,setSaving]=useState(false);
 const userId=profile?.userId;
 const signature=useRef(''),refreshRef=useRef(manualRefresh);refreshRef.current=manualRefresh;
 const load=useCallback(async()=>{
  if(!userId)return;
  const saved=isOnline?await api.getScheduledWorkflowEvents():await getStoredWorkflowEvents();
  if(isOnline)await setStoredWorkflowEvents(saved);
  const pending=await getOutbox();
  const visible=saved.filter(event=>event.localDate===new Intl.DateTimeFormat('en-CA',{timeZone:event.timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())).map(event=>pending.some(op=>op.entity==='workflowOccurrence'&&op.payload.workflowId===event.workflowId&&op.payload.localDate===event.localDate)?{...event,status:'skipped' as const}:event);
  setEvents(visible);setError('');
  const next=JSON.stringify(visible);
  if(isOnline&&next!==signature.current){signature.current=next;void refreshRef.current().catch(()=>{});}
 },[isOnline,userId]); // identity only; profile refresh must not restart polling
 useEffect(()=>{
  let active=true;
  const refresh=()=>{if(AppState.currentState==='active')void load().catch(()=>{if(active)setError('Could not refresh schedules. Pull to refresh and try again.');});};
  refresh();const timer=setInterval(refresh,15000),subscription=AppState.addEventListener('change',state=>{if(state==='active')refresh();});
  return()=>{active=false;clearInterval(timer);subscription.remove();};
 },[load,syncing]);
 const skip=async(event:ScheduledWorkflowEvent)=>{
  setSaving(true);setError('');
  try{
   await enqueueOutbox({entity:'workflowOccurrence',entityId:`${event.workflowId}_${event.localDate}`,action:'update',payload:{workflowId:event.workflowId,localDate:event.localDate}});
   setEvents(current=>current.map(item=>item.workflowId===event.workflowId?{...item,status:'skipped'}:item));
   void syncService.syncAll();
  }catch{setError('Could not save “Not today”. Please try again.');}finally{setSaving(false);}
 };
 if(!events.length&&!error)return null;
 return <View style={{backgroundColor:colors.card,borderWidth:1,borderColor:colors.border,borderRadius:16,padding:16,marginBottom:16,gap:12}}>
  <Text style={{fontWeight:'600',fontSize:16,color:colors.text}}>Today’s scheduled workflows</Text>
  {!!error&&<Text accessibilityRole="alert" style={{color:colors.error}}>{error}</Text>}
  {events.map(event=><View key={event.workflowId} style={{borderTopWidth:1,borderColor:colors.border,paddingTop:12,gap:8}}>
   <Text style={{fontWeight:'600',color:colors.text}}>{event.name} · {isStealthMode?'₹••••':`₹${Number(event.amount).toLocaleString('en-IN')}`}</Text>
   <Text style={{fontSize:12,color:colors.textMuted}}>{new Date(event.scheduledAt).toLocaleTimeString('en-IN',{timeZone:event.timeZone,hour:'2-digit',minute:'2-digit'})} · {event.timeZone} · {event.status==='skipped'?'Skipped today':event.status==='recorded'?'Recorded':'Will record automatically'}</Text>
   {event.status!=='skipped'&&<TouchableOpacity accessibilityRole="button" disabled={saving} onPress={()=>void skip(event)} style={{paddingVertical:10}}><Text style={{fontWeight:'600',color:colors.primary}}>Not today</Text></TouchableOpacity>}
   {!isOnline&&event.status==='skipped'&&<Text style={{fontSize:12,color:colors.textMuted}}>Saved on this device. Any automatic entry will be undone after reconnecting.</Text>}
  </View>)}
 </View>;
}
