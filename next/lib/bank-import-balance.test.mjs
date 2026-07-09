import assert from "node:assert/strict";
import { test } from "node:test";

import { getLatestImportedBankBalance } from "./bank-import-balance.js";

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
