import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({error:'Unauthorized'},{status:401});
    await sql`select public.process_due_workflows(now(),${user.userId}::uuid)`;
    const events = await sql`
      with today as (
        select w.*, (now() at time zone (schedule->>'timeZone'))::date as local_day
        from workflows w where user_id=${user.userId} and schedule->>'enabled'='true'
      ), scheduled as (
        select *, (local_day+(schedule->>'time')::time) at time zone (schedule->>'timeZone') as due
        from today where schedule->'days' @> to_jsonb(extract(dow from local_day)::integer)
      )
      select s.id as "workflowId", s.name, s.amount, s.type, s.schedule->>'timeZone' as "timeZone",
        s.local_day::text as "localDate", s.due as "scheduledAt",
        coalesce(o.status,'upcoming') as status
      from scheduled s left join workflow_occurrences o on o.workflow_id=s.id and o.local_date=s.local_day
      where s.due > s.schedule_started_at
        and (s.due at time zone (s.schedule->>'timeZone'))::time=(s.schedule->>'time')::time
      order by s.due,s.id
    `;
    return NextResponse.json({events}, {headers:{'Cache-Control':'no-store'}});
  } catch(error) {
    console.error('[Workflow events GET]',error);
    return NextResponse.json({error:'Could not load scheduled workflows'},{status:500});
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({error:'Unauthorized'},{status:401});
    const body = await req.json();
    if (typeof body.workflowId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.workflowId) || body.action !== 'skip' || typeof body.localDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.localDate)) {
      return NextResponse.json({error:'Invalid event action'},{status:400});
    }
    const result = await sql.begin(async transaction => {
      const tx = transaction as unknown as typeof sql;
      // Same workflow lock as the worker: skip/undo and an automatic entry
      // cannot race into two conflicting outcomes.
      const [wf] = await tx`select *,schedule_started_at::text as started_at_text from workflows where id=${body.workflowId} and user_id=${user.userId} for update`;
      if (!wf?.schedule?.enabled) return false;
      const [event] = await tx`
        select ${body.localDate}::date::text as day,
          ${body.localDate}::date <= (now() at time zone (${wf.schedule.timeZone}))::date as allowed,
          ((${body.localDate}::date + ${wf.schedule.time}::time) at time zone ${wf.schedule.timeZone})::text as due,
          extract(dow from ${body.localDate}::date)::integer as weekday
      `;
      // Bind strings as text to preserve sub-millisecond database boundaries.
      const [valid] = await tx`select ${event.due}::text::timestamptz > ${wf.started_at_text}::text::timestamptz as ok`;
      if (!event.allowed || !valid.ok || !wf.schedule.days.includes(event.weekday)) return false;
      const [existing] = await tx`
        insert into workflow_occurrences(user_id,workflow_id,local_date,scheduled_at,status)
        values(${user.userId},${wf.id},${event.day}::date,${event.due}::text::timestamptz,'skipped')
        on conflict(workflow_id,local_date) do update set status='skipped'
        returning transaction_id
      `;
      if (existing.transaction_id) {
        await tx`update transactions set deleted_at=coalesce(deleted_at,now()) where id=${existing.transaction_id} and user_id=${user.userId}`;
      }
      return true;
    });
    if (!result) return NextResponse.json({error:'No scheduled event for today'},{status:409});
    return NextResponse.json({ok:true});
  } catch(error) {
    console.error('[Workflow events POST]',error);
    return NextResponse.json({error:'Could not skip this occurrence'},{status:500});
  }
}
