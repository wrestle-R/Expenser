import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getApiErrorResponse } from "@/lib/api-errors";
import { deriveTransactionReviewState } from "@/lib/transaction-review.js";
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
const IMPORT_SOURCE_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const IMPORT_SOURCE_KEY_PATTERN = /^[A-Za-z0-9:_-]{1,256}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonApiError(error: unknown, fallbackMessage: string) {
  const response = getApiErrorResponse(error, fallbackMessage);
  return NextResponse.json(response.body, { status: response.status });
}

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

function parseExchangeExpenseId(value: unknown) {
  if (value == null || value === "") {
    return null;
  }

  const normalized = sanitizeText(value, {
    field: "exchangeExpenseId",
    maxLength: 64,
    required: false,
  });

  if (!UUID_PATTERN.test(normalized)) {
    throw new Error("exchangeExpenseId must be a valid transaction id");
  }

  return normalized;
}

function parseImportMetadata(data: Record<string, unknown>) {
  const importSource =
    data.importSource == null || data.importSource === ""
      ? null
      : sanitizeText(data.importSource, {
          field: "importSource",
          maxLength: 64,
          required: false,
        });
  const importSourceKey =
    data.importSourceKey == null || data.importSourceKey === ""
      ? null
      : sanitizeText(data.importSourceKey, {
          field: "importSourceKey",
          maxLength: 256,
          required: false,
        });

  if ((importSource && !importSourceKey) || (!importSource && importSourceKey)) {
    throw new Error("importSource and importSourceKey must be provided together");
  }

  if (importSource && !IMPORT_SOURCE_PATTERN.test(importSource)) {
    throw new Error(
      "importSource may only contain letters, numbers, hyphens, and underscores"
    );
  }

  if (importSourceKey && !IMPORT_SOURCE_KEY_PATTERN.test(importSourceKey)) {
    throw new Error("importSourceKey contains unsupported characters");
  }

  const importedBankBalance =
    data.importedBankBalance == null || data.importedBankBalance === ""
      ? null
      : normalizeNumber(data.importedBankBalance, Number.NaN);

  if (
    importedBankBalance != null &&
    (!Number.isFinite(importedBankBalance) || importedBankBalance < 0)
  ) {
    throw new Error("importedBankBalance must be 0 or greater");
  }

  return {
    importSource,
    importSourceKey,
    importedAccountSuffix:
      data.importedAccountSuffix == null || data.importedAccountSuffix === ""
        ? null
        : sanitizeText(data.importedAccountSuffix, {
            field: "importedAccountSuffix",
            maxLength: 16,
            required: false,
          }),
    importedBankBalance,
    importedBankReference:
      data.importedBankReference == null || data.importedBankReference === ""
        ? null
        : sanitizeText(data.importedBankReference, {
            field: "importedBankReference",
            maxLength: 64,
            required: false,
          }),
    importedBankConfidence:
      data.importedBankConfidence == null || data.importedBankConfidence === ""
        ? null
        : sanitizeText(data.importedBankConfidence, {
            field: "importedBankConfidence",
            maxLength: 24,
            required: false,
          }),
  };
}

function isExchangeCategory(
  transaction: Pick<ReturnType<typeof parseTransactionInput>, "type" | "category">
) {
  return (
    transaction.type === "income" &&
    transaction.category.trim().toLowerCase() === "exchange"
  );
}

function getExpenseBaseAmount(transaction: {
  type: TransactionType;
  amount: number;
  splitAmount?: number;
}) {
  if (transaction.type !== "expense") {
    return 0;
  }

  return Math.max(0, transaction.amount - Number(transaction.splitAmount ?? 0));
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

  const importMetadata = parseImportMetadata(data);
  const reviewState = deriveTransactionReviewState({
    description: data.description,
    category: data.category,
    importSource: importMetadata.importSource,
    importSourceKey: importMetadata.importSourceKey,
  });

  return {
    type: data.type,
    amount,
    description: sanitizeText(reviewState.description, {
      field: "description",
      maxLength: 200,
      required: false,
    }),
    category: sanitizeText(reviewState.category, {
      field: "category",
      maxLength: 80,
      required: false,
    }),
    reviewStatus: reviewState.reviewStatus,
    paymentMethod: data.paymentMethod,
    splitAmount,
    exchangeExpenseId: parseExchangeExpenseId(data.exchangeExpenseId),
    ...importMetadata,
    date: normalizeDate(data.date),
    clientRequestId: parseClientRequestId(data.clientRequestId),
  };
}

async function createBalanceReconciliationAlertIfNeeded(
  trx: typeof sql,
  userId: string,
  transaction: TransactionRow,
  expectedBankBalance: number
) {
  if (
    transaction.payment_method !== "bank" ||
    transaction.imported_bank_balance == null
  ) {
    return;
  }

  const bankBalance = Number(transaction.imported_bank_balance);
  const difference = Number((bankBalance - expectedBankBalance).toFixed(2));
  if (Math.abs(difference) <= 0.01) {
    return;
  }

  await trx`
    insert into balance_reconciliation_alerts (
      user_id,
      transaction_id,
      payment_method,
      expected_balance,
      bank_balance,
      difference
    )
    values (
      ${userId},
      ${transaction.id},
      'bank',
      ${expectedBankBalance},
      ${bankBalance},
      ${difference}
    )
  `;
}

