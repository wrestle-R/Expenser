import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { mapUserRow, sql, type UserRow } from "@/lib/db";

const PAYMENT_METHODS = ["bank", "cash", "splitwise"] as const;

function sanitizeText(
  value: unknown,
  {
    field,
    maxLength,
    fallback,
    required = false,
  }: {
    field: string;
    maxLength: number;
    fallback?: string;
    required?: boolean;
  }
) {
  const normalized =
    typeof value === "string" ? value.trim() : fallback ?? "";

  if (!normalized) {
    if (required) {
      throw new Error(`${field} is required`);
    }
    return fallback ?? "";
  }

  if (normalized.length > maxLength) {
    throw new Error(`${field} must be ${maxLength} characters or fewer`);
  }

  return normalized;
}

function parsePaymentMethods(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value.filter((method): method is (typeof PAYMENT_METHODS)[number] =>
        PAYMENT_METHODS.includes(method as (typeof PAYMENT_METHODS)[number])
      )
    )
  );
}

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      const users = await sql<UserRow[]>`
        select *
        from users
        where clerk_id = ${userId}
        limit 1
      `;

      const user = users[0];

      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      return NextResponse.json({ profile: mapUserRow(user) });
    } catch (dbError) {
      console.error("[API /user/profile GET] Database connection error:", dbError);
      return NextResponse.json({ error: "Database connection failed" }, { status: 500 });
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[API /user/profile GET] General Error:", message, stack);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = (await req.json()) as Record<string, unknown>;

    const clerkUser = await currentUser();
    const email = clerkUser?.primaryEmailAddress?.emailAddress || "";
    const paymentMethods = parsePaymentMethods(data.paymentMethods);
    const name = sanitizeText(data.name, {
      field: "name",
      maxLength: 120,
      fallback: "",
      required: false,
    });
    const occupation = sanitizeText(data.occupation, {
      field: "occupation",
      maxLength: 120,
      fallback: "",
      required: false,
    });
    const rawBalances =
      data.balances && typeof data.balances === "object"
        ? (data.balances as Record<string, unknown>)
        : null;
    const parsedBalances = {
      bank: rawBalances?.bank == null ? null : Number(rawBalances.bank),
      cash: rawBalances?.cash == null ? null : Number(rawBalances.cash),
      splitwise:
        rawBalances?.splitwise == null ? null : Number(rawBalances.splitwise),
    };

    const existingUsers = await sql<UserRow[]>`
      select *
      from users
      where clerk_id = ${userId}
      limit 1
    `;

    const existingUser = existingUsers[0];

    if (!existingUser) {
      const insertedUsers = await sql<UserRow[]>`
        insert into users (
          clerk_id,
          email,
          name,
          occupation,
          payment_methods,
          balance_bank,
          balance_cash,
          balance_splitwise,
          onboarded
        )
        values (
          ${userId},
          ${email},
          ${name},
          ${occupation},
          ${paymentMethods},
          ${Number.isFinite(parsedBalances.bank ?? Number.NaN) ? parsedBalances.bank : 0},
          ${Number.isFinite(parsedBalances.cash ?? Number.NaN) ? parsedBalances.cash : 0},
          ${Number.isFinite(parsedBalances.splitwise ?? Number.NaN) ? parsedBalances.splitwise : 0},
          ${Boolean(data.onboarded ?? false)}
        )
        returning *
      `;

      const user = insertedUsers[0];
      return NextResponse.json({ profile: mapUserRow(user) });
    }

    const mergedBalances: {
      bank: number;
      cash: number;
      splitwise: number;
    } = {
      bank:
        typeof parsedBalances.bank === "number" &&
        Number.isFinite(parsedBalances.bank)
          ? parsedBalances.bank
          : Number(existingUser.balance_bank ?? 0),
      cash:
        typeof parsedBalances.cash === "number" &&
        Number.isFinite(parsedBalances.cash)
          ? parsedBalances.cash
          : Number(existingUser.balance_cash ?? 0),
      splitwise:
        typeof parsedBalances.splitwise === "number" &&
        Number.isFinite(parsedBalances.splitwise)
          ? parsedBalances.splitwise
          : Number(existingUser.balance_splitwise ?? 0),
    };
    const nextPaymentMethods = Array.isArray(data.paymentMethods)
      ? paymentMethods
      : existingUser.payment_methods;
    const nextOnboarded =
      typeof data.onboarded === "boolean"
        ? data.onboarded
        : existingUser.onboarded;

    const updatedUsers = (await sql`
      update users
      set
        email = ${email || existingUser.email},
        name = ${name || existingUser.name},
        occupation = ${occupation || existingUser.occupation},
        payment_methods = ${nextPaymentMethods},
        balance_bank = ${mergedBalances.bank},
        balance_cash = ${mergedBalances.cash},
        balance_splitwise = ${mergedBalances.splitwise},
        onboarded = ${nextOnboarded}
      where clerk_id = ${userId}
      returning *
    `) as unknown as UserRow[];

    const user = updatedUsers[0];
    return NextResponse.json({ profile: mapUserRow(user) });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("[API /user/profile PUT] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
