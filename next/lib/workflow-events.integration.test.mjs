import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir,userInfo} from 'node:os';
import {join} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import postgres from 'postgres';
import {createFinancialCipher} from './financial-encryption.mjs';
import {prepareEncryptedStorage,cutOverEncryptedStorage} from './financial-encryption-cutover.mjs';
import {financialRouteFixture} from './financial-route-fixture.mjs';
import {insertEncryptedTransaction,readEncryptedBalances} from './encrypted-transaction-storage.mjs';
import {processEncryptedWorkflows} from './encrypted-workflow-scheduler.mjs';
import {markEncryptedWriter} from './financial-records.mjs';
const available=process.getuid?.()!==0 && ['initdb','pg_ctl'].every(cmd=>spawnSync(cmd,['--version']).status===0);
const user='00000000-0000-4000-8000-000000000001', other='00000000-0000-4000-8000-000000000002';
test('scheduled workflows run once, catch up, skip and undo with real balance triggers', {skip:!available,timeout:30000}, async t=>{
 const directory=mkdtempSync(join(tmpdir(),'expenser-schedule-')),data=join(directory,'data');
 let db,started=false;
 try {
  execFileSync('initdb',['-D',data,'-A','trust','--no-locale'],{stdio:'pipe'});
  execFileSync('pg_ctl',['-D',data,'-l',join(directory,'log'),'-o',`-k ${directory} -h '' -p 55440`,'-w','start'],{stdio:'pipe'});started=true;
  db=postgres({host:directory,port:55440,database:'postgres',username:userInfo().username,max:5,onnotice:()=>{}});
  await db.unsafe(`create role authenticated; create role anon; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql as 'select null::uuid';`);
  for(const name of ['001_reset_expenser_supabase_auth.sql','004_reconciliation_uses_opening_balances.sql','005_scheduled_workflows.sql','006_isolate_scheduled_workflow_failures.sql']) {
    const reserved = await db.reserve();
    try { await reserved.unsafe(readFileSync(new URL(`../../supabase/${name}`,import.meta.url),'utf8')); } finally { reserved.release(); }
  }
  await db`insert into auth.users values (${user}),(${other})`;
  await db`insert into users(user_id) values (${user}),(${other})`;
  const config={days:[0,1,5,6],time:'10:00',timeZone:'Asia/Kolkata',enabled:true};
  const make=async(schedule=config,owner=user)=> (await db`insert into workflows(user_id,name,type,amount,description,category,payment_method,schedule) values(${owner},'Rickshaw','expense',20,'Rickshaw','transport','cash',${db.json(schedule)}) returning *`)[0];
  const run=async time=> db`select process_due_workflows(${time}::text::timestamptz,${user}::uuid)`;
  await t.test('a failing occurrence leaves another owner’s scheduled write intact',async()=>{
    const damaged=await make({...config, days:[0,1,2,3,4,5,6]},user);
    const healthy=await make({...config, days:[0,1,2,3,4,5,6]},other);
    await db`update workflows set next_run_at='2026-10-23T04:30Z' where id=${damaged.id}`;
    await db`update workflows set next_run_at='2026-10-24T04:30Z' where id=${healthy.id}`;
    await db.unsafe(`
      create function public.test_reject_scheduled_transaction() returns trigger language plpgsql as $$
      begin
        if new.user_id = '${user}'::uuid then
          raise check_violation using message='Synthetic transaction failure';
        end if;
        return new;
      end;
      $$;
      create trigger test_reject_scheduled_transaction before insert on public.transactions
        for each row execute function public.test_reject_scheduled_transaction();
    `);
    try {
      assert.equal((await db`select process_due_workflows('2026-10-24T04:30Z') as processed`)[0].processed,1);
      const [retry]=await db`select next_run_at,processing_retry_after from workflows where id=${damaged.id}`;
      assert.equal(retry.next_run_at.toISOString(),'2026-10-23T04:30:00.000Z');
      assert.ok(retry.processing_retry_after);
      assert.equal((await db`select count(*) as count from workflow_occurrences where workflow_id=${damaged.id}`)[0].count,'0');
      assert.equal((await db`select count(*) as count from workflow_occurrences where workflow_id=${healthy.id}`)[0].count,'1');
      await db`drop trigger test_reject_scheduled_transaction on public.transactions`;
      await db`update workflows set processing_retry_after=null where id=${damaged.id}`;
      assert.equal((await db`select process_due_workflows('2026-10-23T04:30Z') as processed`)[0].processed,1);
    } finally {
      await db`drop trigger if exists test_reject_scheduled_transaction on public.transactions`;
      await db`drop function public.test_reject_scheduled_transaction()`;
      await db`delete from transactions where id in (select transaction_id from workflow_occurrences where workflow_id in (${damaged.id},${healthy.id}))`;
      await db`delete from workflows where id in (${damaged.id},${healthy.id})`;
    }
  });
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
  await t.test('paused schedules have no next run; plain templates remain unscheduled',async()=>{
    assert.equal((await make({...config,enabled:false})).next_run_at,null);
    assert.equal((await make(null)).next_run_at,null);
  });
  const bytes=()=>randomBytes(32).toString('base64url');
  const cipher=createFinancialCipher({activeKeyId:'fixture',keys:{fixture:bytes()},lookupKey:bytes()});
  await prepareEncryptedStorage(db);
  await cutOverEncryptedStorage(db,cipher);
  const metadataWrite=(work)=>db.begin(async tx=>{await markEncryptedWriter(tx);await work(tx);});
  const execute=(time)=>processEncryptedWorkflows(db,cipher,(tx,input)=>insertEncryptedTransaction(tx,cipher,input),{ownerId:user,runUntil:time});
  const addWorkflow=async(owner,schedule)=>{
    const endpoint=financialRouteFixture(db,cipher,owner,'workflows');
    const response=await endpoint('POST',{name:'Rickshaw',type:'expense',amount:20,category:'transport',paymentMethod:'cash',schedule});
    assert.equal(response.status,201);
    return (await response.json()).workflow;
  };
  await t.test('today skip before due and undo after due are idempotent and user scoped',async()=>{
    const [clock]=await db`select extract(dow from now() at time zone 'Asia/Kolkata')::integer as day, ((now() at time zone 'Asia/Kolkata')::date)::text as date`;
    const {_id:id}=await addWorkflow(user,{...config,days:[clock.day],time:'23:59'});
    await metadataWrite(tx=>tx`update workflows set schedule_started_at=now()-interval '2 days' where id=${id}`);
    const api=financialRouteFixture(db,cipher,user,'workflows/events');
    const get=()=>api('GET');
    const skip=workflowId=>api('POST',{workflowId,localDate:clock.date,action:'skip'});
    assert.equal((await (await get()).json()).events[0].status,'upcoming');
    assert.equal((await skip(id)).status,200);
    assert.equal((await skip(id)).status,200);
    const [due]=await db`select next_run_at from workflows where id=${id}`;
    await execute(due.next_run_at.toISOString());
    assert.equal((await db`select count(*)::int as n from transactions`)[0].n,0);
    assert.equal((await (await get()).json()).events[0].status,'skipped');
    await metadataWrite(tx=>tx`delete from workflow_occurrences where workflow_id=${id}`);
    await metadataWrite(tx=>tx`update workflows set next_run_at=${due.next_run_at} where id=${id}`);
    await execute(due.next_run_at.toISOString());
    assert.equal((await db`select count(*)::int as n from transactions where deleted_at is null`)[0].n,1);
    assert.equal((await skip(id)).status,200);
    assert.equal((await db`select count(*)::int as n from transactions where deleted_at is null`)[0].n,0);
    assert.equal((await readEncryptedBalances(db,cipher,user)).find(row=>row.payment_method==='cash').current_balance,0);
    const theirs=await addWorkflow(other,{...config,days:[clock.day]});
    assert.equal((await skip(theirs._id)).status,409);
    await metadataWrite(tx=>tx`delete from workflows`);
  });
  await t.test('workflow API validates schedules and preserves them for legacy clients',async()=>{
    const api=financialRouteFixture(db,cipher,user,'workflows');
    const input={name:'Rickshaw',type:'expense',amount:20,description:'',category:'transport',paymentMethod:'cash',schedule:config};
    const request=(method,body,id='')=>api(method,body,id?`?id=${id}`:'');
    assert.equal((await request('POST',{...input,schedule:{...config,days:[]}})).status,400);
    assert.equal((await request('POST',{...input,schedule:null,amount:0})).status,201);
    const created=await request('POST',input);
    assert.equal(created.status,201);
    const wf=(await created.json()).workflow;
    const legacy={...input};delete legacy.schedule;
    assert.equal((await request('PUT',legacy,wf._id)).status,200);
    assert.deepEqual((await db`select schedule from workflows where id=${wf._id}`)[0].schedule.days,config.days);
    assert.equal((await request('PUT',{...input,schedule:{...config,enabled:false}},wf._id)).status,200);
    assert.equal((await db`select next_run_at from workflows where id=${wf._id}`)[0].next_run_at,null);
    await metadataWrite(tx=>tx`delete from workflows`);
  });
 }finally{await db?.end({timeout:2});if(started)execFileSync('pg_ctl',['-D',data,'-m','immediate','-w','stop'],{stdio:'pipe'});rmSync(directory,{recursive:true,force:true});}
});
