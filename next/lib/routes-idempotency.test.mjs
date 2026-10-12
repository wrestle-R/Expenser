import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { execFileSync, spawnSync } from "node:child_process";
import postgres from "postgres";
import * as review from "./transaction-review.js";
import * as bankBalance from "./bank-import-balance.js";
import apiErrors from "./api-errors.js";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const available = process.getuid?.() !== 0 && ["initdb", "pg_ctl"].every((cmd) => spawnSync(cmd, ["--version"]).status === 0);

function loadRoute(name, sql) {
  const exports = {};
  const dependencies = {
    "next/server": require("next/server"),
    "@/lib/auth": { getAuthenticatedUser: async () => ({ userId: "test-user" }) },
    "@/lib/api-errors": apiErrors,
    "@/lib/transaction-review.js": review,
    "@/lib/bank-import-balance.js": bankBalance,
    "@/lib/db": {
      sql,
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
        payment_method text, split_amount numeric, date timestamptz, deleted_at timestamptz
      );
      create unique index on transactions (user_id, client_request_id) where client_request_id is not null;
      create unique index on transactions (user_id, import_source_key) where import_source_key is not null;
      create table workflows (
        id uuid primary key default gen_random_uuid(), user_id text not null,
        client_request_id text, name text, type text, amount numeric,
        description text, category text, payment_method text, split_amount numeric
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
  } finally {
    await database?.end({ timeout: 2 });
    if (started) execFileSync("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"], { stdio: "pipe" });
    rmSync(directory, { recursive: true, force: true });
  }
});
