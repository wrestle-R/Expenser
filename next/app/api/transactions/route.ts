import { parseTransactionPage, transactionPageCursor } from "@/lib/transaction-pagination.js";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { financialRead, financialWrite, hydrate, type Cipher } from "@/lib/financial-db";
import { storeFinancialRows } from "@/lib/financial-records.mjs";
import {
  ensureEncryptedBalances, insertEncryptedTransaction, readEncryptedBalances, refreshEncryptedBalances,
} from "@/lib/encrypted-transaction-storage.mjs";
import { getAuthenticatedUser } from "@/lib/auth";
import { getApiErrorResponse } from "@/lib/api-errors";
import { calculateImportedBalanceMismatch } from "@/lib/bank-import-balance.js";
import {
  assertPendingReviewUpdateFields,
  deriveTransactionReviewState,
  getPendingReviewUpdate,
} from "@/lib/transaction-review.js";
import {
  mapTransactionRow,
  normalizeDate,
  normalizeNumber,
  sql,
  type PaymentMethod,
  type TransactionRow,
  type TransactionType,
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
    description: data.description ?? "",
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

async function linkedExchangeAmount(trx: typeof sql, key: Cipher, userId: string, id: string, exclude?: string) {
  const rows = await trx<TransactionRow[]>`
    select * from transactions where user_id = ${userId} and exchange_expense_id = ${id}
      and deleted_at is null and (${exclude ?? null}::uuid is null or id <> ${exclude ?? null}::uuid)
  `;
  return (await hydrate(trx, key, "transactions", userId, rows))
    .filter(isExchangeRow).reduce((sum, row) => sum + Number(row.amount), 0);
}

function isExchangeRow(row: TransactionRow) {
  return isExchangeCategory({ type: row.type, category: row.category });
}

async function validateExchangeExpenseLink(
  trx: typeof sql, key: Cipher, userId: string, payload: ReturnType<typeof parseTransactionInput>, currentId?: string,
) {
  const id = payload.exchangeExpenseId;
  if (!isExchangeCategory(payload)) {
    if (id) throw new Error("exchangeExpenseId is only allowed for exchange income");
    return;
  }
  if (!id) throw new Error("exchangeExpenseId is required for exchange income");
  if (id === currentId) throw new Error("Exchange income cannot offset the same transaction");
  const metadata = await trx<TransactionRow[]>`
    select * from transactions where id = ${id} and user_id = ${userId} and deleted_at is null
  `;
  const [expense] = await hydrate(trx, key, "transactions", userId, metadata);
  if (!expense || expense.type !== "expense") throw new Error("Selected expense transaction was not found");
  const remaining = Math.max(0, getExpenseBaseAmount({
    type: expense.type, amount: Number(expense.amount), splitAmount: Number(expense.split_amount),
  }) - await linkedExchangeAmount(trx, key, userId, id, currentId));
  if (payload.amount > remaining) {
    throw new Error(`Exchange amount cannot exceed the remaining expense amount of ${remaining.toFixed(2)}`);
  }
}

function transactionFields(payload: ReturnType<typeof parseTransactionInput>) {
  return {
    type: payload.type, amount: payload.amount, description: payload.description, category: payload.category,
    payment_method: payload.paymentMethod, split_amount: payload.splitAmount, client_request_id: payload.clientRequestId,
    import_source: payload.importSource, import_source_key: payload.importSourceKey,
    imported_account_suffix: payload.importedAccountSuffix, imported_bank_balance: payload.importedBankBalance,
    imported_bank_reference: payload.importedBankReference, imported_bank_confidence: payload.importedBankConfidence,
  };
}

export async function GET(req: Request) {
  try {
    const authUser = await getAuthenticatedUser(req);

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = authUser.userId;

    let page;
    try { page = parseTransactionPage(new URL(req.url).searchParams); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid page" }, { status: 400 }); }
    return await financialRead(async (db, key) => {
      const cursor = page?.cursor;
      const metadata = await db<(TransactionRow & { cursor_date: string; cursor_created_at: string })[]>`
        select *, date::text as cursor_date, created_at::text as cursor_created_at
        from transactions where user_id = ${userId} and deleted_at is null
          ${cursor ? db`and (date, created_at, id) < (${cursor.date}::text::timestamptz, ${cursor.createdAt}::text::timestamptz, ${cursor.id}::uuid)` : db``}
        order by date desc, created_at desc, id desc
        ${page ? db`limit ${page.limit + 1}` : db``}
      `;
      const visible = page ? metadata.slice(0, page.limit) : metadata;
      const transactions = (await hydrate(db, key, "transactions", userId, visible)).map(mapTransactionRow);
      return NextResponse.json(page ? {
        transactions,
        nextCursor: metadata.length > page.limit ? transactionPageCursor(visible[visible.length - 1]) : null,
      } : { transactions });
    });
  } catch (error) {
    console.error("[API /transactions GET] Error:", error instanceof Error ? error.name : "UnknownError");
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

    const result = await financialWrite(userId, async (trx, key) => {
      const requestKey = payload.clientRequestId ? key.lookup(userId, "transactions-request", payload.clientRequestId) : null;
      const importKey = payload.importSourceKey ? key.lookup(userId, "transaction-import", payload.importSourceKey) : null;
      const bankKey = payload.importSource && payload.importedAccountSuffix && payload.importedBankReference
        ? key.lookup(userId, "bank-reference", JSON.stringify([payload.importedAccountSuffix, payload.importedBankReference])) : null;
      if (requestKey || importKey || bankKey) {
        const metadata = await trx<TransactionRow[]>`
          select entry.* from expenser_private.financial_payloads encrypted
          join transactions entry on entry.user_id = encrypted.owner_id and entry.id::text = encrypted.record_id
          where encrypted.record_kind = 'transactions' and encrypted.owner_id = ${userId}
            and ((encrypted.request_lookup = ${requestKey} and entry.deleted_at is null)
              or encrypted.import_lookup = ${importKey} or encrypted.bank_reference_lookup = ${bankKey})
          order by coalesce(encrypted.request_lookup = ${requestKey} and entry.deleted_at is null, false) desc,
            coalesce(encrypted.bank_reference_lookup = ${bankKey}, false) desc, entry.created_at, entry.id
          limit 1
        `;
        const [existing] = await hydrate(trx, key, "transactions", userId, metadata);
        if (existing) return { transaction: existing, insertedNew: false };
      }

      await validateExchangeExpenseLink(trx, key, userId, payload);
      await ensureEncryptedBalances(trx, key, userId);
      const reported = payload.importedBankBalance;
      const mismatch = payload.paymentMethod === "bank" && payload.importSource && reported != null
        ? calculateImportedBalanceMismatch({
            currentBalance: Number((await readEncryptedBalances(trx, key, userId))
              .find((row) => row.payment_method === "bank")?.current_balance ?? 0),
            type: payload.type, amount: payload.amount, reportedBalance: reported,
          }) : null;
      const transaction = await insertEncryptedTransaction(trx, key, {
        ownerId: userId, transactionId: randomUUID(), date: payload.date, reviewStatus: payload.reviewStatus,
        exchangeExpenseId: payload.exchangeExpenseId, fields: transactionFields(payload),
      }) as TransactionRow;

      if (mismatch?.shouldAlert) {
        const [alert] = await trx`
          insert into balance_reconciliation_alerts
            (user_id, transaction_id, payment_method, expected_balance, bank_balance, difference, source)
          values (${userId}, ${transaction.id}, 'bank', 0, 0, 0, '') returning *
        `;
        await storeFinancialRows(trx, key, "balance_reconciliation_alerts", [{
          ...alert, expected_balance: mismatch.expectedBalance, bank_balance: reported,
          difference: mismatch.difference, source: "bank_notification",
        }]);
      }
      return { transaction, insertedNew: true };
    });

    return NextResponse.json({
      transaction: mapTransactionRow(result.transaction),
    }, { status: result.insertedNew ? 201 : 200 });
  } catch (error) {
    console.error("[API /transactions POST] Error:", error instanceof Error ? error.name : "UnknownError");
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

    const deleted = await financialWrite(userId, async (trx, key) => {
      const transactions = (await trx`
        select *
        from transactions
        where id = ${id}
          and user_id = ${userId}
          and deleted_at is null
        limit 1
      `) as TransactionRow[];

      const [transaction] = await hydrate(trx, key, "transactions", userId, transactions);
      if (!transaction) {
        return null;
      }

      if (transaction.type === "expense" && await linkedExchangeAmount(trx, key, userId, id) > 0) {
        throw new Error("Delete the linked exchange income before deleting this expense");
      }

      const deletedTransactions = (await trx`
        update transactions
        set deleted_at = timezone('utc', now())
        where id = ${id}
          and user_id = ${userId}
          and deleted_at is null
        returning *
      `) as TransactionRow[];

      const deletedTransaction = deletedTransactions[0];
      if (!deletedTransaction) {
        return null;
      }

      await refreshEncryptedBalances(trx, key, userId);
      return deletedTransaction;
    });

    if (!deleted) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API /transactions DELETE] Error:", error instanceof Error ? error.name : "UnknownError");
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

    const updatedTransaction = await financialWrite(userId, async (trx, key) => {
      const existingTransactions = (await trx`
        select *
        from transactions
        where id = ${id}
          and user_id = ${userId}
          and deleted_at is null
        limit 1
      `) as TransactionRow[];

      const [oldTransaction] = await hydrate(trx, key, "transactions", userId, existingTransactions);
      if (!oldTransaction) {
        return null;
      }

      const pendingReviewUpdate =
        oldTransaction.review_status === "needs_category"
          ? (() => {
              assertPendingReviewUpdateFields(data);
              const update = getPendingReviewUpdate({
                description: data.description ?? oldTransaction.description,
                category: data.category,
              });
              if (!update.category) {
                throw new Error("Choose a category to complete this review");
              }
              return update;
            })()
          : null;

      const nextTransaction = parseTransactionInput({
        type: data.type ?? oldTransaction.type,
        amount: data.amount ?? oldTransaction.amount,
        description:
          pendingReviewUpdate?.description ??
          data.description ??
          oldTransaction.description,
        category:
          pendingReviewUpdate?.category ?? data.category ?? oldTransaction.category,
        importSource: oldTransaction.import_source,
        importSourceKey: oldTransaction.import_source_key,
        paymentMethod: data.paymentMethod ?? oldTransaction.payment_method,
        splitAmount: data.splitAmount ?? oldTransaction.split_amount,
        exchangeExpenseId:
          data.exchangeExpenseId ?? oldTransaction.exchange_expense_id,
        date: data.date ?? oldTransaction.date,
        clientRequestId: oldTransaction.client_request_id,
        importedAccountSuffix: oldTransaction.imported_account_suffix,
        importedBankBalance: oldTransaction.imported_bank_balance,
        importedBankReference: oldTransaction.imported_bank_reference,
        importedBankConfidence: oldTransaction.imported_bank_confidence,
      });

      await validateExchangeExpenseLink(trx, key, userId, nextTransaction, id);
      const linked = await linkedExchangeAmount(trx, key, userId, id);
      if (linked > 0 && nextTransaction.type !== "expense") {
        throw new Error("Cannot convert an expense with linked exchange income");
      }
      if (linked > getExpenseBaseAmount(nextTransaction)) {
        throw new Error(`This expense already has ${linked.toFixed(2)} linked exchange income`);
      }
      const [updated] = await trx<TransactionRow[]>`
        update transactions set review_status = ${nextTransaction.reviewStatus},
          exchange_expense_id = ${nextTransaction.exchangeExpenseId}, date = ${nextTransaction.date}
        where id = ${id} and user_id = ${userId} and deleted_at is null returning *
      `;
      const row = { ...updated, ...transactionFields(nextTransaction) };
      await storeFinancialRows(trx, key, "transactions", [row]);
      await refreshEncryptedBalances(trx, key, userId);
      return row;

    });

    if (!updatedTransaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    return NextResponse.json({
      transaction: mapTransactionRow(updatedTransaction),
    });
  } catch (error) {
    console.error("[API /transactions PUT] Error:", error instanceof Error ? error.name : "UnknownError");
    return jsonApiError(error, "Internal Server Error");
  }
}
