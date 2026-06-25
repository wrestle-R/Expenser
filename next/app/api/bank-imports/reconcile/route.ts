import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  mapBalanceReconciliationAlertRow,
  mapUserRow,
  sql,
  type BalanceReconciliationAlertRow,
  type UserRow,
} from "@/lib/db";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const alerts = await sql<BalanceReconciliationAlertRow[]>`
      select *
      from balance_reconciliation_alerts
      where clerk_id = ${userId}
        and status = 'pending'
      order by created_at desc
    `;

    return NextResponse.json({
      alerts: alerts.map(mapBalanceReconciliationAlertRow),
    });
  } catch (error) {
    console.error("[API /bank-imports/reconcile GET] Error:", error);
    return NextResponse.json({ error: "Failed to load balance alerts" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
          and clerk_id = ${userId}
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
        const users = (await trx`
          update users
          set balance_bank = ${Number(alert.bank_balance)}
          where clerk_id = ${userId}
          returning *
        `) as UserRow[];
        profile = users[0] ? mapUserRow(users[0]) : null;
      }

      const updatedAlerts = (await trx`
        update balance_reconciliation_alerts
        set
          status = ${action === "apply" ? "applied" : "kept"},
          resolved_at = timezone('utc', now())
        where id = ${id}
          and clerk_id = ${userId}
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
