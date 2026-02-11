import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectDB } from "@/lib/mongodb";
import Workflow from "@/lib/models/Workflow";

// GET: Fetch all workflows for the authenticated user
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[API /workflows GET] userId:", userId);

    await connectDB();
    const workflows = await Workflow.find({ userId }).sort({ createdAt: -1 });

    console.log("[API /workflows GET] Found", workflows.length, "workflows");
    return NextResponse.json({ workflows }, { status: 200 });
  } catch (error) {
    console.error("[API /workflows GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch workflows" },
      { status: 500 }
    );
  }
}

// POST: Create a new workflow
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

    await connectDB();

    const workflow = await Workflow.create({
      userId,
      name,
      type,
      amount: amount || 0,
      description,
      category: category || "General",
      paymentMethod,
      splitAmount: splitAmount || 0,
    });

    console.log("[API /workflows POST] Workflow created:", workflow._id);
    return NextResponse.json({ workflow }, { status: 201 });
  } catch (error) {
    console.error("[API /workflows POST] Error:", error);
    return NextResponse.json(
      { error: "Failed to create workflow" },
      { status: 500 }
    );
  }
}

// DELETE: Delete a workflow by ID
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

    await connectDB();
    const workflow = await Workflow.findOneAndDelete({ _id: id, userId });

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

// PUT: Update a workflow by ID
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

    await connectDB();
    const workflow = await Workflow.findOneAndUpdate(
      { _id: id, userId },
      {
        name,
        type,
        amount: amount || 0,
        description,
        category: category || "General",
        paymentMethod,
        splitAmount: splitAmount || 0,
      },
      { new: true }
    );

    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    console.log("[API /workflows PUT] Workflow updated successfully");
    return NextResponse.json({ workflow }, { status: 200 });
  } catch (error) {
    console.error("[API /workflows PUT] Error:", error);
    return NextResponse.json(
      { error: "Failed to update workflow" },
      { status: 500 }
    );
  }
}
