import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import * as snapshotStorage from "./snapshot-storage.js";
import * as outbox from "./outbox.js";
import * as transactionState from "./transaction-state.js";
import * as paymentMethods from "./payment-methods.js";

const require = createRequire(import.meta.url);
const ts = require("typescript");
function loadTs(file, dependencies) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  runInNewContext(source, {
    exports, require: (name) => {
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
      return dependencies[name];
    }, console, setTimeout, clearTimeout, Error, Date, Promise,
  });
  return exports;
}
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
function harness({ values = new Map(), server = [], online = true } = {}) {
  const asyncStorage = {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); },
    multiGet: async (keys) => keys.map((key) => [key, values.get(key) ?? null]),
    multiSet: async (pairs) => { pairs.forEach(([key, value]) => values.set(key, value)); },
    multiRemove: async (keys) => { keys.forEach((key) => values.delete(key)); },
  };
  const storage = loadTs("./storage.ts", {
    "@react-native-async-storage/async-storage": { default: asyncStorage },
    "./snapshot-storage": snapshotStorage, "./outbox": outbox, "./payment-methods.js": paymentMethods,
  });
  class ApiError extends Error { constructor(message, status) { super(message); this.status = status; } }
  const api = {
    getTransactions: async () => structuredClone(server),
    getWorkflows: async () => [],
    getProfile: async () => ({ userId: "user", name: "Server", paymentMethods: ["bank"] }),
    createTransaction: async (payload) => {
      const transaction = { ...payload, _id: "server-1", userId: "user" };
      server.push(transaction);
      return transaction;
    },
    updateTransaction: async (id, payload) => {
      const index = server.findIndex((item) => item._id === id);
      assert.notEqual(index, -1);
      server[index] = { ...server[index], ...payload };
      return server[index];
    },
    deleteTransaction: async (id) => {
      const index = server.findIndex((item) => item._id === id);
      assert.notEqual(index, -1);
      server.splice(index, 1);
    },
  };
  const { syncService } = loadTs("./sync.ts", {
    "@react-native-community/netinfo": { default: { fetch: async () => ({ isConnected: online, isInternetReachable: online }) } },
    "./api": { api, ApiError }, "./storage": storage, "./transaction-state.js": transactionState,
  });
  const statuses = [];
  syncService.subscribe((status) => statuses.push(status));
  return { storage, api, syncService, server, statuses, values, ApiError };
}
async function queueCreate(storage) {
  const transaction = { _id: "local-1", clientRequestId: "local-1", amount: 100, date: "2026-10-12", paymentMethod: "bank", userId: "user" };
  await storage.setStoredTransactions([transaction]);
  await storage.enqueueOutbox({ entity: "transaction", entityId: "local-1", action: "create", payload: transaction });
}

test("edits during an upload survive acknowledgement and use the created server ID", async () => {
  const { storage, api, syncService, server } = harness();
  await queueCreate(storage);
  const started = deferred();
  const finish = deferred();
  const create = api.createTransaction;
  api.createTransaction = async (payload) => { started.resolve(); await finish.promise; return create(payload); };
  const syncing = syncService.syncAll();
  await started.promise;
  await storage.updateStoredTransactions((items) => items.map((item) => ({ ...item, amount: 200 })));
  await storage.enqueueOutbox({ entity: "transaction", entityId: "local-1", action: "update", payload: { amount: 200 } });
  finish.resolve();
  await syncing;
  assert.equal(server[0].amount, 200);
  assert.equal((await storage.getOutbox()).length, 0);
  assert.equal((await storage.getStoredTransactions())[0]._id, "server-1");
  await storage.enqueueOutbox({ entity: "transaction", entityId: "local-1", action: "update", payload: { amount: 300 } });
  await syncService.syncAll();
  assert.equal(server[0].amount, 300);
});

test("delete during creation is uploaded after creation, including after a retry", async () => {
  const { storage, api, syncService, server } = harness();
  await queueCreate(storage);
  const create = api.createTransaction;
  let attempts = 0;
  api.createTransaction = async (payload) => {
    if (++attempts === 1) throw new Error("Connection lost");
    return create(payload);
  };
  await syncService.syncAll();
  await storage.setStoredTransactions([]);
  await storage.enqueueOutbox({ entity: "transaction", entityId: "local-1", action: "delete" });
  assert.equal((await storage.getOutbox()).length, 2);
  await syncService.syncAll();
  assert.equal(server.length, 0);
  assert.equal((await storage.getOutbox()).length, 0);
  assert.equal((await storage.getStoredTransactions()).length, 0);
});

test("overlapping sync callers send each queued request once", async () => {
  const { storage, api, syncService } = harness();
  await queueCreate(storage);
  let calls = 0;
  const create = api.createTransaction;
  api.createTransaction = async (payload) => { calls++; return create(payload); };
  await Promise.all([syncService.syncAll(), syncService.syncAll(), syncService.syncAll()]);
  assert.equal(calls, 1);
});

for (const partial of [false, true]) {
  test(`${partial ? "partial" : "total"} refresh failure reports failure and preserves the last successful sync`, async () => {
    const { storage, api, syncService, statuses } = harness();
    await storage.setStoredTransactions([{ _id: "saved", amount: 100 }]);
    await storage.setLastSyncTime(123);
    api.getTransactions = async () => { throw new Error("Unavailable"); };
    if (!partial) {
      api.getWorkflows = api.getTransactions;
      api.getProfile = api.getTransactions;
    }
    assert.equal(await syncService.syncAll(), null);
    assert.equal(await storage.getLastSyncTime(), 123);
    assert.equal((await storage.getStoredTransactions())[0]._id, "saved");
    assert.equal(statuses.at(-1).errorKind, "sync");
    assert.match(statuses.at(-1).error, partial ? /Some data/ : /Could not refresh/);
  });
}

