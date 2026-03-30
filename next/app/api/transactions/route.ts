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

const PAYMENT_METHODS: PaymentMethod[] = ["bank", "cash", "splitwise"];
const TRANSACTION_TYPES: TransactionType[] = ["income", "expense"];
const CLIENT_REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

function isPaymentMethod(value: unknown): value is PaymentMethod {
  return PAYMENT_METHODS.includes(value as PaymentMethod);
}

function isTransactionType(value: unknown): value is TransactionType {
  return TRANSACTION_TYPES.includes(value as TransactionType);
}

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

function normalizePositiveAmount(value: unknown, field: string) {
  const amount = normalizeNumber(value, Number.NaN);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`${field} must be greater than 0`);
  }

  return amount;
}

function parseClientRequestId(value: unknown) {
  if (value == null || value === "") {
    return null;
  }

  const normalized = sanitizeText(value, {
    field: "clientRequestId",
    maxLength: 128,
    required: false,
  });

  if (!CLIENT_REQUEST_ID_PATTERN.test(normalized)) {
    throw new Error(
      "clientRequestId may only contain letters, numbers, hyphens, and underscores"
    );
  }

  return normalized;
}

function parseTransactionInput(data: Record<string, unknown>) {
  if (!isTransactionType(data.type)) {
    throw new Error("Invalid transaction type");
  }

  if (!isPaymentMethod(data.paymentMethod)) {
    throw new Error("Invalid payment method");
  }

  const amount = normalizePositiveAmount(data.amount, "amount");
  const splitAmount = Math.max(0, normalizeNumber(data.splitAmount, 0));

  if (data.type === "income" && splitAmount > 0) {
    throw new Error("Income transactions cannot include a split amount");
  }

  if (data.type === "expense" && splitAmount >= amount) {
    throw new Error("Split amount must be less than the total amount");
  }

  return {
    type: data.type,
    amount,
    description: sanitizeText(data.description, {
      field: "description",
      maxLength: 200,
      required: true,
    }),
    category: sanitizeText(data.category, {
      field: "category",
      maxLength: 80,
      fallback: "General",
    }),
    paymentMethod: data.paymentMethod,
    splitAmount,
    date: normalizeDate(data.date),
    clientRequestId: parseClientRequestId(data.clientRequestId),
  };
}

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const transactions = await sql<TransactionRow[]>`
      select *
      from transactions
      where clerk_id = ${userId}
      order by date desc, created_at desc
    `;

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

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = (await req.json()) as Record<string, unknown>;
    const payload = parseTransactionInput(data);

    const result = await sql.begin(async (tx) => {
      const trx = tx as unknown as typeof sql;
      if (payload.clientRequestId) {
        const existingTransactions = (await trx`
          select *
          from transactions
          where clerk_id = ${userId}
            and client_request_id = ${payload.clientRequestId}
          limit 1
        `) as TransactionRow[];

        const existing = existingTransactions[0];
        if (existing) {
          return { transaction: existing, insertedNew: false };
        }
      }

      let transaction: TransactionRow;

      try {
        const insertedTransactions = (await trx`
          insert into transactions (
            clerk_id,
            client_request_id,
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
            ${payload.clientRequestId},
            ${payload.type},
            ${payload.amount},
            ${payload.description},
            ${payload.category},
            ${payload.paymentMethod},
            ${payload.splitAmount},
            ${payload.date}
          )
          returning *
        `) as TransactionRow[];

        transaction = insertedTransactions[0];
      } catch (error: any) {
        if (payload.clientRequestId && error?.code === "23505") {
          const existingTransactions = (await trx`
            select *
            from transactions
            where clerk_id = ${userId}
              and client_request_id = ${payload.clientRequestId}
            limit 1
          `) as TransactionRow[];

          const existing = existingTransactions[0];
          if (existing) {
            return { transaction: existing, insertedNew: false };
          }
        }

        throw error;
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
      }

      return { transaction, insertedNew: true };
    });

    return NextResponse.json({
      transaction: mapTransactionRow(result.transaction),
    }, { status: result.insertedNew ? 201 : 200 });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

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

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Transaction ID required" }, { status: 400 });
    }

    const data = (await req.json()) as Record<string, unknown>;

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

      const nextTransaction = parseTransactionInput({
        type: data.type ?? oldTransaction.type,
        amount: data.amount ?? oldTransaction.amount,
        description: data.description ?? oldTransaction.description,
        category: data.category ?? oldTransaction.category,
        paymentMethod: data.paymentMethod ?? oldTransaction.payment_method,
        splitAmount: data.splitAmount ?? oldTransaction.split_amount,
        date: data.date ?? oldTransaction.date,
        clientRequestId: oldTransaction.client_request_id,
      });

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

    return NextResponse.json({
      transaction: mapTransactionRow(updatedTransaction),
    });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("[API /transactions PUT] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
