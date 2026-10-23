import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { execFileSync, spawnSync } from "node:child_process";
import postgres from "postgres";
import * as pagination from "./transaction-pagination.js";
import * as review from "./transaction-review.js";
import * as bankBalance from "./bank-import-balance.js";
import * as schedule from "./workflow-schedule.js";
import reconciliation from "./balance-reconciliation.js";
import apiErrors from "./api-errors.js";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const available = process.getuid?.() !== 0 && ["initdb", "pg_ctl"].every((cmd) => spawnSync(cmd, ["--version"]).status === 0);

function loadRoute(name, sql) {
  const exports = {};
  const dependencies = {
    "@/lib/workflow-schedule.js": schedule,
    "@/lib/balance-reconciliation": reconciliation,
    "@/lib/transaction-pagination.js": pagination,
    "next/server": require("next/server"),
    "@/lib/auth": { getAuthenticatedUser: async () => ({ userId: "test-user" }) },
    "@/lib/api-errors": apiErrors,
    "@/lib/transaction-review.js": review,
    "@/lib/bank-import-balance.js": bankBalance,
    "@/lib/db": {
      sql,
      mapBalanceReconciliationAlertRow: (row) => ({ ...row, _id: row.id, createdAt: row.created_at }),
      mapUserRow: (row, balances) => ({ ...row, balances }),
      normalizeNumber: (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback,
      normalizeDate: (value) => new Date(value ?? Date.now()),
      mapTransactionRow: (row) => ({ _id: row.id }),
      mapWorkflowRow: (row) => ({ _id: row.id }),
    },
  };
  const source = ts.transpileModule(readFileSync(new URL(`../app/api/${name}/route.ts`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  runInNewContext(source, {
    exports, require: (module) => {
      assert.ok(module in dependencies, `Unexpected dependency: ${module}`);
      return dependencies[module];
    }, console, Error, Date, URL,
  });
  return exports;
}

// Force both initial lookups to finish before either inserts, exercising the
// unique-violation recovery rather than the early existing-record return.
function concurrentSql(database, table) {
  let lookups = 0;
  let release;
  const barrier = new Promise((resolve) => { release = resolve; });
  const sql = (...args) => database(...args);
  sql.json = database.json;
  sql.begin = (callback) => database.begin((tx) => callback(new Proxy(tx, {
    apply: async (target, thisArg, args) => {
      const rows = await Reflect.apply(target, thisArg, args);
      const query = args[0].join("?");
      if (rows.length === 0 && query.includes(`from ${table}`) && /client_request_id|import_source_key/.test(query) && lookups < 2) {
        if (++lookups === 2) release();
        await barrier;
      }
      return rows;
    },
  })));
  return sql;
}

test("concurrent duplicate POST requests recover in PostgreSQL", { skip: !available, timeout: 20000 }, async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "expenser-db-test-"));
  const data = join(directory, "data");
  let database;
  let started = false;
  try {
    execFileSync("initdb", ["-D", data, "-A", "trust", "--no-locale"], { stdio: "pipe" });
    execFileSync("pg_ctl", ["-D", data, "-l", join(directory, "postgres.log"), "-o", `-k ${directory} -h '' -p 55439`, "-w", "start"], { stdio: "pipe" });
    started = true;
    database = postgres({ host: directory, port: 55439, database: "postgres", username: userInfo().username, max: 4 });
    await database.unsafe(`
      create table transactions (
        id uuid primary key default gen_random_uuid(), user_id text not null,
        client_request_id text, exchange_expense_id uuid,
        import_source text, import_source_key text, imported_account_suffix text,
        imported_bank_balance numeric, imported_bank_reference text, imported_bank_confidence text,
        type text, amount numeric, description text, category text, review_status text,
        payment_method text, split_amount numeric, date timestamptz, deleted_at timestamptz, created_at timestamptz default now(), updated_at timestamptz default now()
      );
      create unique index on transactions (user_id, client_request_id) where client_request_id is not null;
      create unique index on transactions (user_id, import_source_key) where import_source_key is not null;
      create table workflows (
        id uuid primary key default gen_random_uuid(), user_id text not null,
        client_request_id text, name text, type text, amount numeric,
        description text, category text, payment_method text, split_amount numeric, schedule jsonb
      );
      create unique index on workflows (user_id, client_request_id) where client_request_id is not null;
    `);
    for (const [name, identity] of [
      ["transactions", { clientRequestId: "transaction-request" }],
      ["transactions", { importSource: "bank_sms", importSourceKey: "canonical:123" }],
      ["workflows", { clientRequestId: "workflow-request" }],
    ]) {
      await t.test(`${name}: ${Object.keys(identity)[0]}`, async () => {
        await database.unsafe(`truncate ${name}`);
        const route = loadRoute(name, concurrentSql(database, name));
        const body = { type: "expense", amount: 20, paymentMethod: "cash", category: "Food", name: "Lunch", ...identity };
        const request = () => new Request(`http://localhost/api/${name}`, { method: "POST", body: JSON.stringify(body) });
        const responses = await Promise.all([route.POST(request()), route.POST(request())]);
        assert.ok(responses.every((response) => response.ok));
        const bodies = await Promise.all(responses.map((response) => response.json()));
        const field = name === "transactions" ? "transaction" : "workflow";
        assert.equal(bodies[0][field]._id, bodies[1][field]._id);
        const rows = await database.unsafe(`select count(*)::int as count from ${name}`);
        assert.equal(rows[0].count, 1);
      });
    }
    await t.test("history pagination does not skip equal timestamps or expose another user's rows", async () => {
      await database`truncate transactions`;
      await database`insert into transactions (user_id, type, amount, payment_method, category, date, created_at)
        select 'test-user', 'expense', 10, 'cash', 'food', '2026-10-23 12:00:00.123456+00'::timestamptz, '2026-10-23 12:00:00.654321+00'::timestamptz from generate_series(1, 1001)`;
      await database`insert into transactions (user_id, type, amount, date, created_at) values ('another-user','expense',99,now(),now())`;
      const route = loadRoute('transactions', database);
      const ids = new Set(); let cursor = null, pages = 0;
      do {
        const response = await route.GET(new Request(`http://localhost/api/transactions?limit=250${cursor ? `&cursor=${cursor}` : ''}`));
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.ok(body.transactions.length <= 250);
        for (const row of body.transactions) { assert.ok(!ids.has(row._id)); ids.add(row._id); }
        cursor = body.nextCursor; pages++;
      } while (cursor);
      assert.equal(ids.size, 1001); assert.equal(pages, 5);
      assert.equal((await route.GET(new Request('http://localhost/api/transactions?limit=10000'))).status, 400);
    });

    await t.test("latest balance choice resolves the batch across clients", async () => {
      await database.unsafe(`
        create table users (user_id text primary key);
        insert into users values ('test-user'), ('another-user');
        create table balances (user_id text, payment_method text, opening_balance numeric, opening_at timestamptz, current_balance numeric, unique(user_id,payment_method));
        insert into balances values ('test-user','bank',1000,now(),1000);
        create function ensure_user_balances(text) returns void language sql as 'select';
        create function recalculate_user_balances(text) returns void language sql as 'select';
        create table balance_reconciliation_alerts (
          id uuid primary key default gen_random_uuid(), user_id text, transaction_id uuid,
          payment_method text default 'bank', expected_balance numeric, bank_balance numeric,
          difference numeric, status text default 'pending', created_at timestamptz default now(), resolved_at timestamptz
        );
      `);
      const route = loadRoute('bank-imports/reconcile', database);
      const get = (history = false) => route.GET(new Request(`http://localhost/api/bank-imports/reconcile?includeHistory=${history}`));
      const post = (id, action) => route.POST(new Request('http://localhost/api/bank-imports/reconcile', {method:'POST', body:JSON.stringify({id,action})}));
      for (const action of ['apply', 'keep']) {
        await database`truncate balance_reconciliation_alerts, transactions`;
        const ids = [];
        // Import order deliberately differs from transaction order.
        for (const [day, owner, deleted] of [[3,'test-user',false],[1,'test-user',false],[2,'test-user',false],[5,'another-user',false],[6,'test-user',true]]) {
          const [transaction] = await database`insert into transactions(user_id,date,deleted_at) values (${owner},${`2026-10-0${day}T12:00:00.123456Z`}::text::timestamptz,${deleted ? new Date() : null}) returning id`;
          const [alert] = await database`insert into balance_reconciliation_alerts(user_id,transaction_id,expected_balance,bank_balance,difference,created_at) values (${owner},${transaction.id},800,750,-50,${`2026-10-10T12:00:0${ids.length}Z`}) returning id`;
          ids.push(alert.id);
        }
        for (const history of [false,true]) {
          const body = await (await get(history)).json();
          assert.equal(body.alerts.length,1);
          assert.equal(body.alerts[0]._id,ids[0]);
        }
        assert.equal((await post(ids[1],action)).status,409);
        assert.equal((await database`select count(*)::int as n from balance_reconciliation_alerts where status='pending'`)[0].n,5);
        const results = await Promise.all([post(ids[0],action),post(ids[0],action)]);
        assert.deepEqual(results.map(r => r.status).sort(),[200,409]);
        assert.equal((await results.find(r => r.status===200).json()).alert._id,ids[0]);
        const [balance] = await database`select opening_balance, (opening_at at time zone 'UTC')::text as opening_at from balances where user_id='test-user'`;
        assert.equal(Number(balance.opening_balance), action==='apply' ? 750 : 800);
        assert.match(balance.opening_at,/2026-10-03 12:00:00.123456/);
        assert.equal((await (await get()).json()).alerts.length,0);
        const rows = await database`select * from balance_reconciliation_alerts`;
        assert.ok(rows.filter(r=>r.user_id==='test-user').every(r=>r.status===(action==='apply'?'applied':'kept')));
        assert.equal(rows.find(r=>r.user_id==='another-user').status,'pending');
        await database`update balance_reconciliation_alerts set status='pending' where id=${ids[0]}`;
        assert.equal((await (await get()).json()).alerts[0]._id,ids[0]);
      }
    });

  } finally {
    await database?.end({ timeout: 2 });
    if (started) execFileSync("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"], { stdio: "pipe" });
    rmSync(directory, { recursive: true, force: true });
  }
});
