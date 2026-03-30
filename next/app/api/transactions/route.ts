import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  mapTransactionRow,
  mapUserRow,
  normalizeDate,
  normalizeNumber,
  sql,
  updateBalancesForTransaction,
  type PaymentMethod,
  type TransactionRow,
  type TransactionType,
  type UserRow,
} from "@/lib/db";

export async function GET() {
  try {
    const { userId } = await auth();
    console.log("[API /transactions GET] userId:", userId);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const transactions = await sql<TransactionRow[]>`
      select *
      from transactions
      where clerk_id = ${userId}
      order by date desc, created_at desc
    `;

    console.log("[API /transactions GET] Found", transactions.length, "transactions");
    return NextResponse.json({
      transactions: transactions.map(mapTransactionRow),
    });
  } catch (error) {
    console.error("[API /transactions GET] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    console.log("[API /transactions POST] userId:", userId);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();
    console.log("[API /transactions POST] Data:", data);

    const createdTransaction = await sql.begin(async (tx) => {
      const trx = tx as unknown as typeof sql;
      const insertedTransactions = (await trx`
        insert into transactions (
          clerk_id,
          type,
          amount,
          description,
          category,
          payment_method,
          split_amount,
          date
        )
        values (
          ${userId},
          ${data.type as TransactionType},
          ${normalizeNumber(data.amount)},
          ${data.description},
          ${data.category || "General"},
          ${data.paymentMethod as PaymentMethod},
          ${normalizeNumber(data.splitAmount, 0)},
          ${normalizeDate(data.date)}
        )
        returning *
      `) as TransactionRow[];

      const transaction = insertedTransactions[0];
      const users = (await trx`
        select *
        from users
        where clerk_id = ${userId}
        limit 1
        for update
      `) as UserRow[];

      const user = users[0];
      if (user) {
        const balances = updateBalancesForTransaction(
          mapUserRow(user).balances,
          {
            type: transaction.type,
            amount: Number(transaction.amount),
            paymentMethod: transaction.payment_method,
            splitAmount: Number(transaction.split_amount ?? 0),
          },
          1
        );

        await trx`
          update users
          set
            balance_bank = ${balances.bank},
            balance_cash = ${balances.cash},
            balance_splitwise = ${balances.splitwise}
          where clerk_id = ${userId}
        `;
        console.log("[API /transactions POST] Updated balances");
      }

      return transaction;
    });

    console.log("[API /transactions POST] Created transaction:", createdTransaction.id);
    return NextResponse.json({
      transaction: mapTransactionRow(createdTransaction),
    });
  } catch (error) {
    console.error("[API /transactions POST] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Transaction ID required" }, { status: 400 });
    }

    const deleted = await sql.begin(async (tx) => {
      const trx = tx as unknown as typeof sql;
      const transactions = (await trx`
        select *
        from transactions
        where id = ${id} and clerk_id = ${userId}
        limit 1
      `) as TransactionRow[];

      const transaction = transactions[0];
      if (!transaction) {
        return null;
      }

      const users = (await trx`
        select *
        from users
        where clerk_id = ${userId}
        limit 1
        for update
      `) as UserRow[];

      const user = users[0];
      if (user) {
        const balances = updateBalancesForTransaction(
          mapUserRow(user).balances,
          {
            type: transaction.type,
            amount: Number(transaction.amount),
            paymentMethod: transaction.payment_method,
            splitAmount: Number(transaction.split_amount ?? 0),
          },
          -1
        );

        await trx`
          update users
          set
            balance_bank = ${balances.bank},
            balance_cash = ${balances.cash},
            balance_splitwise = ${balances.splitwise}
          where clerk_id = ${userId}
        `;
        console.log("[API /transactions DELETE] Reversed balances");
      }

      await trx`
        delete from transactions
        where id = ${id} and clerk_id = ${userId}
      `;

      return transaction;
    });

    if (!deleted) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API /transactions DELETE] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { userId } = await auth();
    console.log("[API /transactions PUT] userId:", userId);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Transaction ID required" }, { status: 400 });
    }

    const data = await req.json();
    console.log("[API /transactions PUT] Data:", data);

    const updatedTransaction = await sql.begin(async (tx) => {
      const trx = tx as unknown as typeof sql;
      const existingTransactions = (await trx`
        select *
        from transactions
        where id = ${id} and clerk_id = ${userId}
        limit 1
      `) as TransactionRow[];

      const oldTransaction = existingTransactions[0];
      if (!oldTransaction) {
        return null;
      }

      const nextTransaction = {
        type: (data.type ?? oldTransaction.type) as TransactionType,
        amount: normalizeNumber(data.amount ?? oldTransaction.amount),
        description: data.description ?? oldTransaction.description,
        category: data.category ?? oldTransaction.category,
        paymentMethod: (data.paymentMethod ??
          oldTransaction.payment_method) as PaymentMethod,
        splitAmount: normalizeNumber(
          data.splitAmount ?? oldTransaction.split_amount,
          0
        ),
        date: normalizeDate(data.date ?? oldTransaction.date),
      };

      const users = (await trx`
        select *
        from users
        where clerk_id = ${userId}
        limit 1
        for update
      `) as UserRow[];

      const user = users[0];
      if (user) {
        let balances = updateBalancesForTransaction(
          mapUserRow(user).balances,
          {
            type: oldTransaction.type,
            amount: Number(oldTransaction.amount),
            paymentMethod: oldTransaction.payment_method,
            splitAmount: Number(oldTransaction.split_amount ?? 0),
          },
          -1
        );

        balances = updateBalancesForTransaction(balances, nextTransaction, 1);

        await trx`
          update users
          set
            balance_bank = ${balances.bank},
            balance_cash = ${balances.cash},
            balance_splitwise = ${balances.splitwise}
          where clerk_id = ${userId}
        `;
        console.log("[API /transactions PUT] Updated balances");
      }

      const updatedTransactions = (await trx`
        update transactions
        set
          type = ${nextTransaction.type},
          amount = ${nextTransaction.amount},
          description = ${nextTransaction.description},
          category = ${nextTransaction.category},
          payment_method = ${nextTransaction.paymentMethod},
          split_amount = ${nextTransaction.splitAmount},
          date = ${nextTransaction.date}
        where id = ${id} and clerk_id = ${userId}
        returning *
      `) as TransactionRow[];

      return updatedTransactions[0] ?? null;
    });

    if (!updatedTransaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    console.log("[API /transactions PUT] Updated transaction:", updatedTransaction.id);
    return NextResponse.json({
      transaction: mapTransactionRow(updatedTransaction),
    });
  } catch (error) {
    console.error("[API /transactions PUT] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
