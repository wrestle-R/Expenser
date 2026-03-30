import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  mapWorkflowRow,
  normalizeNumber,
  sql,
  type WorkflowRow,
} from "@/lib/db";

const PAYMENT_METHODS = ["bank", "cash", "splitwise"] as const;
const TRANSACTION_TYPES = ["income", "expense"] as const;

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

function parseWorkflowInput(body: Record<string, unknown>) {
  if (!TRANSACTION_TYPES.includes(body.type as (typeof TRANSACTION_TYPES)[number])) {
    throw new Error("Invalid workflow type");
  }

  if (
    !PAYMENT_METHODS.includes(
      body.paymentMethod as (typeof PAYMENT_METHODS)[number]
    )
  ) {
    throw new Error("Invalid payment method");
  }

  const amount = normalizeNumber(body.amount, Number.NaN);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("amount must be greater than 0");
  }

  const splitAmount = Math.max(0, normalizeNumber(body.splitAmount, 0));
  if (body.type === "income" && splitAmount > 0) {
    throw new Error("Income workflows cannot include a split amount");
  }
  if (body.type === "expense" && splitAmount >= amount) {
    throw new Error("Split amount must be less than the total amount");
  }

  return {
    name: sanitizeText(body.name, {
      field: "name",
      maxLength: 120,
      required: true,
    }),
    type: body.type as "income" | "expense",
    amount,
    description: sanitizeText(body.description, {
      field: "description",
      maxLength: 200,
      required: true,
    }),
    category: sanitizeText(body.category, {
      field: "category",
      maxLength: 80,
      fallback: "General",
    }),
    paymentMethod: body.paymentMethod as "bank" | "cash" | "splitwise",
    splitAmount,
  };
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workflows = await sql<WorkflowRow[]>`
      select *
      from workflows
      where user_id = ${userId}
      order by created_at desc
    `;
    return NextResponse.json(
      { workflows: workflows.map(mapWorkflowRow) },
      { status: 200 }
    );
  } catch (error) {
    console.error("[API /workflows GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch workflows" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = parseWorkflowInput(
      (await req.json()) as Record<string, unknown>
    );

    const insertedWorkflows = await sql<WorkflowRow[]>`
      insert into workflows (
        user_id,
        name,
        type,
        amount,
        description,
        category,
        payment_method,
        split_amount
      )
      values (
        ${userId},
        ${payload.name},
        ${payload.type},
        ${payload.amount},
        ${payload.description},
        ${payload.category},
        ${payload.paymentMethod},
        ${payload.splitAmount}
      )
      returning *
    `;

    const workflow = insertedWorkflows[0];
    return NextResponse.json(
      { workflow: mapWorkflowRow(workflow) },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("[API /workflows POST] Error:", error);
    return NextResponse.json(
      { error: "Failed to create workflow" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Workflow ID is required" },
        { status: 400 }
      );
    }
    const deletedWorkflows = await sql<WorkflowRow[]>`
      delete from workflows
      where id = ${id} and user_id = ${userId}
      returning *
    `;

    const workflow = deletedWorkflows[0];

    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { message: "Workflow deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("[API /workflows DELETE] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete workflow" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Workflow ID is required" },
        { status: 400 }
      );
    }

    const payload = parseWorkflowInput(
      (await req.json()) as Record<string, unknown>
    );

    const updatedWorkflows = await sql<WorkflowRow[]>`
      update workflows
      set
        name = ${payload.name},
        type = ${payload.type},
        amount = ${payload.amount},
        description = ${payload.description},
        category = ${payload.category},
        payment_method = ${payload.paymentMethod},
        split_amount = ${payload.splitAmount}
      where id = ${id} and user_id = ${userId}
      returning *
    `;

    const workflow = updatedWorkflows[0];

    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { workflow: mapWorkflowRow(workflow) },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("[API /workflows PUT] Error:", error);
    return NextResponse.json(
      { error: "Failed to update workflow" },
      { status: 500 }
    );
  }
}
