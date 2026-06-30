import { NextResponse } from "next/server";
import {
  buildBankImportKey,
  buildBankReviewEventKey,
  parseBankNotification,
  parseUnionBankNotification,
  type ParsedBankReviewEvent,
} from "@/lib/bank-import-parser.js";

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

function normalizeGroqReviewEvent(value: unknown): ParsedBankReviewEvent | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const data = value as Record<string, unknown>;
  const eventType =
    typeof data.eventType === "string" && data.eventType.trim()
      ? data.eventType.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_")
      : null;
  const summary =
    typeof data.summary === "string" && data.summary.trim()
      ? data.summary.trim().slice(0, 160)
      : null;

  if (!eventType || !summary) {
    return null;
  }

  const amount = data.amount == null ? null : normalizeGroqNumber(data.amount);
  const occurredAt =
    typeof data.occurredAt === "string" &&
    !Number.isNaN(new Date(data.occurredAt).getTime())
      ? new Date(data.occurredAt).toISOString()
      : null;
  const accountSuffix =
    typeof data.accountSuffix === "string" && data.accountSuffix.trim()
      ? data.accountSuffix.trim().replace(/\D/g, "").slice(-4) || null
      : null;

  return {
    bankName: "Union Bank of India",
    eventType,
    amount,
    accountSuffix,
    occurredAt,
    summary,
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
            "Extract one Union Bank of India notification. Return JSON only. For debit/credit transactions return {\"kind\":\"transaction\",\"parsed\":{\"accountSuffix\":\"4280\",\"type\":\"income\" or \"expense\",\"amount\":123.45,\"occurredAt\":\"UTC ISO string converted from Asia/Kolkata\",\"referenceNumber\":string or null,\"payee\":string or null,\"availableBalance\":123.45}}. For non-transaction account events return {\"kind\":\"review_event\",\"event\":{\"eventType\":short_snake_case,\"amount\":number or null,\"accountSuffix\":string or null,\"occurredAt\":\"UTC ISO string\" or null,\"summary\":short string}}. Return {\"parsed\":null} if this is not a Union Bank notification.",
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
  const kind = decoded.kind;

  if (kind === "review_event") {
    const event = normalizeGroqReviewEvent(decoded.event);
    return event ? { kind: "review_event" as const, event } : null;
  }

  const parsed = normalizeGroqParsed(decoded.parsed ?? decoded);
  return parsed ? { kind: "transaction" as const, parsed } : null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const deterministic = parseBankNotification(message);
    const result = deterministic ?? (await parseWithGroq(message));
    if (!result) {
      return NextResponse.json({ parsed: null }, { status: 200 });
    }

    const parser = deterministic ? "regex" : "groq";
    if (result.kind === "review_event") {
      return NextResponse.json({
        kind: "review_event",
        event: result.event,
        importSource: "union_bank_event",
        importSourceKey: buildBankReviewEventKey(result.event),
        parser,
      });
    }

    return NextResponse.json({
      kind: "transaction",
      parsed: result.parsed,
      importSource: "union_bank_notification",
      importSourceKey: buildBankImportKey(result.parsed),
      parser,
    });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[API /bank-imports/parse] Error:", error);
    return NextResponse.json({ error: "Failed to parse bank notification" }, { status: 500 });
  }
}
