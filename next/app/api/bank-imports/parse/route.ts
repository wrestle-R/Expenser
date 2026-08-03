import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  buildNotificationImportKey,
  buildNotificationReviewKey,
  isFinancialNotificationLike,
  parseBankNotification,
  type ParsedBankReviewEvent,
  type ParsedFinancialNotification,
} from "@/lib/bank-import-parser";

const MAX_MESSAGE_LENGTH = 4_000;
const MAX_SENDER_LENGTH = 160;
const MAX_PACKAGE_LENGTH = 240;
const GROQ_TIMEOUT_MS = 8_000;
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";

type NotificationEnvelope = {
  message: string;
  sender: string | null;
  capturedAt: string;
  sourcePackage: string | null;
  sourceKey: string | null;
};

type ParseResult =
  | { kind: "transaction"; parsed: ParsedFinancialNotification }
  | { kind: "review_event"; event: ParsedBankReviewEvent }
  | { kind: "non_transaction"; reason: string }
  | { kind: "unparsed"; reason: string };

class ParseRouteError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly category: string
  ) {
    super(message);
  }
}

function finiteNumber(value: unknown, nullable = false) {
  if (nullable && value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function nullableText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text.slice(0, maxLength) : null;
}

function validTimestamp(value: unknown, fallback?: string | null) {
  const primary = new Date(String(value ?? ""));
  if (!Number.isNaN(primary.getTime())) return primary.toISOString();
  const secondary = new Date(String(fallback ?? ""));
  return Number.isNaN(secondary.getTime()) ? null : secondary.toISOString();
}

function normalizeTransaction(
  value: unknown,
  capturedAt: string
): ParsedFinancialNotification | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const accountDigits = String(data.accountSuffix ?? "").replace(/\D/g, "");
  const type = data.type === "income" || data.type === "expense" ? data.type : null;
  const amount = finiteNumber(data.amount);
  const occurredAt = validTimestamp(data.occurredAt, capturedAt);
  const availableBalance = finiteNumber(data.availableBalance, true);
  const confidence = data.confidence === "high" ? "high" : data.confidence === "medium" ? "medium" : null;
  if (!type || amount == null || amount <= 0 || !occurredAt || !confidence) return null;

  return {
    bankName: nullableText(data.bankName, 120),
    accountSuffix: accountDigits ? accountDigits.slice(-4) : null,
    type,
    amount,
    currency: "INR",
    occurredAt,
    referenceNumber: nullableText(data.referenceNumber, 64),
    payee: nullableText(data.payee, 160),
    availableBalance:
      availableBalance != null && availableBalance >= 0 ? availableBalance : null,
    confidence,
  };
}

function normalizeReviewEvent(
  value: unknown,
  capturedAt: string
): ParsedBankReviewEvent | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const eventType = String(data.eventType ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .slice(0, 80);
  const summary = String(data.summary ?? "").trim().slice(0, 160);
  if (!eventType || !summary) return null;
  const amount = finiteNumber(data.amount, true);
  const suffix = String(data.accountSuffix ?? "").replace(/\D/g, "");
  const confidence =
    data.confidence === "high"
      ? "high"
      : data.confidence === "medium"
        ? "medium"
        : "low";

  return {
    bankName: nullableText(data.bankName, 120),
    eventType,
    amount: amount != null && amount >= 0 ? amount : null,
    accountSuffix: suffix ? suffix.slice(-4) : null,
    occurredAt: validTimestamp(data.occurredAt, capturedAt),
    summary,
    confidence,
  };
}

