import { NextResponse } from "next/server";
import { financialRead, financialWrite, hydrate, type Cipher } from "@/lib/financial-db";
import { readEncryptedBalances, rebaseEncryptedBalance, refreshEncryptedBalances } from "@/lib/encrypted-transaction-storage.mjs";
import {
  getBalanceReconciliationStats,
  sortBalanceReconciliationHistory,
} from "@/lib/balance-reconciliation";
import { getAuthenticatedUser } from "@/lib/auth";
import { getReconciliationOpeningBalance } from "@/lib/bank-import-balance.js";
import {
  mapBalanceReconciliationAlertRow,
  mapUserRow,
  sql,
  type TransactionRow,
  type BalanceReconciliationAlertRow,
  type UserRow,
} from "@/lib/db";


async function loadLatestBalanceAlert(db: typeof sql, key: Cipher, userId: string) {
  const metadata = await db<(TransactionRow & { transaction_date: string })[]>`
    select entry.*, entry.date::text as transaction_date
    from transactions entry
    join balances bank on bank.user_id = entry.user_id and bank.payment_method = 'bank'
    where entry.user_id = ${userId} and entry.deleted_at is null and entry.date > bank.opening_at
    order by entry.date desc, entry.created_at desc, entry.id desc
  `;
  const latest = (await hydrate(db, key, "transactions", userId, metadata))
    .find((row) => row.payment_method === "bank" && row.imported_bank_balance != null);
  if (!latest) return undefined;
  const rows = await db<BalanceReconciliationAlertRow[]>`
    select * from balance_reconciliation_alerts
    where user_id = ${userId} and transaction_id = ${latest.id} and status = 'pending'
    order by created_at desc, id desc limit 1
  `;
  const [alert] = await hydrate(db, key, "balance_reconciliation_alerts", userId, rows);
  return alert ? { ...alert, transaction_date: latest.transaction_date } : undefined;
}

export async function GET(req: Request) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = authUser.userId;
    const includeHistory =
      new URL(req.url).searchParams.get("includeHistory") === "true";

    return await financialRead(async (db, key) => {
      const alert = await loadLatestBalanceAlert(db, key, userId);
      const alerts = alert ? [mapBalanceReconciliationAlertRow(alert)] : [];
      if (!includeHistory) return NextResponse.json({ alerts });
      const rows = await db<BalanceReconciliationAlertRow[]>`
        select * from balance_reconciliation_alerts where user_id = ${userId} order by created_at desc
      `;
      const fullHistory = sortBalanceReconciliationHistory(
        (await hydrate(db, key, "balance_reconciliation_alerts", userId, rows)).map(mapBalanceReconciliationAlertRow),
      );
      return NextResponse.json({ alerts, history: fullHistory.slice(0, 20), stats: getBalanceReconciliationStats(fullHistory) });
    });
  } catch (error) {
    console.error("[API /bank-imports/reconcile GET] Error:", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ error: "Failed to load balance alerts" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = authUser.userId;

    const body = (await req.json()) as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id : "";
    const action = body.action;
    if (!id) {
      return NextResponse.json({ error: "Alert ID required" }, { status: 400 });
    }
    if (action !== "apply" && action !== "keep") {
      return NextResponse.json({ error: "Action must be apply or keep" }, { status: 400 });
    }

    const result = await financialWrite(userId, async (trx, key) => {
      const alert = await loadLatestBalanceAlert(trx, key, userId);
      if (!alert || alert.id !== id) {
        return null;
      }

      const openingBalance = getReconciliationOpeningBalance(
        {
          expectedBalance: Number(alert.expected_balance),
          bankBalance: Number(alert.bank_balance),
        },
        action
      );
      await rebaseEncryptedBalance(trx, key, userId, "bank", openingBalance, alert.transaction_date);
      await refreshEncryptedBalances(trx, key, userId);
      const rows = await trx<UserRow[]>`select * from users where user_id = ${userId}`;
      const [user] = await hydrate(trx, key, "users", userId, rows);
      const profile = user ? mapUserRow(user, await readEncryptedBalances(trx, key, userId)) : null;
      const updatedAlerts = (await trx`
        update balance_reconciliation_alerts
        set
          status = ${action === "apply" ? "applied" : "kept"},
          resolved_at = timezone('utc', now())
        where user_id = ${userId}
          and payment_method = ${alert.payment_method}
          and status = 'pending'
        returning *
      `) as BalanceReconciliationAlertRow[];

      return {
        alert: { ...alert, ...updatedAlerts.find((row) => row.id === id),
          expected_balance: alert.expected_balance, bank_balance: alert.bank_balance,
          difference: alert.difference, source: alert.source },
        profile,
      };
    });

    if (!result) {
      return NextResponse.json({ error: "Balance alert changed. Refresh to review the latest balance." }, { status: 409 });
    }

    return NextResponse.json({
      alert: mapBalanceReconciliationAlertRow(result.alert),
      profile: result.profile,
    });
  } catch (error) {
    console.error("[API /bank-imports/reconcile POST] Error:", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ error: "Failed to resolve balance alert" }, { status: 500 });
  }
}
