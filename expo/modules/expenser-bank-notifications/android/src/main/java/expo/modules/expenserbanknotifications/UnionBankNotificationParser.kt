package expo.modules.expenserbanknotifications

import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

object UnionBankNotificationParser {
  private val coreRegex = Regex(
    "\\bA/c\\s+\\*(\\d{3,8})\\s+(Debited|Credited(?:\\s+for)?)\\s+Rs:?([\\d,]+(?:\\.\\d{1,2})?)\\s+on\\s+(\\d{2}-\\d{2}-\\d{4})\\s+(\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?)",
    RegexOption.IGNORE_CASE
  )
  private val balanceRegex = Regex(
    "\\bAvl\\s+Bal\\s+Rs:?([\\d,]+(?:\\.\\d{1,2})?)",
    RegexOption.IGNORE_CASE
  )
  private val referenceValueRegex = Regex(
    "\\bref\\s+no\\s+([^,]*?)(?=\\s+Avl\\s+Bal\\b|,|$)",
    RegexOption.IGNORE_CASE
  )
  private val payeeRegex = Regex("\\bFvg:\\s*(.*?)(?:\\s+Avl\\s+Bal\\b|$)", RegexOption.IGNORE_CASE)
  private val lienRemovedRegex = Regex(
    "\\blien\\s+of\\s+Rs\\.?:?([\\d,]+(?:\\.\\d{1,2})?).*?\\bremoved\\b.*?\\baccount\\s+\\*+(\\d{3,8})\\s*on\\s+(\\d{2}-\\d{2}-\\d{4})\\s+(\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?)",
    RegexOption.IGNORE_CASE
  )

  fun isUnionBankLike(message: String): Boolean {
    return message.contains("Union Bank of India", ignoreCase = true) ||
      Regex("\\bA/c\\s+\\*\\d{3,8}\\b", RegexOption.IGNORE_CASE).containsMatchIn(message)
  }

  fun parse(message: String): JSONObject? {
    return parseTransaction(message)
  }

  fun parseBankNotification(message: String): JSONObject? {
    parseTransaction(message)?.let {
      return JSONObject()
        .put("kind", "transaction")
        .put("parsed", it)
    }

    parseReviewEvent(message)?.let {
      return JSONObject()
        .put("kind", "review_event")
        .put("event", it)
    }

    return null
  }

  fun parseTransaction(message: String): JSONObject? {
    val text = normalizeText(message)
    if (!isUnionBankLike(text)) {
      return null
    }

    val core = coreRegex.find(text) ?: return null
    val balance = balanceRegex.find(text) ?: return null
    val accountSuffix = normalizeAccountSuffix(core.groupValues[1]) ?: return null
    val rawType = core.groupValues[2]
    val amount = parseAmount(core.groupValues[3]) ?: return null
    val occurredAt = parseDate(core.groupValues[4], core.groupValues[5]) ?: return null
    val availableBalance = parseAmount(balance.groupValues[1]) ?: return null
    val referenceValue = normalizeReferenceValue(referenceValueRegex.find(text)?.groupValues?.get(1))
    val referenceNumber = if (Regex("^\\d{6,}$").matches(referenceValue)) referenceValue else null
    val payee = normalizePayee(payeeRegex.find(text)?.groupValues?.get(1))
      ?: if (referenceValue.isNotBlank() && referenceNumber == null) normalizePayee(referenceValue) else null
    val transactionType = if (rawType.equals("Debited", ignoreCase = true)) "expense" else "income"

    val parsed = JSONObject()
      .put("bankName", "Union Bank of India")
      .put("accountSuffix", accountSuffix)
      .put("type", transactionType)
      .put("amount", amount)
      .put("occurredAt", occurredAt)
      .put("referenceNumber", referenceNumber ?: JSONObject.NULL)
      .put("payee", payee ?: JSONObject.NULL)
      .put("availableBalance", availableBalance)
      .put("confidence", if (!referenceNumber.isNullOrBlank()) "high" else "medium")
      .put("importSource", "union_bank_notification")
      .put("capturedAt", isoFormat().format(System.currentTimeMillis()))

    parsed.put("importSourceKey", buildTransactionKey(parsed))
    return parsed
  }

