import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectDB } from "@/lib/mongodb";
import { Transaction } from "@/lib/models/Transaction";
import { User } from "@/lib/models/User";

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    console.log("[API /transactions GET] userId:", userId);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const transactions = await Transaction.find({ clerkId: userId }).sort({ date: -1 });

    console.log("[API /transactions GET] Found", transactions.length, "transactions");
    return NextResponse.json({ transactions });
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

    await connectDB();

    const transaction = await Transaction.create({
      clerkId: userId,
      type: data.type,
      amount: data.amount,
      description: data.description,
      category: data.category || "General",
      paymentMethod: data.paymentMethod,
      date: data.date || new Date(),
    });

    // Update user balance
    const user = await User.findOne({ clerkId: userId });
    if (user) {
      const method = data.paymentMethod as "bank" | "cash" | "splitwise";
      const amt = data.type === "income" ? data.amount : -data.amount;
      user.balances[method] = (user.balances[method] || 0) + amt;
      await user.save();
      console.log("[API /transactions POST] Updated balance for", method, ":", user.balances[method]);
    }

    console.log("[API /transactions POST] Created transaction:", transaction._id);
    return NextResponse.json({ transaction });
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

    await connectDB();
    const transaction = await Transaction.findOneAndDelete({ _id: id, clerkId: userId });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Reverse the balance change
    const user = await User.findOne({ clerkId: userId });
    if (user) {
      const method = transaction.paymentMethod as "bank" | "cash" | "splitwise";
      const amt = transaction.type === "income" ? -transaction.amount : transaction.amount;
      user.balances[method] = (user.balances[method] || 0) + amt;
      await user.save();
      console.log("[API /transactions DELETE] Reversed balance for", method);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API /transactions DELETE] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