test("a week offline and a process restart preserve edits until an authenticated retry", async () => {
  const first = harness({ online: false });
  await queueCreate(first.storage);
  const operations = await first.storage.getOutbox();
  operations[0].createdAt = "2026-10-16T00:00:00Z";
  await first.storage.setOutbox(operations);
  await first.syncService.syncAll();
  assert.equal((await first.storage.getOutbox()).length, 1);
  const restarted = harness({ values: first.values });
  const create = restarted.api.createTransaction;
  restarted.api.createTransaction = async () => { throw new restarted.ApiError("Expired session", 401); };
  await restarted.syncService.syncAll();
  assert.equal(restarted.statuses.at(-1).errorKind, "auth");
  assert.match(restarted.statuses.at(-1).error, /Sign in again/);
  assert.equal((await restarted.storage.getStoredTransactions()).length, 1);
  assert.equal((await restarted.storage.getOutbox())[0].payload.clientRequestId, "local-1");
  restarted.api.createTransaction = create;
  await restarted.syncService.syncAll();
  assert.equal(restarted.server.length, 1);
  assert.equal(restarted.statuses.at(-1).pendingChanges, 0);
  assert.equal(restarted.statuses.at(-1).error, undefined);
});

test("a lost response after server commit retries the same identity after a process restart", async () => {
  const first = harness();
  await queueCreate(first.storage);
  let calls = 0;
  const idempotentCreate = async (payload) => {
    calls++;
    let row = first.server.find((item) => item.clientRequestId === payload.clientRequestId);
    if (!row) { row = { ...payload, _id: "server-1" }; first.server.push(row); }
    if (calls === 1) throw new Error("Connection lost after commit");
    return row;
  };
  first.api.createTransaction = idempotentCreate;
  await first.syncService.syncAll();
  assert.equal(first.server.length, 1);
  assert.equal((await first.storage.getOutbox())[0].inFlight, true);
  const restarted = harness({ values: first.values, server: first.server });
  restarted.api.createTransaction = idempotentCreate;
  await restarted.syncService.syncAll();
  assert.equal(first.server.length, 1);
  assert.equal((await restarted.storage.getStoredTransactions()).length, 1);
  assert.equal((await restarted.storage.getOutbox()).length, 0);
  assert.equal(calls, 2);
});

test("rejected uploads stay on disk and do not block unrelated changes", async () => {
  const h = harness();
  await queueCreate(h.storage);
  const create = h.api.createTransaction;
  h.api.createTransaction = async (payload) => {
    if (payload.clientRequestId === "local-1") throw new h.ApiError("Invalid category", 422);
    return create(payload);
  };
  await h.storage.enqueueOutbox({ entity: "transaction", entityId: "local-2", action: "create", payload: { clientRequestId: "local-2", amount: 20 } });
  await h.syncService.syncAll();
  assert.equal(h.server.length, 1);
  assert.equal((await h.storage.getOutbox()).length, 1);
  assert.equal(h.statuses.at(-1).rejectedChanges, 1);
  assert.equal((await h.storage.getStoredTransactions()).find((item) => item.clientRequestId === "local-1").amount, 100);
  await h.syncService.syncAll(); // automatic passes must not spin on rejected changes
  assert.equal((await h.storage.getOutbox())[0].rejected, "Invalid category");
  h.api.createTransaction = create;
  await h.syncService.forceRefresh();
  assert.equal((await h.storage.getOutbox()).length, 0);
  assert.equal(h.statuses.at(-1).error, undefined);
});

test("transaction persistence and upload intent survive a restart together; concurrent duplicate imports queue once", async () => {
  const h = harness();
  const transaction = { _id: "sms-1", clientRequestId: "sms-1", amount: 125, importSourceKey: "bank:test:ref:123456", date: "2026-10-23" };
  const add = () => h.storage.saveTransactionChange({ entityId: transaction._id, action: "create", payload: transaction }, (rows) => rows.some((row) => row.importSourceKey === transaction.importSourceKey) ? rows : [transaction, ...rows]);
  await Promise.all([add(), add(), add()]);
  const restarted = harness({ values: h.values });
  assert.equal((await restarted.storage.getStoredTransactions()).length, 1);
  assert.equal((await restarted.storage.getOutbox()).length, 1);
  await restarted.syncService.syncAll();
  assert.equal(restarted.server.length, 1);
});

test("editing a definitively rejected create repairs its payload and resumes upload", async () => {
  const h = harness();
  await queueCreate(h.storage);
  const create = h.api.createTransaction;
  h.api.createTransaction = async (payload) => {
    if (!payload.category) throw new h.ApiError('Choose category', 422);
    return create(payload);
  };
  await h.syncService.syncAll();
  assert.equal(h.statuses.at(-1).rejectedChanges, 1);
  await h.storage.saveTransactionChange({ entityId: 'local-1', action: 'update', payload: { category: 'food' } }, (rows) => rows.map((row) => ({ ...row, category: 'food' })));
  assert.equal((await h.storage.getOutbox()).length, 1);
  assert.equal((await h.storage.getOutbox())[0].rejected, undefined);
  await h.syncService.syncAll();
  assert.equal(h.server[0].category, 'food');
  assert.equal((await h.storage.getOutbox()).length, 0);
});
