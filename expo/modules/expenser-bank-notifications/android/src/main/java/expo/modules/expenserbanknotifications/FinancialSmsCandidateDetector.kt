package expo.modules.expenserbanknotifications

internal object DefaultSmsSourceFilter {
  fun matches(defaultSmsPackage: String?, postedPackage: String?): Boolean {
    return !defaultSmsPackage.isNullOrBlank() && defaultSmsPackage == postedPackage
  }
}

internal object NotificationCapturePolicy {
  fun isGroupSummary(flags: Int, groupSummaryFlag: Int): Boolean {
    return flags and groupSummaryFlag != 0
  }
}

internal object QueueRetentionPolicy {
  fun shouldEnqueue(existingSourceKeys: List<String>, sourceKey: String): Boolean {
    return sourceKey.isNotBlank() && !existingSourceKeys.contains(sourceKey)
  }

  fun firstRetainedIndex(itemCount: Int, maxItems: Int): Int {
    return maxOf(0, itemCount - maxOf(0, maxItems))
  }
}

internal object NotificationAccessHealthPolicy {
  fun isRecent(capturedAtMs: Long, nowMs: Long, lookbackMs: Long): Boolean {
    return capturedAtMs > 0 && capturedAtMs >= nowMs - maxOf(0, lookbackMs)
  }
}

internal object FinancialSmsCandidateDetector {
  private val amount = Regex("(?:₹|rs\\.?|inr)\\s*[0-9][0-9,]*(?:\\.[0-9]{1,2})?", RegexOption.IGNORE_CASE)
  private val action = Regex(
    "\\b(debit(?:ed)?|credit(?:ed)?|spent|paid|received|withdrawn|deposited|transferred|purchase|txn|transaction|neft|imps|upi|autopay|reversal|refund|lien|cheque|card|a/?c|account|balance|failed|declined|request)\\b",
    RegexOption.IGNORE_CASE
  )
  private val clearlyUnrelated = Regex(
    "\\b(otp|one[ -]?time password|verification code|login code|reward points?|pre-approved|special offer|sale ends|cashback offer)\\b",
    RegexOption.IGNORE_CASE
  )
  private val completedOrReviewAction = Regex(
    "\\b(debited|credited|spent|paid|received|withdrawn|deposited|reversed|failed|declined|lien|cheque)\\b",
    RegexOption.IGNORE_CASE
  )

  fun isCandidate(message: String): Boolean {
    val normalized = message.replace(Regex("\\s+"), " ").trim()
    if (normalized.length < 12) return false
    if (
      clearlyUnrelated.containsMatchIn(normalized) &&
      !completedOrReviewAction.containsMatchIn(normalized)
    ) return false
    if (Regex("\\b(lien|cheque)\\b", RegexOption.IGNORE_CASE).containsMatchIn(normalized)) {
      return action.containsMatchIn(normalized)
    }
    return amount.containsMatchIn(normalized) && action.containsMatchIn(normalized)
  }
}

internal object SmsNotificationTextSelector {
  fun select(
    bigText: String?,
    textLines: List<String>,
    text: String?,
    messagingTexts: List<String>
  ): String? {
    val candidates = buildList {
      messagingTexts.lastOrNull()?.let(::add)
      bigText?.let(::add)
      textLines.maxByOrNull(String::length)?.let(::add)
      text?.let(::add)
    }
    return candidates
      .asSequence()
      .map { it.replace(Regex("\\s+"), " ").trim() }
      .firstOrNull { it.isNotBlank() }
  }
}
