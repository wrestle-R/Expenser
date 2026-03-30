import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { mapUserRow, sql, type UserRow } from "@/lib/db";

export async function GET() {
  try {
    const { userId } = await auth();
    console.log("[API /user/profile GET] userId:", userId);

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
        console.log("[API /user/profile GET] User not found for clerkId:", userId);
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      console.log("[API /user/profile GET] User found:", user.name);
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
    console.log("[API /user/profile PUT] userId:", userId);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();
    console.log("[API /user/profile PUT] Data:", data);

    const clerkUser = await currentUser();
    const email = clerkUser?.primaryEmailAddress?.emailAddress || "";

    const existingUsers = await sql<UserRow[]>`
      select *
      from users
      where clerk_id = ${userId}
      limit 1
    `;

    const existingUser = existingUsers[0];

    if (!existingUser) {
      console.log("[API /user/profile PUT] Creating new user");
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
          ${data.name || ""},
          ${data.occupation || ""},
          ${data.paymentMethods || []},
          ${Number(data.balances?.bank || 0)},
          ${Number(data.balances?.cash || 0)},
          ${Number(data.balances?.splitwise || 0)},
          ${Boolean(data.onboarded ?? false)}
        )
        returning *
      `;

      const user = insertedUsers[0];
      console.log("[API /user/profile PUT] Saved user:", user.name);
      return NextResponse.json({ profile: mapUserRow(user) });
    }

    console.log("[API /user/profile PUT] Updating existing user");
    const mergedBalances = {
      bank: Number(data.balances?.bank ?? existingUser.balance_bank ?? 0),
      cash: Number(data.balances?.cash ?? existingUser.balance_cash ?? 0),
      splitwise: Number(
        data.balances?.splitwise ?? existingUser.balance_splitwise ?? 0
      ),
    };

    const updatedUsers = await sql<UserRow[]>`
      update users
      set
        email = ${email || existingUser.email},
        name = ${data.name ?? existingUser.name},
        occupation = ${data.occupation ?? existingUser.occupation},
        payment_methods = ${data.paymentMethods ?? existingUser.payment_methods},
        balance_bank = ${mergedBalances.bank},
        balance_cash = ${mergedBalances.cash},
        balance_splitwise = ${mergedBalances.splitwise},
        onboarded = ${data.onboarded ?? existingUser.onboarded}
      where clerk_id = ${userId}
      returning *
    `;

    const user = updatedUsers[0];
    console.log("[API /user/profile PUT] Saved user:", user.name);
    return NextResponse.json({ profile: mapUserRow(user) });
  } catch (error) {
    console.error("[API /user/profile PUT] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
