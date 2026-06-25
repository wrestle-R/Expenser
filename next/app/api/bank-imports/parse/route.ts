import { NextResponse } from "next/server";
import { buildBankImportKey, parseUnionBankNotification } from "@/lib/bank-import-parser.js";

type ParsedBankNotification = NonNullable<
  ReturnType<typeof parseUnionBankNotification>
>;

function normalizeGroqType(value: unknown) {
  return value === "income" || value === "expense" ? value : null;
}

function normalizeGroqNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeGroqParsed(value: unknown): ParsedBankNotification | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const data = value as Record<string, unknown>;
  const type = normalizeGroqType(data.type);
  const amount = normalizeGroqNumber(data.amount);
  const availableBalance = normalizeGroqNumber(data.availableBalance);
  const occurredAt =
    typeof data.occurredAt === "string" &&
    !Number.isNaN(new Date(data.occurredAt).getTime())
      ? new Date(data.occurredAt).toISOString()
      : null;
  const accountSuffix =
    typeof data.accountSuffix === "string" && data.accountSuffix.trim()
      ? data.accountSuffix.trim()
      : null;

  if (!type || amount == null || availableBalance == null || !occurredAt || !accountSuffix) {
    return null;
  }

  return {
    bankName: "Union Bank of India",
    accountSuffix,
    type,
    amount,
    occurredAt,
    referenceNumber:
      typeof data.referenceNumber === "string" && data.referenceNumber.trim()
        ? data.referenceNumber.trim()
        : null,
    payee:
      typeof data.payee === "string" && data.payee.trim()
        ? data.payee.trim()
        : null,
    availableBalance,
    confidence: "medium",
  };
}

async function parseWithGroq(message: string) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return null;
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Extract one Union Bank of India SMS transaction. Return JSON only with accountSuffix, type (income or expense), amount, occurredAt ISO string in Asia/Kolkata converted to UTC, referenceNumber or null, payee or null, and availableBalance. Return {\"parsed\":null} if this is not a Union Bank debit/credit transaction.",
        },
        {
          role: "user",
          content: message,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq parse failed with status ${response.status}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    return null;
  }

  const decoded = JSON.parse(content) as Record<string, unknown>;
  return normalizeGroqParsed(decoded.parsed ?? decoded);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const regexParsed = parseUnionBankNotification(message);
    const parsed = regexParsed ?? (await parseWithGroq(message));
    if (!parsed) {
      return NextResponse.json({ parsed: null }, { status: 200 });
    }

    return NextResponse.json({
      parsed,
      importSource: "union_bank_notification",
      importSourceKey: buildBankImportKey(parsed),
      parser: regexParsed ? "regex" : "groq",
    });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[API /bank-imports/parse] Error:", error);
    return NextResponse.json({ error: "Failed to parse bank notification" }, { status: 500 });
  }
}
