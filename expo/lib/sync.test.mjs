import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
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
function harness() {
  const values = new Map();
  const asyncStorage = {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); },
    multiRemove: async (keys) => { keys.forEach((key) => values.delete(key)); },
  };
  const storage = loadTs("./storage.ts", {
    "@react-native-async-storage/async-storage": { default: asyncStorage },
    "./outbox": outbox, "./payment-methods.js": paymentMethods,
  });
  class ApiError extends Error { constructor(message, status) { super(message); this.status = status; } }
  const server = [];
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
    "@react-native-community/netinfo": { default: { fetch: async () => ({ isConnected: true, isInternetReachable: true }) } },
    "./api": { api, ApiError }, "./storage": storage, "./transaction-state.js": transactionState,
  });
  const statuses = [];
  syncService.subscribe((status) => statuses.push(status));
  return { storage, api, syncService, server, statuses };
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