async function validateExchangeExpenseLink(
  trx: typeof sql,
  userId: string,
  payload: ReturnType<typeof parseTransactionInput>,
  currentTransactionId?: string
) {
  const exchangeExpenseId = payload.exchangeExpenseId;

  if (!isExchangeCategory(payload)) {
    if (exchangeExpenseId) {
      throw new Error("exchangeExpenseId is only allowed for exchange income");
    }

    return null;
  }

  if (!exchangeExpenseId) {
    throw new Error("exchangeExpenseId is required for exchange income");
  }

  if (currentTransactionId && exchangeExpenseId === currentTransactionId) {
    throw new Error("Exchange income cannot offset the same transaction");
  }

  const expenses = (await trx`
    select *
    from transactions
    where id = ${exchangeExpenseId}
      and user_id = ${userId}
      and type = 'expense'
    limit 1
  `) as TransactionRow[];

  const expense = expenses[0];
  if (!expense) {
    throw new Error("Selected expense transaction was not found");
  }

  const linkedExchanges = (currentTransactionId
    ? await trx`
        select coalesce(sum(amount), 0) as total
        from transactions
        where user_id = ${userId}
          and type = 'income'
          and lower(category) = 'exchange'
          and exchange_expense_id = ${exchangeExpenseId}
          and id <> ${currentTransactionId}
      `
    : await trx`
        select coalesce(sum(amount), 0) as total
        from transactions
        where user_id = ${userId}
          and type = 'income'
          and lower(category) = 'exchange'
          and exchange_expense_id = ${exchangeExpenseId}
      `) as { total: number | string | null }[];

  const alreadyApplied = Number(linkedExchanges[0]?.total ?? 0);
  const remainingAmount = Math.max(
    0,
    getExpenseBaseAmount({
      type: expense.type,
      amount: Number(expense.amount),
      splitAmount: Number(expense.split_amount ?? 0),
    }) - alreadyApplied
  );

  if (payload.amount > remainingAmount) {
    throw new Error(
      `Exchange amount cannot exceed the remaining expense amount of ${remainingAmount.toFixed(2)}`
    );
  }

  return expense;
}

async function assertExpenseCanSupportLinkedExchanges(
  trx: typeof sql,
  userId: string,
  transactionId: string,
  nextTransaction: ReturnType<typeof parseTransactionInput>
) {
  const linkedExchanges = (await trx`
    select coalesce(sum(amount), 0) as total
    from transactions
    where user_id = ${userId}
      and type = 'income'
      and lower(category) = 'exchange'
      and exchange_expense_id = ${transactionId}
  `) as { total: number | string | null }[];

  const linkedAmount = Number(linkedExchanges[0]?.total ?? 0);

  if (linkedAmount <= 0) {
    return;
  }

  if (nextTransaction.type !== "expense") {
    throw new Error("Cannot convert an expense with linked exchange income");
  }

  const nextBaseAmount = getExpenseBaseAmount(nextTransaction);
  if (linkedAmount > nextBaseAmount) {
    throw new Error(
      `This expense already has ${linkedAmount.toFixed(2)} linked exchange income`
    );
  }
}

async function assertExpenseCanBeDeleted(
  trx: typeof sql,
  userId: string,
  transactionId: string
) {
  const linkedExchangeTransactions = (await trx`
    select id
    from transactions
    where user_id = ${userId}
      and type = 'income'
      and lower(category) = 'exchange'
      and exchange_expense_id = ${transactionId}
    limit 1
  `) as { id: string }[];

  if (linkedExchangeTransactions[0]) {
    throw new Error("Delete the linked exchange income before deleting this expense");
  }
}

