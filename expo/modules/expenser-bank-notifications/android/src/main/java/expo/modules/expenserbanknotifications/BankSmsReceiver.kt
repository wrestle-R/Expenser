package expo.modules.expenserbanknotifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony

class BankSmsReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION || !BankImportControls.enabled(context)) return
    val parts = Telephony.Sms.Intents.getMessagesFromIntent(intent)
    if (parts.isEmpty()) return
    val message = parts.joinToString("") { it.messageBody.orEmpty() }
    if (!FinancialSmsCandidateDetector.isCandidate(message)) return
    if (BankNotificationStore.enqueueRawCandidate(context, parts[0].originatingAddress, message, "android.sms", parts[0].timestampMillis, "${parts[0].originatingAddress}|${parts[0].timestampMillis}|$message")) {
      BankImportWork.enqueue(context)
      context.sendBroadcast(Intent("expo.modules.expenserbanknotifications.BANK_IMPORT_QUEUED").setPackage(context.packageName))
    }
  }
}
