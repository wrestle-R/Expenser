'use client';
import {Repeat2,Clock3} from 'lucide-react';
import {Input} from '@/components/ui/input';
import {Switch} from '@/components/ui/switch';
import {Separator} from '@/components/ui/separator';
import {Field,FieldLabel,FieldDescription,FieldGroup,FieldContent,FieldSet,FieldLegend} from '@/components/ui/field';
import {ToggleGroup,ToggleGroupItem} from '@/components/ui/toggle-group';
import {WEEKDAYS,type WorkflowSchedule} from '@/lib/workflow-schedule';
export function ScheduleEditor({value,onChange}:{value:WorkflowSchedule|null;onChange:(value:WorkflowSchedule|null)=>void}) {
 return <section className="flex flex-col gap-4 rounded-xl border bg-muted/20 p-4" aria-label="Workflow schedule">
  <Field orientation="horizontal">
   <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background"><Repeat2 className="size-4"/></span>
   <FieldContent><FieldLabel htmlFor="repeat-workflow">Repeat automatically</FieldLabel><FieldDescription>{value?'Your days. Your time.':'Set a routine for this workflow.'}</FieldDescription></FieldContent>
   <Switch aria-label="Repeat automatically" id="repeat-workflow" checked={!!value} onCheckedChange={checked=>onChange(checked?{days:[1,2,3,4,5],time:'10:00',timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,enabled:true}:null)}/>
  </Field>
  {value&&<>
   <Separator/>
   <FieldSet className="gap-2"><FieldLegend variant="label">Repeat on</FieldLegend>
    <ToggleGroup multiple value={value.days.map(String)} onValueChange={selected=>onChange({...value,days:selected.map(Number).sort()})} variant="schedule" size="sm" spacing={1} className="flex w-full flex-wrap" aria-label="Repeat on weekdays">
     {WEEKDAYS.map((day,index)=><ToggleGroupItem className="min-h-9 min-w-0 flex-1 px-1" key={day} value={String(index)} aria-label={`Repeat on ${day}`}>{day}</ToggleGroupItem>)}
    </ToggleGroup>
   </FieldSet>
   <FieldGroup>
    <Field><FieldLabel htmlFor="schedule-time"><Clock3 className="size-3.5"/>At what time?</FieldLabel><Input id="schedule-time" type="time" value={value.time} onChange={e=>onChange({...value,time:e.target.value})}/></Field>
    <Field><FieldLabel htmlFor="schedule-zone">Time zone</FieldLabel><Input id="schedule-zone" value={value.timeZone} onChange={e=>onChange({...value,timeZone:e.target.value})} placeholder="Asia/Kolkata"/><FieldDescription>Times stay in this zone, even when you travel.</FieldDescription></Field>
   </FieldGroup>
   <p className="text-xs leading-relaxed text-muted-foreground">Records the saved amount from the next scheduled time. Use “Not today” on Home to skip or undo one day.</p>
  </>}
 </section>;
}
