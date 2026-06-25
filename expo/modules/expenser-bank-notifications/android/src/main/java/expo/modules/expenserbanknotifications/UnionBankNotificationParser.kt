package expo.modules.expenserbanknotifications

import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

object UnionBankNotificationParser {
  private val coreRegex = Regex(
    "\\bA/c\\s+\\*(\\d{3,6})\\s+(Debited|Credited(?:\\s+for)?)\\s+Rs:?([\\d,]+(?:\\.\\d{1,2})?)\\s+on\\s+(\\d{2}-\\d{2}-\\d{4})\\s+(\\d{2}:\\d{2}:\\d{2})",
    RegexOption.IGNORE_CASE
  )
  private val balanceRegex = Regex(
    "\\bAvl\\s+Bal\\s+Rs:?([\\d,]+(?:\\.\\d{1,2})?)",
    RegexOption.IGNORE_CASE
  )
  private val referenceRegex = Regex("\\bref\\s+no\\s+(\\d{6,})\\b", RegexOption.IGNORE_CASE)
  private val payeeRegex = Regex("\\bFvg:\\s*(.*?)(?:\\s+Avl\\s+Bal\\b|$)", RegexOption.IGNORE_CASE)

  fun parse(message: String): JSONObject? {
    val text = message.replace(Regex("\\s+"), " ").trim()
    if (!text.contains("Union Bank of India", ignoreCase = true) && !Regex("\\bA/c\\s+\\*\\d{3,6}\\b", RegexOption.IGNORE_CASE).containsMatchIn(text)) {
      return null
    }

    val core = coreRegex.find(text) ?: return null
    val balance = balanceRegex.find(text) ?: return null
    val accountSuffix = core.groupValues[1]
    val rawType = core.groupValues[2]
    val amount = parseAmount(core.groupValues[3]) ?: return null
    val occurredAt = parseDate(core.groupValues[4], core.groupValues[5]) ?: return null
    val availableBalance = parseAmount(balance.groupValues[1]) ?: return null
    val referenceNumber = referenceRegex.find(text)?.groupValues?.get(1)
    val payee = normalizePayee(payeeRegex.find(text)?.groupValues?.get(1))
    val transactionType = if (rawType.equals("Debited", ignoreCase = true)) "expense" else "income"

    val importSourceKey = if (!referenceNumber.isNullOrBlank()) {
      "union-bank:ref:$referenceNumber"
    } else {
      "union-bank:fallback:$accountSuffix:$transactionType:${"%.2f".format(Locale.US, amount)}:$occurredAt:${"%.2f".format(Locale.US, availableBalance)}"
    }

    return JSONObject()
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
      .put("importSourceKey", importSourceKey)
      .put("capturedAt", isoFormat().format(System.currentTimeMillis()))
  }

  private fun parseAmount(value: String): Double? {
    return value.replace(",", "").toDoubleOrNull()
  }

  private fun parseDate(datePart: String, timePart: String): String? {
    return try {
      val input = SimpleDateFormat("dd-MM-yyyy HH:mm:ss", Locale.US)
      input.timeZone = TimeZone.getTimeZone("Asia/Kolkata")
      val parsed = input.parse("$datePart $timePart") ?: return null
      isoFormat().format(parsed)
    } catch (_: Exception) {
      null
    }
  }

  private fun normalizePayee(value: String?): String? {
    val cleaned = value
      ?.replace(Regex("\\s+Avl\\s+Bal.*$", RegexOption.IGNORE_CASE), "")
      ?.replace(Regex("[.,\\s]+$"), "")
      ?.trim()

    return if (cleaned.isNullOrBlank()) null else cleaned
  }

  private fun isoFormat(): SimpleDateFormat {
    val output = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
    output.timeZone = TimeZone.getTimeZone("UTC")
    return output
  }
}
