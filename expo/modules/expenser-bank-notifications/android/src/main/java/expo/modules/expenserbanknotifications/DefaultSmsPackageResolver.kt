package expo.modules.expenserbanknotifications

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Telephony

internal object DefaultSmsPackageResolver {
  fun resolve(context: Context): String? {
    val telephonyPackage = runCatching {
      Telephony.Sms.getDefaultSmsPackage(context)
    }.getOrNull()

    return choose(
      telephonyPackage = telephonyPackage,
      sendToPackage = resolveSendToPackage(context)
    )
  }

  fun choose(telephonyPackage: String?, sendToPackage: String?): String? {
    return telephonyPackage?.takeIf(String::isNotBlank)
      ?: sendToPackage?.takeIf(String::isNotBlank)
  }

  @Suppress("DEPRECATION")
  private fun resolveSendToPackage(context: Context): String? {
    val intent = Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:"))
    val packageManager = context.packageManager
    val resolved = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      packageManager.resolveActivity(
        intent,
        PackageManager.ResolveInfoFlags.of(PackageManager.MATCH_DEFAULT_ONLY.toLong())
      )
    } else {
      packageManager.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY)
    }

    return resolved?.activityInfo?.packageName
  }
}
