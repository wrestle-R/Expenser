import { NextResponse } from "next/server";
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

async function ensureDefaultCategories(userId: string) {
  for (const type of CATEGORY_TYPES) {
    for (const category of DEFAULT_CATEGORIES[type]) {
      await sql`
        insert into user_categories (user_id, type, name, color)
        values (${userId}, ${type}, ${category.name}, ${category.color})
        on conflict (user_id, type, lower(name)) do nothing
      `;
    }
  }
}

export async function GET(req: Request) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = authUser.userId;

    await ensureDefaultCategories(userId);

    const categories = await sql<UserCategoryRow[]>`
      select *
      from user_categories
      where user_id = ${userId}
      order by type asc, name asc
    `;

    return NextResponse.json({
      categories: categories.map(mapUserCategoryRow),
    });
  } catch (error) {
    console.error("[API /categories GET] Error:", error);
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

    const rows = await sql<UserCategoryRow[]>`
      insert into user_categories (user_id, type, name, color)
      values (${userId}, ${type}, ${name}, ${color})
      on conflict (user_id, type, lower(name))
      do update set color = excluded.color
      returning *
    `;

    return NextResponse.json({ category: mapUserCategoryRow(rows[0]) }, { status: 201 });
  } catch (error) {
    console.error("[API /categories POST] Error:", error);
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

    await sql`
      delete from user_categories
      where id = ${id} and user_id = ${userId}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API /categories DELETE] Error:", error);
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 });
  }
}
