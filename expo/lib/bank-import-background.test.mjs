import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";

const ts = createRequire(import.meta.url)("typescript");
const source = ts.transpileModule(readFileSync(new URL("./bank-import-background.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function backgroundTask({ account = "owner", canUpload = true } = {}) {
  let run;
  const calls = [];
  const imports = {
    "react-native": { AppState: { currentState: "background" }, Platform: { OS: "android" } },
    "expo-background-task": { BackgroundTaskResult: { Success: "success", Failed: "failed" } },
    "expo-task-manager": { defineTask: (_name, task) => { run = task; } },
    "./bank-imports": {
      getBankNotificationAccessEnabled: () => true,
      getQueuedRawBankImportCandidates: (owner, unattendedOnly) => {
        assert.equal(owner, "owner");
        assert.equal(unattendedOnly, true);
        return [{ sourceKey: "test-alert" }];
      },
      clearQueuedRawBankImportCandidates: keys => calls.push(["clear", ...keys]),
    },
    "./api": { api: {
      parseBankNotification: async (candidate, allowCloud, token) => {
        calls.push(["parse", candidate.sourceKey, allowCloud, token]);
        return { kind: "transaction", importSourceKey: "test-transaction" };
      },
      createTransaction: async (payload, token) => {
        calls.push(["upload", payload.importSourceKey, token]);
        if (!canUpload) throw new Error("offline");
      },
    } },
    "./bank-import-result": { parsedResponsePayload: result => result },
    "./notifications": { notificationService: {
      notifyBankReview: async (key, kind) => { calls.push(["notify", key, kind]); },
    } },
    "./storage": { getStoredProfile: async () => ({ userId: "owner" }) },
    "./supabase": { supabase: { auth: {
      getSession: async () => ({ data: { session: { user: { id: account }, access_token: "fixture-token" } } }),
    } } },
  };
  runInNewContext(source, { exports: {}, require: name => imports[name] });
  return { run: () => run({}), calls };
}

test("uploads a bank alert under its owner and clears it after the server confirms", async () => {
  const task = backgroundTask();
  assert.equal(await task.run(), "success");
  assert.deepEqual(task.calls, [
    ["parse", "test-alert", true, "fixture-token"],
    ["upload", "test-transaction", "fixture-token"],
    ["clear", "test-alert"],
    ["notify", "test-transaction", "transaction"],
  ]);
});

test("preserves a failed upload and skips work under a different session", async () => {
  const offline = backgroundTask({ canUpload: false });
  assert.equal(await offline.run(), "failed");
  assert.deepEqual(offline.calls.map(([operation]) => operation), ["parse", "upload"]);
  const otherAccount = backgroundTask({ account: "other" });
  assert.equal(await otherAccount.run(), "success");
  assert.deepEqual(otherAccount.calls, []);
});
