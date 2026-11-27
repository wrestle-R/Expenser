import { NextResponse } from "next/server";
import { financialWrite, hydrate } from "@/lib/financial-db";
import { storeFinancialRows } from "@/lib/financial-records.mjs";
import {
  ensureEncryptedBalances, readEncryptedBalances, rebaseEncryptedBalance, refreshEncryptedBalances,
} from "@/lib/encrypted-transaction-storage.mjs";
import { getAuthenticatedUser } from "@/lib/auth";
import { getApiErrorResponse } from "@/lib/api-errors";
import {
  mapUserRow,
  type PaymentMethod,
  type UserRow,
} from "@/lib/db";
import {
  requirePaymentMethods,
  withDefaultPaymentMethod,
} from "@/lib/payment-methods.js";

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

export async function GET(req: Request) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = authUser.userId;
    return await financialWrite(userId, async (db, key) => {
      const [created] = await db<UserRow[]>`
        insert into users (user_id, email, payment_methods) values (${userId}, ${authUser.email}, ${["bank"]})
        on conflict (user_id) do nothing returning *
      `;
      let user: UserRow;
      if (created) {
        user = { ...created, name: authUser.name, occupation: "" };
        await storeFinancialRows(db, key, "users", [user]);
      } else {
        const rows = await db<UserRow[]>`select * from users where user_id = ${userId}`;
        [user] = await hydrate(db, key, "users", userId, rows);
        const methods = withDefaultPaymentMethod(user.payment_methods);
        if (methods.join("|") !== (user.payment_methods ?? []).join("|")) {
          const [metadata] = await db<UserRow[]>`
            update users set payment_methods = ${methods} where user_id = ${userId} returning *
          `;
          user = { ...metadata, name: user.name, occupation: user.occupation };
        }
      }
      await ensureEncryptedBalances(db, key, userId);
      return NextResponse.json({ profile: mapUserRow(user, await readEncryptedBalances(db, key, userId)) });
    });
  } catch (error) {
    console.error("[API /user/profile GET] Error:", error instanceof Error ? error.name : "UnknownError");
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
    const parsedMethods = Array.isArray(data.paymentMethods)
      ? requirePaymentMethods(data.paymentMethods)
      : [];
    const balanceUpdates = parseBalanceUpdates(data.balances);

    const userId = authUser.userId;
    const result = await financialWrite(userId, async (db, key) => {
      const metadata = await db<UserRow[]>`select * from users where user_id = ${userId}`;
      const [existing] = await hydrate(db, key, "users", userId, metadata);
      const methods = Array.isArray(data.paymentMethods) ? parsedMethods : withDefaultPaymentMethod(existing?.payment_methods);
      const [row] = await db<UserRow[]>`
        insert into users (user_id, email, payment_methods, onboarded, dashboard_tutorial_completed)
        values (${userId}, ${authUser.email || existing?.email || ""}, ${methods},
          ${typeof data.onboarded === "boolean" ? data.onboarded : existing?.onboarded ?? Boolean(data.onboarded)},
          ${typeof data.dashboardTutorialCompleted === "boolean" ? data.dashboardTutorialCompleted :
            existing?.dashboard_tutorial_completed ?? Boolean(data.dashboardTutorialCompleted)})
        on conflict (user_id) do update set email = excluded.email, payment_methods = excluded.payment_methods,
          onboarded = excluded.onboarded, dashboard_tutorial_completed = excluded.dashboard_tutorial_completed
        returning *
      `;
      const user = { ...row,
        name: typeof data.name === "string" || !existing ? name : existing.name,
        occupation: typeof data.occupation === "string" || !existing ? occupation : existing.occupation,
      };
      await storeFinancialRows(db, key, "users", [user]);
      await ensureEncryptedBalances(db, key, userId);
      for (const balance of balanceUpdates) {
        await rebaseEncryptedBalance(db, key, userId, balance.paymentMethod, balance.amount);
      }
      if (balanceUpdates.length) await refreshEncryptedBalances(db, key, userId);
      return { user, balances: await readEncryptedBalances(db, key, userId) };
    });

    return NextResponse.json({
      profile: mapUserRow(result.user, result.balances),
    });
  } catch (error) {
    console.error("[API /user/profile PUT] Error:", error instanceof Error ? error.name : "UnknownError");
    return jsonApiError(error, "Failed to update profile");
  }
}