async function parseWithGroq(envelope: NotificationEnvelope): Promise<ParseResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new ParseRouteError("Groq fallback is not configured", 503, "not_configured");
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
        max_completion_tokens: 600,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "financial_sms_notification",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                kind: {
                  type: "string",
                  enum: ["transaction", "review_event", "non_transaction", "unparsed"],
                },
                reason: { type: ["string", "null"] },
                parsed: {
                  anyOf: [
                    { type: "null" },
                    {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        bankName: { type: ["string", "null"] },
                        accountSuffix: { type: ["string", "null"] },
                        type: { type: "string", enum: ["income", "expense"] },
                        amount: { type: "number" },
                        currency: { type: "string", enum: ["INR"] },
                        occurredAt: { type: "string" },
                        referenceNumber: { type: ["string", "null"] },
                        payee: { type: ["string", "null"] },
                        availableBalance: { type: ["number", "null"] },
                        confidence: { type: "string", enum: ["high", "medium", "low"] },
                      },
                      required: [
                        "bankName",
                        "accountSuffix",
                        "type",
                        "amount",
                        "currency",
                        "occurredAt",
                        "referenceNumber",
                        "payee",
                        "availableBalance",
                        "confidence",
                      ],
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
                        bankName: { type: ["string", "null"] },
                        eventType: { type: "string" },
                        amount: { type: ["number", "null"] },
                        accountSuffix: { type: ["string", "null"] },
                        occurredAt: { type: ["string", "null"] },
                        summary: { type: "string" },
                        confidence: { type: "string", enum: ["high", "medium", "low"] },
                      },
                      required: [
                        "bankName",
                        "eventType",
                        "amount",
                        "accountSuffix",
                        "occurredAt",
                        "summary",
                        "confidence",
                      ],
                    },
                  ],
                },
              },
              required: ["kind", "reason", "parsed", "event"],
            },
          },
        },
        messages: [
          {
            role: "system",
            content:
              "Classify Indian financial SMS notifications. Return transaction only for a completed debit, credit, spend, withdrawal, deposit, or receipt. Payment/collect requests, future-tense debits, OTPs, promotions, recharge credits, failed/declined payments, and refund promises are non_transaction. Liens, cheque-clearing notices, and ambiguous account events are review_event. Never guess missing amount or direction. Use capturedAt as occurredAt only when the SMS clearly confirms a completed transaction but omits its timestamp. Use unparsed when confidence is low. Currency is INR.",
          },
          {
            role: "user",
            content: JSON.stringify({
              sender: envelope.sender,
              capturedAt: envelope.capturedAt,
              message: envelope.message,
            }),
          },
        ],
      }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ParseRouteError("Groq fallback timed out", 503, "timeout");
    }
    throw new ParseRouteError("Groq fallback is unavailable", 503, "unavailable");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const rateLimited = response.status === 429;
    throw new ParseRouteError(
      rateLimited ? "Groq rate limit reached" : "Groq fallback failed",
      rateLimited ? 429 : 503,
      rateLimited ? "rate_limited" : "upstream_failure"
    );
  }

  try {
    const body = await response.json();
    const content = body?.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("Missing completion");
    const decoded = JSON.parse(content) as Record<string, unknown>;
    if (decoded.kind === "transaction") {
      const parsed = normalizeTransaction(decoded.parsed, envelope.capturedAt);
      if (parsed) return { kind: "transaction", parsed };
    }
    if (decoded.kind === "review_event") {
      const event = normalizeReviewEvent(decoded.event, envelope.capturedAt);
      if (event) return { kind: "review_event", event };
    }
    if (decoded.kind === "non_transaction") {
      return {
        kind: "non_transaction",
        reason: nullableText(decoded.reason, 120) ?? "not_a_completed_transaction",
      };
    }
    return {
      kind: "unparsed",
      reason: nullableText(decoded.reason, 120) ?? "parser_could_not_validate",
    };
  } catch {
    throw new ParseRouteError(
      "Groq returned an invalid structured response",
      503,
      "invalid_response"
    );
  }
}

function parseEnvelope(body: Record<string, unknown>): NotificationEnvelope | null {
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > MAX_MESSAGE_LENGTH) return null;
  const capturedAt = validTimestamp(body.capturedAt);
  const sourcePackage = nullableText(body.sourcePackage, MAX_PACKAGE_LENGTH);
  const sourceKey = nullableText(body.sourceKey, 256);
  if (!capturedAt || !sourcePackage || !sourceKey) return null;
  return {
    message,
    sender: nullableText(body.sender, MAX_SENDER_LENGTH),
    capturedAt,
    sourcePackage,
    sourceKey,
  };
}

function logOutcome(kind: ParseResult["kind"], parser: "regex" | "groq", startedAt: number) {
  console.info("[API /bank-imports/parse]", {
    kind,
    parser,
    latencyMs: Date.now() - startedAt,
  });
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const envelope = parseEnvelope(body);
    if (!envelope) {
      return NextResponse.json(
        { error: "A valid message and capturedAt are required" },
        { status: 400 }
      );
    }

    if (!isFinancialNotificationLike(envelope.message)) {
      logOutcome("non_transaction", "regex", startedAt);
      return NextResponse.json({
        kind: "non_transaction",
        reason: "not_financial",
        parser: "regex",
      });
    }

    const deterministic = parseBankNotification(envelope.message, envelope);
    const result = deterministic ?? (await parseWithGroq(envelope));
    const parser = deterministic ? "regex" : "groq";
    logOutcome(result.kind, parser, startedAt);

    if (result.kind === "non_transaction" || result.kind === "unparsed") {
      return NextResponse.json({ ...result, parser });
    }
    if (result.kind === "review_event") {
      return NextResponse.json({
        kind: "review_event",
        event: result.event,
        importSource: "sms_notification_review",
        importSourceKey:
          buildNotificationReviewKey(result.event, envelope) ?? envelope.sourceKey,
        parser,
      });
    }
    return NextResponse.json({
      kind: "transaction",
      parsed: result.parsed,
      importSource: "sms_notification",
      importSourceKey:
        buildNotificationImportKey(result.parsed, envelope) ?? envelope.sourceKey,
      parser,
    });
  } catch (error) {
    if (error instanceof ParseRouteError) {
      console.info("[API /bank-imports/parse]", {
        kind: "failure",
        parser: "groq",
        latencyMs: Date.now() - startedAt,
        failureCategory: error.category,
        status: error.status,
      });
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[API /bank-imports/parse] Unexpected parser failure", {
      error: error instanceof Error ? error.name : "UnknownError",
      latencyMs: Date.now() - startedAt,
    });
    return NextResponse.json({ error: "Failed to parse financial notification" }, { status: 500 });
  }
}
