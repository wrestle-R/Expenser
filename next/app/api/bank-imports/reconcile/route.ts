import { NextResponse } from "next/server";
import {
  getBalanceReconciliationStats,
  sortBalanceReconciliationHistory,
} from "@/lib/balance-reconciliation";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  mapBalanceReconciliationAlertRow,
  mapUserRow,
  sql,
  type BalanceRow,
  type BalanceReconciliationAlertRow,
  type UserRow,
} from "@/lib/db";

export async function GET(req: Request) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = authUser.userId;
    const includeHistory =
      new URL(req.url).searchParams.get("includeHistory") === "true";

    const alerts = await sql<BalanceReconciliationAlertRow[]>`
      select *
      from balance_reconciliation_alerts
      where user_id = ${userId}
        and status = 'pending'
      order by created_at desc
    `;

    const mappedAlerts = alerts.map(mapBalanceReconciliationAlertRow);
    if (!includeHistory) {
      return NextResponse.json({ alerts: mappedAlerts });
    }

    const historyRows = await sql<BalanceReconciliationAlertRow[]>`
      select *
      from balance_reconciliation_alerts
      where user_id = ${userId}
      order by created_at desc
    `;
    const fullHistory = sortBalanceReconciliationHistory(
      historyRows.map(mapBalanceReconciliationAlertRow)
    );
    const history = fullHistory.slice(0, 20);

    return NextResponse.json({
      alerts: mappedAlerts,
      history,
      stats: getBalanceReconciliationStats(fullHistory),
    });
  } catch (error) {
    console.error("[API /bank-imports/reconcile GET] Error:", error);
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

    const result = await sql.begin(async (tx) => {
      const trx = tx as unknown as typeof sql;
      const alerts = (await trx`
        select *
        from balance_reconciliation_alerts
        where id = ${id}
          and user_id = ${userId}
          and status = 'pending'
        limit 1
        for update
      `) as BalanceReconciliationAlertRow[];

      const alert = alerts[0];
      if (!alert) {
        return null;
      }

      let profile = null;
      if (action === "apply") {
        await trx`
          insert into balances (
            user_id, payment_method, opening_balance, opening_at, current_balance
          ) values (
            ${userId}, 'bank', ${Number(alert.bank_balance)},
            timezone('utc', now()), ${Number(alert.bank_balance)}
          )
          on conflict (user_id, payment_method) do update set
            opening_balance = excluded.opening_balance,
            opening_at = excluded.opening_at,
            current_balance = excluded.current_balance
        `;
        await trx`select recalculate_user_balances(${userId})`;
        const users = (await trx`
          select * from users where user_id = ${userId} limit 1
        `) as UserRow[];
        const balances = (await trx`
          select * from balances where user_id = ${userId}
          order by payment_method
        `) as BalanceRow[];
        profile = users[0] ? mapUserRow(users[0], balances) : null;
      }

      const updatedAlerts = (await trx`
        update balance_reconciliation_alerts
        set
          status = ${action === "apply" ? "applied" : "kept"},
          resolved_at = timezone('utc', now())
        where id = ${id}
          and user_id = ${userId}
        returning *
      `) as BalanceReconciliationAlertRow[];

      return {
        alert: updatedAlerts[0],
        profile,
      };
    });

    if (!result) {
      return NextResponse.json({ error: "Balance alert not found" }, { status: 404 });
    }

    return NextResponse.json({
      alert: mapBalanceReconciliationAlertRow(result.alert),
      profile: result.profile,
    });
  } catch (error) {
    console.error("[API /bank-imports/reconcile POST] Error:", error);
    return NextResponse.json({ error: "Failed to resolve balance alert" }, { status: 500 });
  }
}
