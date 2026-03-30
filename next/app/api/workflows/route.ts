import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  mapWorkflowRow,
  normalizeNumber,
  sql,
  type WorkflowRow,
} from "@/lib/db";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[API /workflows GET] userId:", userId);

    const workflows = await sql<WorkflowRow[]>`
      select *
      from workflows
      where user_id = ${userId}
      order by created_at desc
    `;

    console.log("[API /workflows GET] Found", workflows.length, "workflows");
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

    const body = await req.json();
    const {
      name,
      type,
      amount,
      description,
      category,
      paymentMethod,
      splitAmount,
    } = body;

    console.log("[API /workflows POST] Creating workflow:", {
      userId,
      name,
      type,
      amount,
      category,
      paymentMethod,
      splitAmount,
    });

    if (!name || !type || !description || !paymentMethod) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

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
        ${name},
        ${type},
        ${normalizeNumber(amount, 0)},
        ${description},
        ${category || "General"},
        ${paymentMethod},
        ${normalizeNumber(splitAmount, 0)}
      )
      returning *
    `;

    const workflow = insertedWorkflows[0];
    console.log("[API /workflows POST] Workflow created:", workflow.id);
    return NextResponse.json(
      { workflow: mapWorkflowRow(workflow) },
      { status: 201 }
    );
  } catch (error) {
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

    console.log("[API /workflows DELETE] Deleting workflow:", id);

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

    console.log("[API /workflows DELETE] Workflow deleted successfully");
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

    const body = await req.json();
    const {
      name,
      type,
      amount,
      description,
      category,
      paymentMethod,
      splitAmount,
    } = body;

    console.log("[API /workflows PUT] Updating workflow:", id);

    const updatedWorkflows = await sql<WorkflowRow[]>`
      update workflows
      set
        name = ${name},
        type = ${type},
        amount = ${normalizeNumber(amount, 0)},
        description = ${description},
        category = ${category || "General"},
        payment_method = ${paymentMethod},
        split_amount = ${normalizeNumber(splitAmount, 0)}
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

    console.log("[API /workflows PUT] Workflow updated successfully");
    return NextResponse.json(
      { workflow: mapWorkflowRow(workflow) },
      { status: 200 }
    );
  } catch (error) {
    console.error("[API /workflows PUT] Error:", error);
    return NextResponse.json(
      { error: "Failed to update workflow" },
      { status: 500 }
    );
  }
}
