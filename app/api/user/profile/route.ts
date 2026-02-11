import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/lib/models/User";

export async function GET() {
  try {
    const { userId } = await auth();
    console.log("[API /user/profile GET] userId:", userId);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const user = await User.findOne({ clerkId: userId });

    if (!user) {
      console.log("[API /user/profile GET] User not found");
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    console.log("[API /user/profile GET] User found:", user.name);
    return NextResponse.json({ profile: user });
  } catch (error) {
    console.error("[API /user/profile GET] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { userId } = await auth();
    console.log("[API /user/profile PUT] userId:", userId);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();
    console.log("[API /user/profile PUT] Data:", data);

    await connectDB();

    const clerkUser = await currentUser();
    const email = clerkUser?.primaryEmailAddress?.emailAddress || "";

    let user = await User.findOne({ clerkId: userId });

    if (!user) {
      console.log("[API /user/profile PUT] Creating new user");
      user = await User.create({
        clerkId: userId,
        email,
        name: data.name || "",
        occupation: data.occupation || "",
        paymentMethods: data.paymentMethods || [],
        balances: data.balances || { bank: 0, cash: 0, splitwise: 0 },
        onboarded: data.onboarded ?? false,
      });
    } else {
      console.log("[API /user/profile PUT] Updating existing user");
      if (data.name !== undefined) user.name = data.name;
      if (data.occupation !== undefined) user.occupation = data.occupation;
      if (data.paymentMethods !== undefined) user.paymentMethods = data.paymentMethods;
      if (data.balances !== undefined) {
        user.balances = { ...user.balances, ...data.balances };
      }
      if (data.onboarded !== undefined) user.onboarded = data.onboarded;
      await user.save();
    }

    console.log("[API /user/profile PUT] Saved user:", user.name);
    return NextResponse.json({ profile: user });
  } catch (error) {
    console.error("[API /user/profile PUT] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
