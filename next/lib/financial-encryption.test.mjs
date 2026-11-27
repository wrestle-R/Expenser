import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import postgres from "postgres";
import { createFinancialCipher } from "./financial-encryption.mjs";
import { backfillFinancialEncryption, verifyFinancialEncryptionBackfill } from "./financial-encryption-backfill.mjs";
import { calculateEncryptedBalanceSnapshot } from "./encrypted-balance-snapshot.mjs";
import { processEncryptedWorkflows } from "./encrypted-workflow-scheduler.mjs";
import { insertEncryptedTransaction } from "./encrypted-transaction-storage.mjs";
import { cutOverEncryptedStorage } from "./financial-encryption-cutover.mjs";
import { markEncryptedWriter } from "./financial-records.mjs";
import { financialRouteFixture } from "./financial-route-fixture.mjs";

const key = () => randomBytes(32).toString("base64url");
const fixtureRecord = { kind: "transactions", ownerId: "owner", recordId: "transaction" };
const fixtureFields = { amount: 341.17, description: "Gym membership", category: "fitness" };
const keys = { first: key(), second: key() };
const lookupKey = key();
const cipher = createFinancialCipher({ activeKeyId: "first", keys, lookupKey });

test("financial payloads round-trip without revealing values or making repeated ciphertext predictable", () => {
  const first = cipher.seal(fixtureRecord, fixtureFields);
  const second = cipher.seal(fixtureRecord, fixtureFields);
  assert.deepEqual(cipher.open(fixtureRecord, first), fixtureFields);
  assert.notEqual(first.nonce, second.nonce);
  assert.notEqual(first.ciphertext, second.ciphertext);
  assert.doesNotMatch(JSON.stringify(first), /Gym membership|fitness|341\.17/);
});

test("tampering or transplanting a payload to another row or tenant fails authentication", () => {
  const sealed = cipher.seal(fixtureRecord, fixtureFields);
  for (const changed of [
    { ...fixtureRecord, ownerId: "wrong-owner" },
    { ...fixtureRecord, recordId: "wrong-transaction" },
    { ...fixtureRecord, kind: "balances" },
  ]) {
    assert.throws(() => cipher.open(changed, sealed), /authentication failed/);
  }
  const altered = Buffer.from(sealed.ciphertext, "base64url");
  altered[0] ^= 1;
  assert.throws(() => cipher.open(fixtureRecord, { ...sealed, ciphertext: altered.toString("base64url") }), /authentication failed/);
});

test("rotation keeps previous ciphertext readable and preserves scoped lookup behavior", () => {
  const rotated = createFinancialCipher({ activeKeyId: "second", keys, lookupKey });
  assert.deepEqual(rotated.open(fixtureRecord, cipher.seal(fixtureRecord, fixtureFields)), fixtureFields);
  assert.equal(rotated.seal(fixtureRecord, fixtureFields).keyId, "second");
  const same = rotated.lookup("owner", "bank-reference", "same-reference");
  assert.equal(same, cipher.lookup("owner", "bank-reference", "same-reference"));
  assert.notEqual(same, rotated.lookup("other-owner", "bank-reference", "same-reference"));
  assert.notEqual(same, rotated.lookup("owner", "transaction-import", "same-reference"));
});

const stagingUrl = process.env.EXPENSER_EPHEMERAL_ENCRYPTION_TEST_URL;

