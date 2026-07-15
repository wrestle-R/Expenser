import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getApiErrorResponse } from "@/lib/api-errors";
import {
  mapUserRow,
  sql,
  type BalanceRow,
  type PaymentMethod,
  type UserRow,
} from "@/lib/db";

const PAYMENT_METHODS: PaymentMethod[] = ["bank", "cash", "splitwise"];

function jsonApiError(error: unknown, fallbackMessage: string) {
  const response = getApiErrorResponse(error, fallbackMessage);
  return NextResponse.json(response.body, { status: response.status });
}

function sanitizeText(
  value: unknown,
  {
    field,
    maxLength,
    fallback,
  }: { field: string; maxLength: number; fallback?: string }
) {
  const normalized = typeof value === "string" ? value.trim() : fallback ?? "";
  if (normalized.length > maxLength) {
    throw new Error(`${field} must be ${maxLength} characters or fewer`);
  }
  return normalized;
}

function parsePaymentMethods(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value.filter((method): method is PaymentMethod =>
        PAYMENT_METHODS.includes(method as PaymentMethod)
      )
    )
  );
}

function parseBalanceUpdates(value: unknown) {
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;

  return PAYMENT_METHODS.flatMap((paymentMethod) => {
    if (record[paymentMethod] == null) return [];
    const amount = Number(record[paymentMethod]);
    if (!Number.isFinite(amount)) {
      throw new Error(`${paymentMethod} balance must be a valid number`);
    }
    return [{ paymentMethod, amount }];
  });
}

async function loadBalanceRows(userId: string) {
  return sql<BalanceRow[]>`
    select * from balances
    where user_id = ${userId}
    order by payment_method
  `;
}

export async function GET(req: Request) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let users = await sql<UserRow[]>`
      select * from users where user_id = ${authUser.userId} limit 1
    `;

    if (!users[0]) {
      users = await sql<UserRow[]>`
        insert into users (
          user_id, email, name, occupation, payment_methods,
          onboarded, dashboard_tutorial_completed
        ) values (
          ${authUser.userId}, ${authUser.email}, ${authUser.name}, ${""}, ${[]},
          ${false}, ${false}
        )
        returning *
      `;
    }

    await sql`select recalculate_user_balances(${authUser.userId})`;
    const balances = await loadBalanceRows(authUser.userId);
    return NextResponse.json({ profile: mapUserRow(users[0], balances) });
  } catch (error) {
    console.error("[API /user/profile GET] Error:", error);
    return jsonApiError(error, "Failed to load profile");
  }
}

export async function PUT(req: Request) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = (await req.json()) as Record<string, unknown>;
    const name = sanitizeText(data.name, { field: "name", maxLength: 120 });
    const occupation = sanitizeText(data.occupation, {
      field: "occupation",
      maxLength: 120,
    });
    const parsedMethods = parsePaymentMethods(data.paymentMethods);
    const balanceUpdates = parseBalanceUpdates(data.balances);

    const result = await sql.begin(async (tx) => {
      const trx = tx as unknown as typeof sql;
      const existingRows = (await trx`
        select * from users where user_id = ${authUser.userId} limit 1 for update
      `) as UserRow[];
      const existing = existingRows[0];
      let user: UserRow;

      if (!existing) {
        const inserted = (await trx`
          insert into users (
            user_id, email, name, occupation, payment_methods,
            onboarded, dashboard_tutorial_completed
          ) values (
            ${authUser.userId}, ${authUser.email}, ${name}, ${occupation},
            ${Array.isArray(data.paymentMethods) ? parsedMethods : []},
            ${Boolean(data.onboarded ?? false)},
            ${Boolean(data.dashboardTutorialCompleted ?? false)}
          ) returning *
        `) as UserRow[];
        user = inserted[0];
      } else {
        const updated = (await trx`
          update users set
            email = ${authUser.email || existing.email},
            name = ${typeof data.name === "string" ? name : existing.name},
            occupation = ${typeof data.occupation === "string" ? occupation : existing.occupation},
            payment_methods = ${Array.isArray(data.paymentMethods) ? parsedMethods : existing.payment_methods},
            onboarded = ${typeof data.onboarded === "boolean" ? data.onboarded : existing.onboarded},
            dashboard_tutorial_completed = ${
              typeof data.dashboardTutorialCompleted === "boolean"
                ? data.dashboardTutorialCompleted
                : existing.dashboard_tutorial_completed
            }
          where user_id = ${authUser.userId}
          returning *
        `) as UserRow[];
        user = updated[0];
      }

      for (const balance of balanceUpdates) {
        await trx`
          insert into balances (
            user_id, payment_method, opening_balance, opening_at, current_balance
          ) values (
            ${authUser.userId}, ${balance.paymentMethod}, ${balance.amount},
            timezone('utc', now()), ${balance.amount}
          )
          on conflict (user_id, payment_method) do update set
            opening_balance = excluded.opening_balance,
            opening_at = excluded.opening_at,
            current_balance = excluded.current_balance
        `;
      }

      await trx`select recalculate_user_balances(${authUser.userId})`;
      const balances = (await trx`
        select * from balances where user_id = ${authUser.userId}
        order by payment_method
      `) as BalanceRow[];
      return { user, balances };
    });

    return NextResponse.json({
      profile: mapUserRow(result.user, result.balances),
    });
  } catch (error) {
    console.error("[API /user/profile PUT] Error:", error);
    return jsonApiError(error, "Failed to update profile");
  }
}