export async function GET(req: Request) {
  try {
    const authUser = await getAuthenticatedUser(req);

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = authUser.userId;

    const transactions = await sql<TransactionRow[]>`
      select *
      from transactions
      where user_id = ${userId}
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
    const authUser = await getAuthenticatedUser(req);

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = authUser.userId;

    const data = (await req.json()) as Record<string, unknown>;
    const payload = parseTransactionInput(data);

    const result = await sql.begin(async (tx) => {
      const trx = tx as unknown as typeof sql;
      if (payload.clientRequestId) {
        const existingTransactions = (await trx`
          select *
          from transactions
          where user_id = ${userId}
            and client_request_id = ${payload.clientRequestId}
          limit 1
        `) as TransactionRow[];

        const existing = existingTransactions[0];
        if (existing) {
          return { transaction: existing, insertedNew: false };
        }
      }

      if (payload.importSource && payload.importSourceKey) {
        const existingImports = (await trx`
          select *
          from transactions
          where user_id = ${userId}
            and import_source = ${payload.importSource}
            and import_source_key = ${payload.importSourceKey}
          limit 1
        `) as TransactionRow[];

        const existing = existingImports[0];
        if (existing) {
          return { transaction: existing, insertedNew: false };
        }
      }

      let transaction: TransactionRow;
      await validateExchangeExpenseLink(trx, userId, payload);

      try {
        const insertedTransactions = (await trx`
          insert into transactions (
            user_id,
            client_request_id,
            exchange_expense_id,
            import_source,
            import_source_key,
            imported_account_suffix,
            imported_bank_balance,
            imported_bank_reference,
            imported_bank_confidence,
            type,
            amount,
            description,
            category,
            review_status,
            payment_method,
            split_amount,
            date
          )
          values (
            ${userId},
            ${payload.clientRequestId},
            ${payload.exchangeExpenseId},
            ${payload.importSource},
            ${payload.importSourceKey},
            ${payload.importedAccountSuffix},
            ${payload.importedBankBalance},
            ${payload.importedBankReference},
            ${payload.importedBankConfidence},
            ${payload.type},
            ${payload.amount},
            ${payload.description},
            ${payload.category},
            ${payload.reviewStatus},
            ${payload.paymentMethod},
            ${payload.splitAmount},
            ${payload.date}
          )
          returning *
        `) as TransactionRow[];

        transaction = insertedTransactions[0];
      } catch (error: unknown) {
        const err = error as { code?: string };
        if (err?.code === "23505") {
          if (payload.importSource && payload.importSourceKey) {
            const existingImports = (await trx`
              select *
              from transactions
              where user_id = ${userId}
                and import_source = ${payload.importSource}
                and import_source_key = ${payload.importSourceKey}
              limit 1
            `) as TransactionRow[];

            const existing = existingImports[0];
            if (existing) {
              return { transaction: existing, insertedNew: false };
            }
          }

          if (payload.clientRequestId) {
            const existingTransactions = (await trx`
              select *
              from transactions
              where user_id = ${userId}
                and client_request_id = ${payload.clientRequestId}
              limit 1
            `) as TransactionRow[];

            const existing = existingTransactions[0];
            if (existing) {
              return { transaction: existing, insertedNew: false };
            }
          }
        }

        throw error;
      }

      const users = (await trx`
        select *
        from users
        where user_id = ${userId}
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
          where user_id = ${userId}
        `;

        await createBalanceReconciliationAlertIfNeeded(
          trx,
          userId,
          transaction,
          balances.bank
        );
      }

      return { transaction, insertedNew: true };
    });

    return NextResponse.json({
      transaction: mapTransactionRow(result.transaction),
    }, { status: result.insertedNew ? 201 : 200 });
  } catch (error) {
    console.error("[API /transactions POST] Error:", error);
    return jsonApiError(error, "Internal Server Error");
  }
}

export async function DELETE(req: Request) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = authUser.userId;

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
        where id = ${id} and user_id = ${userId}
        limit 1
      `) as TransactionRow[];

      const transaction = transactions[0];
      if (!transaction) {
        return null;
      }

      if (transaction.type === "expense") {
        await assertExpenseCanBeDeleted(trx, userId, id);
      }

      const users = (await trx`
        select *
        from users
        where user_id = ${userId}
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
          where user_id = ${userId}
        `;
        console.log("[API /transactions DELETE] Reversed balances");
      }

      await trx`
        delete from transactions
        where id = ${id} and user_id = ${userId}
      `;

      return transaction;
    });

    if (!deleted) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API /transactions DELETE] Error:", error);
    return jsonApiError(error, "Internal Server Error");
  }
}

export async function PUT(req: Request) {
  try {
    const authUser = await getAuthenticatedUser(req);

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = authUser.userId;

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
        where id = ${id} and user_id = ${userId}
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
        importSource: oldTransaction.import_source,
        importSourceKey: oldTransaction.import_source_key,
        paymentMethod: data.paymentMethod ?? oldTransaction.payment_method,
        splitAmount: data.splitAmount ?? oldTransaction.split_amount,
        exchangeExpenseId:
          data.exchangeExpenseId ?? oldTransaction.exchange_expense_id,
        date: data.date ?? oldTransaction.date,
        clientRequestId: oldTransaction.client_request_id,
      });

      await validateExchangeExpenseLink(trx, userId, nextTransaction, id);
      await assertExpenseCanSupportLinkedExchanges(trx, userId, id, nextTransaction);

      const users = (await trx`
        select *
        from users
        where user_id = ${userId}
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
          where user_id = ${userId}
        `;
      }

      const updatedTransactions = (await trx`
        update transactions
        set
          type = ${nextTransaction.type},
          amount = ${nextTransaction.amount},
          description = ${nextTransaction.description},
          category = ${nextTransaction.category},
          review_status = ${nextTransaction.reviewStatus},
          payment_method = ${nextTransaction.paymentMethod},
          split_amount = ${nextTransaction.splitAmount},
          exchange_expense_id = ${nextTransaction.exchangeExpenseId},
          date = ${nextTransaction.date}
        where id = ${id} and user_id = ${userId}
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
    console.error("[API /transactions PUT] Error:", error);
    return jsonApiError(error, "Internal Server Error");
  }
}
