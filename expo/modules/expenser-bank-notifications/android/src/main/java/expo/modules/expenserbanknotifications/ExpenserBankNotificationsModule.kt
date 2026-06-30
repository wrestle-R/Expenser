package expo.modules.expenserbanknotifications

import android.content.Context
import android.content.Intent
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpenserBankNotificationsModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("ExpenserBankNotifications")

    Function("isNotificationAccessEnabled") {
      isNotificationAccessEnabled()
    }

    Function("getNotificationAccessHealth") { lookbackMs: Double? ->
      val reads = BankNotificationStore.getRecentReads(context)
      val cutoff = System.currentTimeMillis() - (lookbackMs ?: FOUR_HOURS_MS.toDouble()).toLong()
      var recentReadCount = 0
      var lastReadAt: String? = null
      var lastReadAtMs = 0L

      for (index in 0 until reads.length()) {
        val item = reads.optJSONObject(index) ?: continue
        val capturedAtMs = item.optLong("capturedAtMs", 0L)
        if (capturedAtMs >= cutoff) {
          recentReadCount += 1
        }
        if (capturedAtMs > lastReadAtMs) {
          lastReadAtMs = capturedAtMs
          lastReadAt = item.optString("capturedAt").takeUnless { it.isBlank() }
        }
      }

      mapOf(
        "settingEnabled" to isNotificationAccessEnabled(),
        "recentReadCount" to recentReadCount,
        "lastReadAt" to lastReadAt,
        "hasRecentReads" to (recentReadCount > 0)
      )
    }

    AsyncFunction("openNotificationAccessSettings") {
      val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    Function("getQueuedImports") {
      val queue = BankNotificationStore.getQueued(context)
      val items = mutableListOf<Map<String, Any?>>()
      for (index in 0 until queue.length()) {
        val item = queue.optJSONObject(index) ?: continue
        items.add(
          mapOf(
            "bankName" to item.optString("bankName"),
            "accountSuffix" to item.optString("accountSuffix"),
            "type" to item.optString("type"),
            "amount" to item.optDouble("amount"),
            "occurredAt" to item.optString("occurredAt"),
            "referenceNumber" to item.nullableString("referenceNumber"),
            "payee" to item.nullableString("payee"),
            "availableBalance" to item.optDouble("availableBalance"),
            "confidence" to item.optString("confidence"),
            "importSource" to item.optString("importSource"),
            "importSourceKey" to item.optString("importSourceKey"),
            "capturedAt" to item.optString("capturedAt"),
            "notificationPackage" to item.optString("notificationPackage")
          )
        )
      }
      items
    }

    Function("clearQueuedImports") { sourceKeys: List<String> ->
      BankNotificationStore.clearQueued(context, sourceKeys)
    }

    Function("getQueuedRawBankCandidates") {
      val queue = BankNotificationStore.getRawCandidates(context)
      val items = mutableListOf<Map<String, Any?>>()
      for (index in 0 until queue.length()) {
        val item = queue.optJSONObject(index) ?: continue
        items.add(
          mapOf(
            "sourceKey" to item.optString("sourceKey"),
            "message" to item.optString("message"),
            "capturedAt" to item.optString("capturedAt"),
            "notificationPackage" to item.optString("notificationPackage")
          )
        )
      }
      items
    }

    Function("clearQueuedRawBankCandidates") { sourceKeys: List<String> ->
      BankNotificationStore.clearRawCandidates(context, sourceKeys)
    }

    Function("getQueuedBankReviewEvents") {
      val queue = BankNotificationStore.getReviewEvents(context)
      val items = mutableListOf<Map<String, Any?>>()
      for (index in 0 until queue.length()) {
        val item = queue.optJSONObject(index) ?: continue
        items.add(
          mapOf(
            "bankName" to item.optString("bankName"),
            "eventType" to item.optString("eventType"),
            "amount" to if (item.isNull("amount")) null else item.optDouble("amount"),
            "accountSuffix" to item.nullableString("accountSuffix"),
            "occurredAt" to item.nullableString("occurredAt"),
            "summary" to item.optString("summary"),
            "confidence" to item.optString("confidence"),
            "importSource" to item.optString("importSource"),
            "importSourceKey" to item.optString("importSourceKey"),
            "capturedAt" to item.optString("capturedAt"),
            "notificationPackage" to item.optString("notificationPackage")
          )
        )
      }
      items
    }

    Function("clearQueuedBankReviewEvents") { sourceKeys: List<String> ->
      BankNotificationStore.clearReviewEvents(context, sourceKeys)
    }
  }

  private fun isNotificationAccessEnabled(): Boolean {
    val flat = Settings.Secure.getString(
      context.contentResolver,
      "enabled_notification_listeners"
    ) ?: return false

    return flat.split(":").any { it.contains(context.packageName, ignoreCase = true) }
  }

  private companion object {
    private const val FOUR_HOURS_MS = 4 * 60 * 60 * 1000L
  }
}
