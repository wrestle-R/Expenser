import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir,userInfo} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {execFileSync,spawnSync} from 'node:child_process';
import postgres from 'postgres';
import * as schedules from './workflow-schedule.js';
import errors from './api-errors.js';
const require=createRequire(import.meta.url), ts=require('typescript');
const available=process.getuid?.()!==0 && ['initdb','pg_ctl'].every(cmd=>spawnSync(cmd,['--version']).status===0);
const user='00000000-0000-4000-8000-000000000001', other='00000000-0000-4000-8000-000000000002';
function route(db,name="events") {
  const exports={};
  const deps={'next/server':require('next/server'),'@/lib/auth':{getAuthenticatedUser:async()=>({userId:user})},'@/lib/db':{sql:db,normalizeNumber:(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback,mapWorkflowRow:row=>({...row,_id:row.id})},'@/lib/workflow-schedule.js':schedules,'@/lib/api-errors':errors};
  const src=ts.transpileModule(readFileSync(new URL(`../app/api/workflows/${name==='events'?'events/':''}route.ts`,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  runInNewContext(src,{exports,require:name=>{assert.ok(name in deps,name);return deps[name];},console,Date,Error,URL});
  return exports;
}
test('scheduled workflows run once, catch up, skip and undo with real balance triggers', {skip:!available,timeout:30000}, async t=>{
 const directory=mkdtempSync(join(tmpdir(),'expenser-schedule-')),data=join(directory,'data');
 let db,started=false;
 try {
  execFileSync('initdb',['-D',data,'-A','trust','--no-locale'],{stdio:'pipe'});
  execFileSync('pg_ctl',['-D',data,'-l',join(directory,'log'),'-o',`-k ${directory} -h '' -p 55440`,'-w','start'],{stdio:'pipe'});started=true;
  db=postgres({host:directory,port:55440,database:'postgres',username:userInfo().username,max:5,onnotice:()=>{}});
  await db.unsafe(`create role authenticated; create role anon; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql as 'select null::uuid';`);
  for(const name of ['001_reset_expenser_supabase_auth.sql','004_reconciliation_uses_opening_balances.sql','005_scheduled_workflows.sql']) {
    const reserved = await db.reserve();
    try { await reserved.unsafe(readFileSync(new URL(`../../supabase/${name}`,import.meta.url),'utf8')); } finally { reserved.release(); }
  }
  await db`insert into auth.users values (${user}),(${other})`;
  await db`insert into users(user_id) values (${user}),(${other})`;
  const config={days:[0,1,5,6],time:'10:00',timeZone:'Asia/Kolkata',enabled:true};
  const make=async(schedule=config,owner=user)=> (await db`insert into workflows(user_id,name,type,amount,description,category,payment_method,schedule) values(${owner},'Rickshaw','expense',20,'Rickshaw','transport','cash',${db.json(schedule)}) returning *`)[0];
  const run=async time=> db`select process_due_workflows(${time}::text::timestamptz,${user}::uuid)`;
  await t.test('Friday through Monday, timezone conversion and DST',async()=>{
    for(const [after,expected] of [
      ['2026-10-22T12:00Z','2026-10-23T04:30:00.000Z'],
      ['2026-10-23T04:30Z','2026-10-24T04:30:00.000Z'],
      ['2026-10-26T04:30Z','2026-10-30T04:30:00.000Z'],
    ]) assert.equal((await db`select next_workflow_run(${db.json(config)},${after}::text::timestamptz) as due`)[0].due.toISOString(),expected);
    const dst={...config,days:[0],time:'02:30',timeZone:'America/New_York'};
    assert.equal((await db`select next_workflow_run(${db.json(dst)},'2026-03-07T00:00Z') as due`)[0].due.toISOString(),'2026-03-15T06:30:00.000Z');
  });
  await t.test('no duplicate entries, deterministic time, missed-day catchup, future days untouched',async()=>{
    const wf=await make();
    await db`update workflows set next_run_at='2026-10-23T04:30Z' where id=${wf.id}`;
    await Promise.all([run('2026-10-26T04:30Z'),run('2026-10-26T04:30Z')]);
    await run('2026-10-26T04:30Z');
    const rows=await db`select * from transactions where user_id=${user} order by date`;
    assert.equal(rows.length,4);
    assert.deepEqual(rows.map(r=>r.date.toISOString()),[23,24,25,26].map(d=>`2026-10-${d}T04:30:00.000Z`));
    assert.equal((await db`select current_balance from balances where user_id=${user} and payment_method='cash'`)[0].current_balance,'-80.00');
    assert.equal((await db`select next_run_at from workflows where id=${wf.id}`)[0].next_run_at.toISOString(),'2026-10-30T04:30:00.000Z');
    await db`delete from workflows where id=${wf.id}`;
    await db`delete from transactions`;
  });
  await t.test('today skip before due and undo after due are idempotent and user scoped',async()=>{
    const [clock]=await db`select extract(dow from now() at time zone 'Asia/Kolkata')::integer as day, ((now() at time zone 'Asia/Kolkata')::date)::text as date`;
    const wf=await make({...config,days:[clock.day],time:'23:59'});
    await db`update workflows set schedule_started_at=now()-interval '2 days' where id=${wf.id}`;
    const api=route(db);
    const get=()=>api.GET(new Request('http://localhost/api/workflows/events'));
    const skip=id=>api.POST(new Request('http://localhost/api/workflows/events',{method:'POST',body:JSON.stringify({workflowId:id,localDate:clock.date,action:'skip'})}));
    assert.equal((await (await get()).json()).events[0].status,'upcoming');
    assert.equal((await skip(wf.id)).status,200);
    assert.equal((await skip(wf.id)).status,200);
    const [due]=await db`select next_run_at from workflows where id=${wf.id}`;
    await run(due.next_run_at.toISOString());
    assert.equal((await db`select count(*)::int as n from transactions`)[0].n,0);
    assert.equal((await (await get()).json()).events[0].status,'skipped');
    await db`delete from workflow_occurrences where workflow_id=${wf.id}`;
    await db`update workflows set next_run_at=${due.next_run_at} where id=${wf.id}`;
    await run(due.next_run_at.toISOString());
    assert.equal((await db`select count(*)::int as n from transactions where deleted_at is null`)[0].n,1);
    assert.equal((await skip(wf.id)).status,200);
    assert.equal((await db`select count(*)::int as n from transactions where deleted_at is null`)[0].n,0);
    assert.equal((await db`select current_balance from balances where user_id=${user} and payment_method='cash'`)[0].current_balance,'0.00');
    const theirs=await make({...config,days:[clock.day]},other);
    assert.equal((await skip(theirs.id)).status,409);
    await db`delete from workflows`;
  });
  await t.test('workflow API validates schedules and preserves them for legacy clients',async()=>{
    const api=route(db,'workflows');
    const input={name:'Rickshaw',type:'expense',amount:20,description:'',category:'transport',paymentMethod:'cash',schedule:config};
    const request=(method,body,id='')=>new Request(`http://localhost/api/workflows${id?`?id=${id}`:''}`,{method,body:JSON.stringify(body)});
    assert.equal((await api.POST(request('POST',{...input,schedule:{...config,days:[]}}))).status,400);
    assert.equal((await api.POST(request('POST',{...input,schedule:null,amount:0}))).status,201);
    const created=await api.POST(request('POST',input));
    assert.equal(created.status,201);
    const wf=(await created.json()).workflow;
    const legacy={...input};delete legacy.schedule;
    assert.equal((await api.PUT(request('PUT',legacy,wf._id))).status,200);
    assert.deepEqual((await db`select schedule from workflows where id=${wf._id}`)[0].schedule.days,config.days);
    assert.equal((await api.PUT(request('PUT',{...input,schedule:{...config,enabled:false}},wf._id))).status,200);
    assert.equal((await db`select next_run_at from workflows where id=${wf._id}`)[0].next_run_at,null);
    await db`delete from workflows`;
  });
  await t.test('paused schedules have no next run; plain templates remain unscheduled',async()=>{
    assert.equal((await make({...config,enabled:false})).next_run_at,null);
    assert.equal((await make(null)).next_run_at,null);
  });
 }finally{await db?.end({timeout:2});if(started)execFileSync('pg_ctl',['-D',data,'-m','immediate','-w','stop'],{stdio:'pipe'});rmSync(directory,{recursive:true,force:true});}
});
