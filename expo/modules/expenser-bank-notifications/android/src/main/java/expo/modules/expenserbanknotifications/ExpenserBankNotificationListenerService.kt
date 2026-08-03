package expo.modules.expenserbanknotifications

import android.app.Notification
import android.app.Person
import android.content.Intent
import android.os.Bundle
import android.provider.Telephony
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

class ExpenserBankNotificationListenerService : NotificationListenerService() {
  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    if (sbn == null) return

    val defaultSmsPackage = Telephony.Sms.getDefaultSmsPackage(applicationContext)
    if (!DefaultSmsSourceFilter.matches(defaultSmsPackage, sbn.packageName)) return

    BankNotificationStore.recordNotificationRead(applicationContext, sbn.packageName)
    val notification = sbn.notification ?: return
    if (NotificationCapturePolicy.isGroupSummary(notification.flags, Notification.FLAG_GROUP_SUMMARY)) return
    val payload = extractPayload(notification) ?: return
    if (!FinancialSmsCandidateDetector.isCandidate(payload.message)) return

    BankNotificationStore.enqueueRawCandidate(
      context = applicationContext,
      sender = payload.sender,
      message = payload.message,
      packageName = sbn.packageName,
      capturedAtMs = sbn.postTime,
      stableSourceId = "${sbn.key}|${sbn.postTime}"
    )
    notifyQueueChanged()
  }

  private fun extractPayload(notification: Notification): SmsPayload? {
    val extras = notification.extras ?: return null
    val messagingBundles = notificationMessages(extras)
    val messagingTexts = messagingBundles.mapNotNull {
      it.getCharSequence("text")?.toString()?.takeIf(String::isNotBlank)
    }
    val textLines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)
      ?.map { it.toString() }
      .orEmpty()
    val message = SmsNotificationTextSelector.select(
      bigText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString(),
      textLines = textLines,
      text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString(),
      messagingTexts = messagingTexts
    ) ?: return null

    val sender = messagingBundles.lastOrNull()
      ?.let(::messageSender)
      ?: extras.getCharSequence(Notification.EXTRA_CONVERSATION_TITLE)?.toString()
      ?: extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()

    return SmsPayload(
      sender = sender?.replace(Regex("\\s+"), " ")?.trim()?.takeIf(String::isNotBlank),
      message = message
    )
  }

  @Suppress("DEPRECATION")
  private fun notificationMessages(extras: Bundle): List<Bundle> {
    return extras.getParcelableArray(Notification.EXTRA_MESSAGES)
      ?.mapNotNull { it as? Bundle }
      .orEmpty()
  }

  @Suppress("DEPRECATION")
  private fun messageSender(message: Bundle): String? {
    val person = message.getParcelable<Person>("sender_person")
    return person?.name?.toString()
      ?: message.getCharSequence("sender")?.toString()
  }

  private fun notifyQueueChanged() {
    sendBroadcast(
      Intent(BANK_IMPORT_QUEUED_ACTION).setPackage(packageName)
    )
  }

  private data class SmsPayload(val sender: String?, val message: String)

  private companion object {
    private const val BANK_IMPORT_QUEUED_ACTION =
      "expo.modules.expenserbanknotifications.BANK_IMPORT_QUEUED"
  }
}
