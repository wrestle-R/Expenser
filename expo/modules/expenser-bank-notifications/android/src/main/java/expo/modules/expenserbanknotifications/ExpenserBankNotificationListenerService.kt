package expo.modules.expenserbanknotifications

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

class ExpenserBankNotificationListenerService : NotificationListenerService() {
  private val smsPackages = setOf(
    "com.google.android.apps.messaging",
    "com.samsung.android.messaging",
    "com.android.mms",
    "com.android.messaging",
    "com.miui.mms",
    "com.coloros.mms",
    "com.oneplus.mms",
    "com.vivo.messaging"
  )

  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    if (sbn == null || !smsPackages.contains(sbn.packageName)) {
      return
    }

    val notification = sbn.notification ?: return
    val extras = notification.extras ?: return
    val title = extras.getCharSequence("android.title")?.toString().orEmpty()
    val text = extras.getCharSequence("android.text")?.toString().orEmpty()
    val bigText = extras.getCharSequence("android.bigText")?.toString().orEmpty()
    val message = listOf(title, bigText.ifBlank { text })
      .filter { it.isNotBlank() }
      .joinToString(" ")

    val parsed = UnionBankNotificationParser.parse(message) ?: return
    parsed.put("notificationPackage", sbn.packageName)
    BankNotificationStore.enqueue(applicationContext, parsed)
  }
}
