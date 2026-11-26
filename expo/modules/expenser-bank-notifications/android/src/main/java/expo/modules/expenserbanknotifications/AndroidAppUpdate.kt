package expo.modules.expenserbanknotifications

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.SystemClock
import android.provider.Settings
import androidx.core.content.FileProvider
import androidx.core.content.pm.PackageInfoCompat
import java.io.File
import java.net.URL
import java.security.MessageDigest
import javax.net.ssl.HttpsURLConnection

class ExpenserUpdateFileProvider : FileProvider()

internal object AndroidAppUpdate {
  private val versionPattern = Regex("[0-9]+\\.[0-9]+\\.[0-9]+")
  private val digestPattern = Regex("[a-f0-9]{64}")
  private const val maxBytes = 250L * 1024 * 1024
  private const val maxDownloadMillis = 5L * 60 * 1000

  private fun updateFile(context: Context, code: Int, digest: String): File {
    require(context.packageName == "com.rdp.expenser" && digestPattern.matches(digest))
    val installed = context.packageManager.getPackageInfo(context.packageName, 0)
    require(code.toLong() > PackageInfoCompat.getLongVersionCode(installed))
    return File(context.cacheDir, "android-updates/$code-$digest.apk")
  }

  @Synchronized
  fun download(context: Context, version: String, code: Int, digest: String) {
    require(versionPattern.matches(version))
    val target = updateFile(context, code, digest)
    if (target.isFile) return
    val directory = target.parentFile ?: error("Cannot create update directory")
    directory.mkdirs()
    directory.listFiles()?.forEach { it.delete() }
    val partial = File(directory, "download.part.apk")
    val url = URL("https://github.com/wrestle-R/Expenser/releases/download/expenser-android-v$version/expenser-android.apk")
    val connection = url.openConnection() as HttpsURLConnection
    connection.connectTimeout = 15_000
    connection.readTimeout = 20_000
    val checksum = MessageDigest.getInstance("SHA-256")
    try {
      check(connection.responseCode == 200 && connection.contentLengthLong <= maxBytes)
      val deadline = SystemClock.elapsedRealtime() + maxDownloadMillis
      var received = 0L
      connection.inputStream.use { input ->
        partial.outputStream().use { output ->
          val buffer = ByteArray(64 * 1024)
          while (true) {
            val count = input.read(buffer)
            if (count < 0) break
            received += count
            check(received <= maxBytes && SystemClock.elapsedRealtime() <= deadline)
            checksum.update(buffer, 0, count)
            output.write(buffer, 0, count)
          }
        }
      }
      check(checksum.digest().joinToString("") { "%02x".format(it) } == digest)
      val archive = context.packageManager.getPackageArchiveInfo(partial.path, 0)
      check(archive != null && archive.packageName == context.packageName &&
        PackageInfoCompat.getLongVersionCode(archive) == code.toLong() && archive.versionName == version)
      check(partial.renameTo(target))
    } finally {
      connection.disconnect()
      partial.delete()
    }
  }

  fun install(context: Context, code: Int, digest: String): String {
    val apk = updateFile(context, code, digest)
    if (!apk.isFile) return "missing"
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !context.packageManager.canRequestPackageInstalls()) {
      context.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}"))
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      return "permission"
    }
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.android-update", apk)
    val intent = Intent(Intent.ACTION_VIEW)
      .setDataAndType(uri, "application/vnd.android.package-archive")
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION)
    context.startActivity(intent)
    return "installer"
  }
}