test("backfills a disposable ledger, survives re-runs, and refreshes changed ciphertext", { skip: !stagingUrl }, async () => {
  // The fixture bootstraps tables from scratch. Only accept a local disposable database.
  const url = new URL(stagingUrl);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname));
  assert.equal(url.pathname, "/expenser_encryption_test");
  const db = postgres(stagingUrl, { max: 1, onnotice: () => {} });
  const owner = "00000000-0000-4000-8000-000000000001";

  try {
    assert.equal((await db`select to_regclass('public.transactions') as existing`)[0].existing, null);
    await db.unsafe("create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql as 'select null::uuid';");
    for (const name of [
      "001_reset_expenser_supabase_auth.sql",
      "004_reconciliation_uses_opening_balances.sql",
      "005_scheduled_workflows.sql",
      "006_isolate_scheduled_workflow_failures.sql",
      "008_prepare_financial_encryption.sql",
    ]) {
      await db.unsafe(readFileSync(new URL(`../../supabase/${name}`, import.meta.url), "utf8"));
    }
    await db`insert into auth.users (id) values (${owner})`;
    await db`insert into public.users (user_id, name) values (${owner}, 'Private profile')`;
    await db`
      update balances set opening_balance = 500, opening_at = '2026-11-01'
      where user_id = ${owner}
    `;
    const [entry] = await db`
      insert into public.transactions (user_id, amount, description, category, type, payment_method, import_source_key, split_amount, date)
      values (${owner}, 341.17, 'Gym membership', 'fitness', 'expense', 'bank', 'unique-alert', 40, '2026-11-27')
      returning id
    `;
    await db`
      insert into public.transactions (user_id, type, amount, payment_method, date, deleted_at)
      values
        (${owner}, 'income', 20.15, 'cash', '2026-11-27', null),
        (${owner}, 'expense', 50, 'cash', '2026-10-27', null),
        (${owner}, 'income', 25.35, 'splitwise', '2026-11-27', null),
        (${owner}, 'income', 100, 'bank', '2026-11-27', '2026-11-28')
    `;
    await db`insert into public.user_categories (user_id, name, type) values (${owner}, 'Fitness', 'expense')`;
    const counts = await backfillFinancialEncryption(db, cipher, { pageSize: 1 });
    assert.equal(counts.transactions, 5);
    assert.equal(counts.balances, 3);
    assert.equal(counts.user_categories, 1);
    assert.deepEqual(await verifyFinancialEncryptionBackfill(db, cipher, { pageSize: 1 }), counts);
    const legacy = Object.fromEntries(
      (await db`select payment_method, current_balance from balances where user_id = ${owner}`)
        .map((row) => [row.payment_method, Number(row.current_balance)]),
    );
    const encrypted = await db.begin((tx) => calculateEncryptedBalanceSnapshot(tx, cipher, owner));
    assert.deepEqual(encrypted, { bank: 158.83, cash: 520.15, splitwise: 565.35 });
    assert.deepEqual(encrypted, legacy);

    const getCiphertext = async () => (await db`
      select envelope, import_lookup from expenser_private.financial_payloads
      where owner_id = ${owner} and record_kind = 'transactions' and record_id = ${entry.id}
    `)[0];
    const record = { kind: "transactions", ownerId: owner, recordId: entry.id };
    const before = await getCiphertext();
    assert.equal(cipher.open(record, before.envelope).description, "Gym membership");
    assert.equal(before.import_lookup, cipher.lookup(owner, "transaction-import", "unique-alert"));
    assert.doesNotMatch(JSON.stringify(before), /Gym membership|fitness|unique-alert|341\.17/);

    await backfillFinancialEncryption(db, cipher, { pageSize: 1 });
    assert.deepEqual(await getCiphertext(), before);
    await db`update public.transactions set description = 'Updated gym membership' where id = ${entry.id}`;
    await assert.rejects(verifyFinancialEncryptionBackfill(db, cipher), /does not match a transactions source row/);
    await backfillFinancialEncryption(db, cipher);
    const after = await getCiphertext();
    assert.notEqual(after.envelope.nonce, before.envelope.nonce);
    assert.equal(cipher.open(record, after.envelope).description, "Updated gym membership");
    assert.deepEqual(await verifyFinancialEncryptionBackfill(db, cipher), counts);

    await cutOverEncryptedStorage(db, cipher);
    await assert.rejects(cutOverEncryptedStorage(db, cipher), /already applied/);
    const [neutral] = await db`select amount, description, category, import_source_key from transactions where id = ${entry.id}`;
    assert.deepEqual({ ...neutral }, { amount: 0, description: "", category: "General", import_source_key: null });
    await assert.rejects(db`update transactions set deleted_at = now() where id = ${entry.id}`, { code: "23514" });
    await assert.rejects(db`update transactions set description = 'plaintext' where id = ${entry.id}`, { code: "23514" });
    await assert.rejects(db`insert into transactions (user_id, type, payment_method) values (${owner}, 'expense', 'bank')`, { code: "23514" });

    const transactions = financialRouteFixture(db, cipher, owner, "transactions");
    const firstPage = await transactions("GET", undefined, "?limit=2");
    assert.equal(firstPage.status, 200);
    const paged = await firstPage.json();
    assert.equal(paged.transactions.length, 2);
    assert.ok(paged.nextCursor);
    const secondPage = await transactions("GET", undefined, "?limit=2&cursor=" + encodeURIComponent(paged.nextCursor));
    assert.equal(secondPage.status, 200);
    assert.equal((await secondPage.json()).transactions.length, 2);
    const profile = financialRouteFixture(db, cipher, owner, "user/profile");
    assert.equal((await (await profile("GET")).json()).profile.name, "Private profile");
    const ownProfile = await profile("PUT", { name: "Changed profile", occupation: "Private job", balances: { bank: 1000 } });
    assert.equal(ownProfile.status, 200);
    assert.equal((await ownProfile.json()).profile.balances.bank, 1000);
    assert.equal((await db`select name from users where user_id = ${owner}`)[0].name, "");
    const categories = financialRouteFixture(db, cipher, owner, "categories");
    assert.equal((await categories("GET")).status, 200);
    const category = await categories("POST", { name: "fitness", type: "expense", color: "#123456" });
    assert.equal(category.status, 201);
    assert.equal((await category.json()).category.name, "fitness");

    const date = new Date(Date.now() + 60_000).toISOString();
    const base = { type: "expense", paymentMethod: "bank", amount: 50, description: "Fixture expense", category: "fitness", date };
    const created = await transactions("POST", { ...base, clientRequestId: "expense-retry" });
    assert.equal(created.status, 201);
    const { transaction: expense } = await created.json();
    assert.equal((await transactions("POST", { ...base, clientRequestId: "expense-retry" })).status, 200);
    const exchange = await transactions("POST", { ...base, type: "income", category: "exchange",
      amount: 20, exchangeExpenseId: expense._id });
    assert.equal(exchange.status, 201);
    assert.equal((await transactions("DELETE", undefined, "?id=" + expense._id)).status, 400);
    assert.equal((await transactions("PUT", { amount: 15 }, "?id=" + expense._id)).status, 400);

    const importRecord = { ...base, date: new Date(Date.now() + 120_000).toISOString(),
      importedBankBalance: 901.25, importSource: "fixture", importSourceKey: "bank-alert",
      importedAccountSuffix: "4321", importedBankReference: "reference-1" };
    assert.equal((await transactions("POST", importRecord)).status, 201);
    assert.equal((await transactions("POST", { ...importRecord, importSourceKey: "same-reference-other-key" })).status, 200);
    const reconcile = financialRouteFixture(db, cipher, owner, "bank-imports/reconcile");
    const { alerts } = await (await reconcile("GET")).json();
    assert.equal(alerts[0].bankBalance, 901.25);
    const resolution = await reconcile("POST", { id: alerts[0]._id, action: "apply" });
    assert.equal(resolution.status, 200);
    assert.equal((await resolution.json()).profile.balances.bank, 901.25);
    assert.equal((await (await reconcile("GET")).json()).alerts.length, 0);
    const other = "00000000-0000-4000-8000-000000000002";
    await db`insert into auth.users (id) values (${other})`;
    const otherTransactions = financialRouteFixture(db, cipher, other, "transactions");
    assert.equal((await (await otherTransactions("GET")).json()).transactions.length, 0);
    assert.equal((await otherTransactions("PUT", { amount: 1 }, "?id=" + expense._id)).status, 404);

    const due = "2026-11-27T09:00:00Z";
    const schedule = { enabled: true, time: "09:00", timeZone: "UTC", days: [5] };
    const workflows = financialRouteFixture(db, cipher, owner, "workflows");
    const template = { name: "College shuttle", description: "", type: "expense", amount: 65.50,
      category: "college", paymentMethod: "cash", schedule, clientRequestId: "workflow-fixture" };
    const create = await workflows("POST", template);
    assert.equal(create.status, 201);
    const { workflow: healthy } = await create.json();
    const repeated = await workflows("POST", template);
    assert.equal((await repeated.json()).workflow._id, healthy._id);
    const { schedule: _schedule, ...legacyTemplate } = template;
    assert.equal((await workflows("PUT", legacyTemplate, "?id=" + healthy._id)).status, 200);
    assert.deepEqual((await db`select schedule from workflows where id = ${healthy._id}`)[0].schedule, schedule);
    const damagedResponse = await workflows("POST", { ...template, name: "Other route", category: "travel", amount: 40, clientRequestId: "damaged-fixture" });
    assert.equal(damagedResponse.status, 201);
    const { workflow: damaged } = await damagedResponse.json();
    await db.begin(async (tx) => { await markEncryptedWriter(tx);
      await tx`update workflows set next_run_at = ${due} where user_id = ${owner}`;
    });
    await db`
      update expenser_private.financial_payloads set envelope = jsonb_set(envelope, '{tag}', '"invalid"')
      where record_kind = 'workflows' and owner_id = ${owner} and record_id = ${damaged._id}
    `;
    const storeScheduled = (tx, input) => insertEncryptedTransaction(tx, cipher, input);
    const runOptions = { runUntil: "2026-11-27T09:01:00Z", ownerId: owner };
    assert.deepEqual(await processEncryptedWorkflows(db, cipher, storeScheduled, runOptions), {
      processed: 1, retrying: 1,
    });
    assert.deepEqual(await processEncryptedWorkflows(db, cipher, storeScheduled, runOptions), {
      processed: 0, retrying: 0,
    });
    const occurrences = await db`
      select occurrence.workflow_id, entry.id as record_id, entry.amount as legacy_amount, payload.envelope
      from workflow_occurrences occurrence
      join transactions entry on entry.id = occurrence.transaction_id
      join expenser_private.financial_payloads payload
        on payload.record_kind = 'transactions' and payload.owner_id = entry.user_id
        and payload.record_id = entry.id::text
      where occurrence.user_id = ${owner}
    `;
    assert.equal(occurrences.length, 1);
    assert.equal(occurrences[0].workflow_id, healthy._id);
    assert.equal(occurrences[0].legacy_amount, 0);
    const generated = cipher.open({ kind: "transactions", ownerId: owner, recordId: occurrences[0].record_id }, occurrences[0].envelope);
    assert.equal(generated.amount, 65.50);
    assert.equal(generated.description, "College shuttle");
    const [savedCash] = await db`
      select envelope from expenser_private.financial_payloads
      where record_kind = 'balances' and owner_id = ${owner} and record_id = 'cash'
    `;
    assert.equal(cipher.open({ kind: "balances", ownerId: owner, recordId: "cash" }, savedCash.envelope).current_balance, 454.65);
  } finally {
    await db.end();
  }
});
