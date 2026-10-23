'use client';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {WEEKDAYS, type WorkflowSchedule} from '@/lib/workflow-schedule';
export function ScheduleEditor({value,onChange}:{value:WorkflowSchedule|null;onChange:(value:WorkflowSchedule|null)=>void}) {
 return <div className="space-y-3 border-t pt-4">
  <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={!!value} onChange={e=>onChange(e.target.checked?{days:[1,2,3,4,5],time:'10:00',timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,enabled:true}:null)}/>Repeat automatically</label>
  {value && <>
   <div className="flex flex-wrap gap-1" role="group" aria-label="Repeat on weekdays">{WEEKDAYS.map((day,index)=><Button key={day} type="button" size="sm" variant={value.days.includes(index)?'default':'outline'} aria-pressed={value.days.includes(index)} onClick={()=>onChange({...value,days:value.days.includes(index)?value.days.filter(d=>d!==index):[...value.days,index].sort()})}>{day}</Button>)}</div>
   <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label htmlFor="schedule-time">At</Label><Input id="schedule-time" type="time" value={value.time} onChange={e=>onChange({...value,time:e.target.value})}/></div><div className="space-y-2"><Label htmlFor="schedule-zone">Time zone</Label><Input id="schedule-zone" value={value.timeZone} onChange={e=>onChange({...value,timeZone:e.target.value})} placeholder="Asia/Kolkata"/></div></div>
   <p className="text-xs text-muted-foreground">Records the saved amount on these days, starting with the next scheduled time. Use “Not today” on Home to skip or undo one day. The schedule keeps this time zone.</p>
  </>}
 </div>;
}
