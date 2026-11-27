import { NextResponse } from "next/server";
import { financialWrite, hydrate, type Cipher } from "@/lib/financial-db";
import { deleteFinancialRow, storeFinancialRows } from "@/lib/financial-records.mjs";
import { getAuthenticatedUser } from "@/lib/auth";
import { getApiErrorResponse } from "@/lib/api-errors";
import {
  mapUserCategoryRow,
  sql,
  type TransactionType,
  type UserCategoryRow,
} from "@/lib/db";

const CATEGORY_TYPES: TransactionType[] = ["income", "expense"];
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function jsonApiError(error: unknown, fallbackMessage: string) {
  const response = getApiErrorResponse(error, fallbackMessage);
  return NextResponse.json(response.body, { status: response.status });
}

const DEFAULT_CATEGORIES: Record<TransactionType, { name: string; color: string }[]> = {
  expense: [
    { name: "food", color: "#f97316" },
    { name: "transport", color: "#3b82f6" },
    { name: "shopping", color: "#ec4899" },
    { name: "other", color: "#6b7280" },
  ],
  income: [
    { name: "salary", color: "#22c55e" },
    { name: "gift", color: "#a855f7" },
    { name: "exchange", color: "#0ea5e9" },
    { name: "other", color: "#6b7280" },
  ],
};

function sanitizeCategoryName(value: unknown) {
  const name = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!name) {
    throw new Error("Category name is required");
  }
  if (name.length > 80) {
    throw new Error("Category name must be 80 characters or fewer");
  }
  return name;
}

function parseType(value: unknown) {
  if (!CATEGORY_TYPES.includes(value as TransactionType)) {
    throw new Error("Invalid category type");
  }
  return value as TransactionType;
}

function parseColor(value: unknown) {
  const color = typeof value === "string" ? value.trim() : "#6b7280";
  if (!COLOR_PATTERN.test(color)) {
    throw new Error("Category color must be a hex color like #6b7280");
  }
  return color;
}

async function saveCategory(
  db: typeof sql, key: Cipher, userId: string, type: TransactionType, name: string, color: string, overwrite: boolean,
) {
  const lookup = key.lookup(userId, "category-name:" + type, name.toLowerCase());
  const [existing] = await db<UserCategoryRow[]>`
    select category.* from expenser_private.financial_payloads encrypted
    join user_categories category on category.user_id = encrypted.owner_id and category.id::text = encrypted.record_id
    where encrypted.owner_id = ${userId} and encrypted.record_kind = 'user_categories' and encrypted.category_lookup = ${lookup}
  `;
  if (existing && !overwrite) return;
  const [metadata] = existing
    ? await db<UserCategoryRow[]>`
        update user_categories set updated_at = now() where id = ${existing.id} and user_id = ${userId} returning *
      `
    : await db<UserCategoryRow[]>`insert into user_categories (user_id, type, name) values (${userId}, ${type}, '') returning *`;
  const row = { ...metadata, name, color };
  await storeFinancialRows(db, key, "user_categories", [row]);
  return row;
}

export async function GET(req: Request) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = authUser.userId;

    const categories = await financialWrite(userId, async (db, key) => {
      for (const type of CATEGORY_TYPES) {
        for (const { name, color } of DEFAULT_CATEGORIES[type]) {
          await saveCategory(db, key, userId, type, name, color, false);
        }
      }
      const rows = await db<UserCategoryRow[]>`select * from user_categories where user_id = ${userId}`;
      return (await hydrate(db, key, "user_categories", userId, rows))
        .sort((left, right) => left.type.localeCompare(right.type) || left.name.localeCompare(right.name))
        .map(mapUserCategoryRow);
    });
    return NextResponse.json({ categories });
  } catch (error) {
    console.error("[API /categories GET] Error:", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ error: "Failed to load categories" }, { status: 500 });
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
    const type = parseType(data.type);
    const name = sanitizeCategoryName(data.name);
    const color = parseColor(data.color);

    const row = await financialWrite(userId, (db, key) => saveCategory(db, key, userId, type, name, color, true));
    if (!row) throw new Error("Category unavailable");
    return NextResponse.json({ category: mapUserCategoryRow(row) }, { status: 201 });
  } catch (error) {
    console.error("[API /categories POST] Error:", error instanceof Error ? error.name : "UnknownError");
    return jsonApiError(error, "Failed to save category");
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
      return NextResponse.json({ error: "Category ID required" }, { status: 400 });
    }

    await financialWrite(userId, async (db) => {
      await db`delete from user_categories where id = ${id} and user_id = ${userId}`;
      await deleteFinancialRow(db, "user_categories", userId, id);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API /categories DELETE] Error:", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 });
  }
}
