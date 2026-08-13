import assert from "node:assert/strict";
import { test } from "node:test";

import {
  calculateImportedBalanceMismatch,
  getLatestImportedBankBalance,
  getReconciliationOpeningBalance,
} from "./bank-import-balance.js";

test("uses the newest active imported bank balance", () => {
  const latest = getLatestImportedBankBalance([
    {
      importedBankBalance: 5239.58,
      importedAccountSuffix: "4280",
      importSource: "union_bank_notification",
      date: "2026-07-05T09:33:59.000Z",
    },
    {
      importedBankBalance: 626.58,
      importedAccountSuffix: "4280",
      importSource: "union_bank_notification",
      date: "2026-06-29T01:51:47.000Z",
    },
  ]);

  assert.equal(latest, 5239.58);
});

test("ignores deleted and non-bank-import transactions when choosing imported balance", () => {
  const latest = getLatestImportedBankBalance([
    {
      importedBankBalance: 9999,
      importedAccountSuffix: "4280",
      importSource: "union_bank_notification",
      date: "2026-07-06T09:33:59.000Z",
      deletedAt: "2026-07-06T10:00:00.000Z",
    },
    {
      importedBankBalance: undefined,
      importedAccountSuffix: undefined,
      importSource: undefined,
      date: "2026-07-05T09:33:59.000Z",
    },
    {
      importedBankBalance: 5239.58,
      importedAccountSuffix: "4280",
      importSource: "union_bank_notification",
      date: "2026-07-05T09:33:59.000Z",
    },
  ]);

  assert.equal(latest, 5239.58);
});

test("compares the reported balance with the expected post-transaction balance", () => {
  assert.deepEqual(
    calculateImportedBalanceMismatch({
      currentBalance: 29.18,
      type: "income",
      amount: 10000,
      reportedBalance: 10029.18,
    }),
    { expectedBalance: 10029.18, difference: 0, shouldAlert: false }
  );

  assert.deepEqual(
    calculateImportedBalanceMismatch({
      currentBalance: 100,
      type: "expense",
      amount: 20,
      reportedBalance: 70,
    }),
    { expectedBalance: 80, difference: -10, shouldAlert: true }
  );
});

test("reconciliation actions choose the correct post-transaction opening balance", () => {
  const alert = { expectedBalance: 80, bankBalance: 70 };
  assert.equal(getReconciliationOpeningBalance(alert, "apply"), 70);
  assert.equal(getReconciliationOpeningBalance(alert, "keep"), 80);
});
