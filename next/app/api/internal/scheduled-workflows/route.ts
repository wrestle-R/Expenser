import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runEncryptedWorkflows } from "@/lib/run-encrypted-workflows";

export async function POST(req: Request) {
  const token = process.env.FINANCIAL_SCHEDULER_TOKEN;
  const provided = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${token ?? ""}`);
  if (!token || provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runEncryptedWorkflows();
    return NextResponse.json(result, { status: result.retrying ? 503 : 200 });
  } catch {
    console.error("[Scheduled workflows] Encrypted batch unavailable");
    return NextResponse.json({ error: "Scheduled batch unavailable" }, { status: 503 });
  }
}
