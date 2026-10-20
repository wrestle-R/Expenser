package expo.modules.expenserbanknotifications

import org.json.JSONObject
import java.text.SimpleDateFormat
import java.security.MessageDigest
import java.util.Locale
import java.util.TimeZone

object UnionBankNotificationParser {
  private val accountRegex = Regex(
    "\\b(?:A/?c|Alc|Acct(?:ount)?)\\s*(?:No\\.?\\s*)?[*%xX-]+\\s*(\\d{3,12})\\b",
    RegexOption.IGNORE_CASE
  )
  private val directionRegex = Regex(
    "\\b(Debited|Debit|Dr|Credited(?:\\s+for)?|Credit|Cr)\\b",
    RegexOption.IGNORE_CASE
  )
  private val amountRegex = Regex("(?:Rs\\.?|INR|₹)\\s*:?\\s*([\\d,]+(?:\\.\\d{1,2})?)", RegexOption.IGNORE_CASE)
  private val dateRegex = Regex(
    "\\b(\\d{2}[-/]\\d{2}[-/]\\d{4})\\s+(\\d{1,2}:\\d{2}(?::\\d{2}(?:\\.\\d+)?)?)\\s*(AM|PM)?\\b",
    RegexOption.IGNORE_CASE
  )
  private val balanceRegex = Regex(
    "\\b(?:Avl|Available)\\s+Bal(?:ance)?\\s*(?:Rs\\.?|INR|₹)?\\s*:?\\s*([\\d,]+(?:\\.\\d{1,2})?)",
    RegexOption.IGNORE_CASE
  )
  private val referenceValueRegex = Regex(
    "\\bref(?:erence)?\\s*(?:no\\.?|number)?\\s*[:#-]?\\s*([^,]*?)(?=\\s+(?:Avl|Available)\\s+Bal\\b|,|$)",
    RegexOption.IGNORE_CASE
  )
  private val payeeRegex = Regex("\\b(?:Fvg|To|At)\\s*:\\s*(.*?)(?=\\s+(?:Avl|Available)\\s+Bal\\b|$)", RegexOption.IGNORE_CASE)
  private val lienRemovedRegex = Regex(
    "\\blien\\s+of\\s+(?:Rs\\.?)?\\s*:?\\s*([\\d,]+(?:\\.\\d{1,2})?).*?\\bremoved\\b.*?\\baccount\\s+\\*+(\\d{3,12})\\s*on\\s+(\\d{2}[-/]\\d{2}[-/]\\d{4})\\s+(\\d{1,2}:\\d{2}(?::\\d{2}(?:\\.\\d+)?)?)\\s*(AM|PM)?",
    RegexOption.IGNORE_CASE
  )

  fun isUnionBankLike(message: String): Boolean {
    return message.contains("Union Bank of India", ignoreCase = true) ||
      accountRegex.containsMatchIn(message)
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

    val account = accountRegex.find(text) ?: return null
    val direction = directionRegex.find(text) ?: return null
    val date = dateRegex.find(text) ?: return null
    val amountMatch = amountRegex.find(text, direction.range.last + 1) ?: return null
    val accountSuffix = normalizeAccountSuffix(account.groupValues[1]) ?: return null
    val rawType = direction.groupValues[1]
    val amount = parseAmount(amountMatch.groupValues[1]) ?: return null
    val occurredAt = parseDate(date.groupValues[1], date.groupValues[2], date.groupValues.getOrNull(3)) ?: return null
    val availableBalance = balanceRegex.find(text)?.groupValues?.get(1)?.let(::parseAmount)
    val referenceValue = normalizeReferenceValue(referenceValueRegex.find(text)?.groupValues?.get(1))
    val referenceNumber = if (Regex("^\\d{6,}$").matches(referenceValue)) referenceValue else null
    val payee = normalizePayee(payeeRegex.find(text)?.groupValues?.get(1))
      ?: if (referenceValue.isNotBlank() && referenceNumber == null) normalizePayee(referenceValue) else null
    val transactionType = if (Regex("^(?:Debited|Debit|Dr)$", RegexOption.IGNORE_CASE).matches(rawType)) "expense" else "income"

    val parsed = JSONObject()
      .put("bankName", "Union Bank of India")
      .put("accountSuffix", accountSuffix)
      .put("type", transactionType)
      .put("amount", amount)
      .put("occurredAt", occurredAt)
      .put("referenceNumber", referenceNumber ?: JSONObject.NULL)
      .put("payee", payee ?: JSONObject.NULL)
      .put("availableBalance", availableBalance ?: JSONObject.NULL)
      .put("confidence", if (!referenceNumber.isNullOrBlank() && availableBalance != null) "high" else "medium")
      .put("importSource", "union_bank_notification")
      .put("capturedAt", isoFormat().format(System.currentTimeMillis()))

    parsed.put("importSourceKey", buildTransactionKey(parsed, text))
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
      val occurredAt = parseDate(lien.groupValues[3], lien.groupValues[4], lien.groupValues.getOrNull(5)) ?: return null
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

      event.put("importSourceKey", buildReviewEventKey(event, text))
      return event
    }

    return null
  }

  fun buildTransactionKey(parsed: JSONObject, message: String? = null): String {
    val referenceNumber = parsed.nullableString("referenceNumber")
    val accountSuffix = parsed.optString("accountSuffix", "unknown").ifBlank { "unknown" }
    if (!referenceNumber.isNullOrBlank()) {
      return "bank:union-bank-of-india:$accountSuffix:ref:${referenceNumber.replace(Regex("[^A-Za-z0-9_-]"), "")}"
    }

    if (!message.isNullOrBlank()) {
      return "bank:union-bank-of-india:$accountSuffix:message:${hashNormalizedMessage(message)}"
    }
    return listOf(
      "bank:union-bank-of-india:$accountSuffix:fallback",
      parsed.optString("type"),
      "%.2f".format(Locale.US, parsed.optDouble("amount")),
      parsed.optString("occurredAt")
    ).joinToString(":")
  }

  fun buildReviewEventKey(event: JSONObject, message: String? = null): String {
    if (!message.isNullOrBlank()) {
      return "union-bank:event:message:${hashNormalizedMessage(message)}"
    }
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

  private fun parseDate(datePart: String, timePart: String, meridiem: String? = null): String? {
    return try {
      val normalizedDate = datePart.replace('/', '-')
      val hasSeconds = timePart.count { it == ':' } == 2
      val normalizedTime = if (hasSeconds) timePart.substringBefore('.') else "$timePart:00"
      val marker = meridiem?.trim()?.uppercase(Locale.US).orEmpty()
      val input = SimpleDateFormat(if (marker.isBlank()) "dd-MM-yyyy HH:mm:ss" else "dd-MM-yyyy hh:mm:ss a", Locale.US)
      input.isLenient = false
      input.timeZone = TimeZone.getTimeZone("Asia/Kolkata")
      val parsed = input.parse("$normalizedDate $normalizedTime${if (marker.isBlank()) "" else " $marker"}") ?: return null
      isoFormat().format(parsed)
    } catch (_: Exception) {
      null
    }
  }

  private fun normalizeText(value: String): String {
    return value.replace(Regex("\\s+"), " ").trim()
  }

  private fun hashNormalizedMessage(value: String): String {
    return MessageDigest.getInstance("SHA-256")
      .digest(normalizeText(value).toByteArray(Charsets.UTF_8))
      .joinToString("") { "%02x".format(it) }
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
