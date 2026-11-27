import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { webcrypto } from "node:crypto";
import * as balance from "./bank-import-balance.js";
import errors from "./api-errors.js";
import * as reviews from "./transaction-review.js";
import * as pages from "./transaction-pagination.js";
import * as history from "./balance-reconciliation.js";
import * as paymentMethods from "./payment-methods.js";
import * as dates from "./iso-date.js";
import * as schedule from "./workflow-schedule.js";
import * as records from "./financial-records.mjs";
import * as transactionStorage from "./encrypted-transaction-storage.mjs";
import * as scheduler from "./encrypted-workflow-scheduler.mjs";

const require = createRequire(import.meta.url);
const ts = require("typescript");

function load(path, dependencies, context = {}) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  runInNewContext(source, {
    exports, require(name) { return dependencies[name] ?? require(name); },
    console: { error() {} }, Date, URL, Error, crypto: webcrypto, ...context,
  });
  return exports;
}

export function financialRouteFixture(sql, cipher, ownerId, path) {
  const db = load("./db.ts", { postgres: () => sql, "./payment-methods.js": paymentMethods, "./iso-date.js": dates }, {
    process: { env: { DATABASE_URL: "fixture", NODE_ENV: "test" } },
    global: { postgresSql: sql },
  });
  const financialDb = load("./financial-db.ts", {
    "./db": db, "./financial-encryption.mjs": { loadFinancialCipher: () => cipher },
    "./financial-records.mjs": records,
  });
  const runEncryptedWorkflows = (userId) => scheduler.processEncryptedWorkflows(
    sql, cipher, (tx, input) => transactionStorage.insertEncryptedTransaction(tx, cipher, input), { ownerId: userId },
  );
  const api = load(`../app/api/${path}/route.ts`, {
    "@/lib/db": db,
    "@/lib/auth": { getAuthenticatedUser: () => Promise.resolve(ownerId ? { userId: ownerId, name: "Fixture", email: "fixture@example.test" } : null) },
    "@/lib/financial-db": financialDb,
    "@/lib/financial-records.mjs": records,
    "@/lib/encrypted-transaction-storage.mjs": transactionStorage,
    "@/lib/run-encrypted-workflows": { runEncryptedWorkflows },
    "@/lib/transaction-review.js": reviews,
    "@/lib/transaction-pagination.js": pages,
    "@/lib/bank-import-balance.js": balance,
    "@/lib/balance-reconciliation": history,
    "@/lib/payment-methods.js": paymentMethods,
    "@/lib/workflow-schedule.js": schedule,
    "@/lib/api-errors": errors,
  });
  return (method, body, query = "") => api[method](
    new Request(`http://localhost/api/${path}${query}`, { method, body: body === undefined ? undefined : JSON.stringify(body) }),
  );
}
