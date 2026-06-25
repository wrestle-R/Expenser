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
  }

  private fun isNotificationAccessEnabled(): Boolean {
    val flat = Settings.Secure.getString(
      context.contentResolver,
      "enabled_notification_listeners"
    ) ?: return false

    return flat.split(":").any { it.contains(context.packageName, ignoreCase = true) }
  }
}