  fun parseReviewEvent(message: String): JSONObject? {
    val text = normalizeText(message.replace(Regex("(\\d)(on\\s+\\d{2}-\\d{2}-\\d{4})", RegexOption.IGNORE_CASE), "$1 $2"))
    if (!isUnionBankLike(text)) {
      return null
    }

    val lien = lienRemovedRegex.find(text)
    if (lien != null) {
      val amount = parseAmount(lien.groupValues[1]) ?: return null
      val accountSuffix = normalizeAccountSuffix(lien.groupValues[2]) ?: return null
      val occurredAt = parseDate(lien.groupValues[3], lien.groupValues[4]) ?: return null
      val event = JSONObject()
        .put("bankName", "Union Bank of India")
        .put("eventType", "lien_removed")
        .put("amount", amount)
        .put("accountSuffix", accountSuffix)
        .put("occurredAt", occurredAt)
        .put("summary", "Lien removed for general service charges")
        .put("confidence", "medium")
        .put("importSource", "union_bank_event")
        .put("capturedAt", isoFormat().format(System.currentTimeMillis()))

      event.put("importSourceKey", buildReviewEventKey(event))
      return event
    }

    return null
  }

  fun buildTransactionKey(parsed: JSONObject): String {
    val referenceNumber = parsed.nullableString("referenceNumber")
    if (!referenceNumber.isNullOrBlank()) {
      return "union-bank:ref:$referenceNumber"
    }

    return listOf(
      "union-bank:fallback",
      parsed.optString("accountSuffix"),
      parsed.optString("type"),
      "%.2f".format(Locale.US, parsed.optDouble("amount")),
      parsed.optString("occurredAt"),
      "%.2f".format(Locale.US, parsed.optDouble("availableBalance"))
    ).joinToString(":")
  }

  fun buildReviewEventKey(event: JSONObject): String {
    val amount = if (event.has("amount") && !event.isNull("amount")) {
      "%.2f".format(Locale.US, event.optDouble("amount"))
    } else {
      "unknown"
    }

    return listOf(
      "union-bank:event",
      event.optString("eventType", "unknown"),
      event.optString("accountSuffix", "unknown"),
      amount,
      event.optString("occurredAt", "unknown")
    ).joinToString(":")
  }

  private fun parseAmount(value: String): Double? {
    return value.replace(",", "").toDoubleOrNull()
  }

  private fun parseDate(datePart: String, timePart: String): String? {
    return try {
      val normalizedTime = Regex("^(\\d{2}:\\d{2}:\\d{2})").find(timePart)?.groupValues?.get(1)
        ?: return null
      val input = SimpleDateFormat("dd-MM-yyyy HH:mm:ss", Locale.US)
      input.timeZone = TimeZone.getTimeZone("Asia/Kolkata")
      val parsed = input.parse("$datePart $normalizedTime") ?: return null
      isoFormat().format(parsed)
    } catch (_: Exception) {
      null
    }
  }

  private fun normalizeText(value: String): String {
    return value.replace(Regex("\\s+"), " ").trim()
  }

  private fun normalizeReferenceValue(value: String?): String {
    val cleaned = normalizeText(value.orEmpty())
    return if (Regex("^Avl\\s+Bal\\b", RegexOption.IGNORE_CASE).containsMatchIn(cleaned)) "" else cleaned
  }

  private fun normalizeAccountSuffix(value: String?): String? {
    val digits = value?.replace(Regex("\\D"), "").orEmpty()
    if (digits.isBlank()) {
      return null
    }

    return if (digits.length > 4) digits.takeLast(4) else digits
  }

  private fun normalizePayee(value: String?): String? {
    val cleaned = value
      ?.replace(Regex("\\s+Avl\\s+Bal.*$", RegexOption.IGNORE_CASE), "")
      ?.replace(Regex("\\s+Never\\s+Share.*$", RegexOption.IGNORE_CASE), "")
      ?.replace(Regex("\\s+Not\\s+you\\?.*$", RegexOption.IGNORE_CASE), "")
      ?.replace(Regex("[.,\\s]+$"), "")
      ?.replace(Regex("\\s+"), " ")
      ?.trim()

    return if (cleaned.isNullOrBlank()) null else cleaned
  }

  private fun isoFormat(): SimpleDateFormat {
    val output = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
    output.timeZone = TimeZone.getTimeZone("UTC")
    return output
  }
}
