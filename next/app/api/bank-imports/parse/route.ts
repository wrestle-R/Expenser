import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  buildBankImportKey,
  buildBankReviewEventKey,
  isUnionBankLike,
  parseBankNotification,
  type ParsedBankReviewEvent,
  type ParsedUnionBankNotification,
} from "@/lib/bank-import-parser";

const MAX_MESSAGE_LENGTH = 4_000;
const GROQ_TIMEOUT_MS = 8_000;
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";

class ParseRouteError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function finiteNumber(value: unknown, nullable = false) {
  if (nullable && value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeTransaction(value: unknown): ParsedUnionBankNotification | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const accountSuffix = String(data.accountSuffix ?? "").replace(/\D/g, "").slice(-4);
  const type = data.type === "income" || data.type === "expense" ? data.type : null;
  const amount = finiteNumber(data.amount);
  const occurredAt = new Date(String(data.occurredAt ?? ""));
  const availableBalance = finiteNumber(data.availableBalance, true);
  if (!accountSuffix || !type || amount == null || amount <= 0 || Number.isNaN(occurredAt.getTime())) {
    return null;
  }

  return {
    bankName: "Union Bank of India" as const,
    accountSuffix,
    type,
    amount,
    occurredAt: occurredAt.toISOString(),
    referenceNumber:
      typeof data.referenceNumber === "string" && data.referenceNumber.trim()
        ? data.referenceNumber.trim().slice(0, 64)
        : null,
    payee:
      typeof data.payee === "string" && data.payee.trim()
        ? data.payee.trim().slice(0, 160)
        : null,
    availableBalance:
      availableBalance != null && availableBalance >= 0 ? availableBalance : null,
    confidence: data.confidence === "high" ? "high" : "medium",
  };
}

function normalizeReviewEvent(value: unknown): ParsedBankReviewEvent | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const eventType = String(data.eventType ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .slice(0, 80);
  const summary = String(data.summary ?? "").trim().slice(0, 160);
  if (!eventType || !summary) return null;
  const occurredAt = data.occurredAt == null ? null : new Date(String(data.occurredAt));
  const amount = finiteNumber(data.amount, true);
  const suffix = String(data.accountSuffix ?? "").replace(/\D/g, "").slice(-4);

  return {
    bankName: "Union Bank of India" as const,
    eventType,
    amount,
    accountSuffix: suffix || null,
    occurredAt:
      occurredAt && !Number.isNaN(occurredAt.getTime()) ? occurredAt.toISOString() : null,
    summary,
    confidence: data.confidence === "high" ? "high" : data.confidence === "medium" ? "medium" : "low",
  };
}

async function parseWithGroq(message: string) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new ParseRouteError("Groq fallback is not configured", 503);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0,
        max_completion_tokens: 500,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "union_bank_notification",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                kind: { type: "string", enum: ["transaction", "review_event", "unparsed"] },
                parsed: {
                  anyOf: [
                    { type: "null" },
                    {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        accountSuffix: { type: "string" },
                        type: { type: "string", enum: ["income", "expense"] },
                        amount: { type: "number" },
                        occurredAt: { type: "string" },
                        referenceNumber: { type: ["string", "null"] },
                        payee: { type: ["string", "null"] },
                        availableBalance: { type: ["number", "null"] },
                        confidence: { type: "string", enum: ["high", "medium", "low"] },
                      },
                      required: ["accountSuffix", "type", "amount", "occurredAt", "referenceNumber", "payee", "availableBalance", "confidence"],
                    },
                  ],
                },
                event: {
                  anyOf: [
                    { type: "null" },
                    {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        eventType: { type: "string" },
                        amount: { type: ["number", "null"] },
                        accountSuffix: { type: ["string", "null"] },
                        occurredAt: { type: ["string", "null"] },
                        summary: { type: "string" },
                        confidence: { type: "string", enum: ["high", "medium", "low"] },
                      },
                      required: ["eventType", "amount", "accountSuffix", "occurredAt", "summary", "confidence"],
                    },
                  ],
                },
              },
              required: ["kind", "parsed", "event"],
            },
          },
        },
        messages: [
          {
            role: "system",
            content: "Extract only Union Bank of India debit, credit, or account-event data. Convert Indian local timestamps to UTC ISO. Use kind=unparsed when the message is not sufficiently clear. For transaction set event=null; for review_event set parsed=null; for unparsed set both null.",
          },
          { role: "user", content: message },
        ],
      }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ParseRouteError("Groq fallback timed out", 503);
    }
    throw new ParseRouteError("Groq fallback is unavailable", 503);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new ParseRouteError(
      response.status === 429 ? "Groq rate limit reached" : "Groq fallback failed",
      response.status === 429 ? 429 : 503
    );
  }

  try {
    const body = await response.json();
    const content = body?.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("Missing completion");
    const decoded = JSON.parse(content) as Record<string, unknown>;
    if (decoded.kind === "transaction") {
      const parsed = normalizeTransaction(decoded.parsed);
      if (parsed) return { kind: "transaction" as const, parsed };
    }
    if (decoded.kind === "review_event") {
      const event = normalizeReviewEvent(decoded.event);
      if (event) return { kind: "review_event" as const, event };
    }
    return { kind: "unparsed" as const };
  } catch {
    throw new ParseRouteError("Groq returned an invalid structured response", 503);
  }
}

export async function POST(req: Request) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) return NextResponse.json({ error: "message is required" }, { status: 400 });
    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ error: "message is too long" }, { status: 400 });
    }
    if (!isUnionBankLike(message)) {
      return NextResponse.json({ kind: "unparsed", parser: "regex" });
    }

    const deterministic = parseBankNotification(message);
    const result = deterministic ?? (await parseWithGroq(message));
    const parser = deterministic ? "regex" : "groq";
    if (result.kind === "unparsed") {
      return NextResponse.json({ kind: "unparsed", parser });
    }
    if (result.kind === "review_event") {
      return NextResponse.json({
        kind: "review_event",
        event: result.event,
        importSource: "union_bank_event",
        importSourceKey: buildBankReviewEventKey(result.event, message),
        parser,
      });
    }
    return NextResponse.json({
      kind: "transaction",
      parsed: result.parsed,
      importSource: "union_bank_notification",
      importSourceKey: buildBankImportKey(result.parsed, message),
      parser,
    });
  } catch (error) {
    if (error instanceof ParseRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[API /bank-imports/parse] Error:", error);
    return NextResponse.json({ error: "Failed to parse bank notification" }, { status: 500 });
  }
}
