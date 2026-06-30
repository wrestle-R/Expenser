package expo.modules.expenserbanknotifications

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

class ExpenserBankNotificationListenerService : NotificationListenerService() {
  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    if (sbn == null) {
      return
    }

    BankNotificationStore.recordNotificationRead(applicationContext, sbn.packageName)

    val notification = sbn.notification ?: return
    val extras = notification.extras ?: return
    val title = extras.getCharSequence("android.title")?.toString().orEmpty()
    val text = extras.getCharSequence("android.text")?.toString().orEmpty()
    val bigText = extras.getCharSequence("android.bigText")?.toString().orEmpty()
    val subText = extras.getCharSequence("android.subText")?.toString().orEmpty()
    val textLines = extras.getCharSequenceArray("android.textLines")
      ?.joinToString(" ") { it.toString() }
      .orEmpty()
    val body = listOf(bigText, textLines, text, subText).firstOrNull { it.isNotBlank() }.orEmpty()
    val message = listOf(title, body)
      .filter { it.isNotBlank() }
      .joinToString(" ")

    if (!UnionBankNotificationParser.isUnionBankLike(message)) {
      return
    }

    val result = UnionBankNotificationParser.parseBankNotification(message)
    if (result == null) {
      BankNotificationStore.enqueueRawCandidate(applicationContext, message, sbn.packageName)
      return
    }

    when (result.optString("kind")) {
      "transaction" -> {
        val parsed = result.optJSONObject("parsed") ?: return
        parsed.put("notificationPackage", sbn.packageName)
        BankNotificationStore.enqueue(applicationContext, parsed)
      }
      "review_event" -> {
        val event = result.optJSONObject("event") ?: return
        BankNotificationStore.enqueueReviewEvent(applicationContext, event, sbn.packageName)
      }
      else -> BankNotificationStore.enqueueRawCandidate(applicationContext, message, sbn.packageName)
    }
  }
}
