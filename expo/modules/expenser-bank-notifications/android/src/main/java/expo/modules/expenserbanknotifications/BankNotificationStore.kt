package expo.modules.expenserbanknotifications

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

object BankNotificationStore {
  private const val PREFS_NAME = "expenser_bank_notifications"
  private const val QUEUE_KEY = "queued_imports"
  private const val RECENT_READS_KEY = "recent_reads"
  private const val RAW_CANDIDATES_KEY = "raw_bank_candidates"
  private const val REVIEW_EVENTS_KEY = "bank_review_events"
  private const val MAX_RECENT_READS = 200
  private const val MAX_RAW_CANDIDATES = 50
  private const val MAX_REVIEW_EVENTS = 50

  fun recordNotificationRead(context: Context, packageName: String) {
    val now = System.currentTimeMillis()
    val read = JSONObject()
      .put("notificationPackage", packageName)
      .put("capturedAt", isoFormat().format(now))
      .put("capturedAtMs", now)

    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val reads = JSONArray(prefs.getString(RECENT_READS_KEY, "[]"))
    reads.put(read)
    prefs.edit().putString(RECENT_READS_KEY, trimToLatest(reads, MAX_RECENT_READS).toString()).apply()
  }

  fun getRecentReads(context: Context): JSONArray {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    return JSONArray(prefs.getString(RECENT_READS_KEY, "[]"))
  }

  fun enqueue(context: Context, parsed: JSONObject) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val queue = JSONArray(prefs.getString(QUEUE_KEY, "[]"))
    val sourceKey = parsed.optString("importSourceKey")

    if (containsSourceKey(queue, sourceKey)) {
      return
    }

    queue.put(parsed)
    prefs.edit().putString(QUEUE_KEY, queue.toString()).apply()
  }

  fun getQueued(context: Context): JSONArray {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    return JSONArray(prefs.getString(QUEUE_KEY, "[]"))
  }

  fun clearQueued(context: Context, sourceKeys: List<String>) {
    clearBySourceKey(context, QUEUE_KEY, sourceKeys)
  }

  fun enqueueRawCandidate(context: Context, message: String, packageName: String) {
    val now = System.currentTimeMillis()
    val sourceKey = "union-bank:raw:${sha256(message)}"
    val candidate = JSONObject()
      .put("sourceKey", sourceKey)
      .put("message", message)
      .put("capturedAt", isoFormat().format(now))
      .put("notificationPackage", packageName)

    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val queue = JSONArray(prefs.getString(RAW_CANDIDATES_KEY, "[]"))
    if (containsSourceKey(queue, sourceKey)) {
      return
    }

    queue.put(candidate)
    prefs.edit()
      .putString(RAW_CANDIDATES_KEY, trimToLatest(queue, MAX_RAW_CANDIDATES).toString())
      .apply()
  }

  fun getRawCandidates(context: Context): JSONArray {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    return JSONArray(prefs.getString(RAW_CANDIDATES_KEY, "[]"))
  }

  fun clearRawCandidates(context: Context, sourceKeys: List<String>) {
    clearBySourceKey(context, RAW_CANDIDATES_KEY, sourceKeys)
  }

  fun enqueueReviewEvent(
    context: Context,
    event: JSONObject,
    packageName: String,
    sourceKey: String? = null
  ) {
    val now = System.currentTimeMillis()
    val nextSourceKey = sourceKey ?: event.optString("importSourceKey").ifBlank {
      UnionBankNotificationParser.buildReviewEventKey(event)
    }
    val item = JSONObject(event.toString())
      .put("importSource", event.optString("importSource", "union_bank_event"))
      .put("importSourceKey", nextSourceKey)
      .put("capturedAt", event.optString("capturedAt").ifBlank { isoFormat().format(now) })
      .put("notificationPackage", packageName)

    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val queue = JSONArray(prefs.getString(REVIEW_EVENTS_KEY, "[]"))
    if (containsSourceKey(queue, nextSourceKey)) {
      return
    }

    queue.put(item)
    prefs.edit()
      .putString(REVIEW_EVENTS_KEY, trimToLatest(queue, MAX_REVIEW_EVENTS).toString())
      .apply()
  }

  fun getReviewEvents(context: Context): JSONArray {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    return JSONArray(prefs.getString(REVIEW_EVENTS_KEY, "[]"))
  }

  fun clearReviewEvents(context: Context, sourceKeys: List<String>) {
    clearBySourceKey(context, REVIEW_EVENTS_KEY, sourceKeys)
  }

  private fun clearBySourceKey(context: Context, key: String, sourceKeys: List<String>) {
    if (sourceKeys.isEmpty()) {
      return
    }

    val keys = sourceKeys.toSet()
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val queue = JSONArray(prefs.getString(key, "[]"))
    val next = JSONArray()

    for (index in 0 until queue.length()) {
      val item = queue.optJSONObject(index)
      val sourceKey = item?.optString("importSourceKey").takeUnless { it.isNullOrBlank() }
        ?: item?.optString("sourceKey")
      if (item == null || !keys.contains(sourceKey)) {
        next.put(item)
      }
    }

    prefs.edit().putString(key, next.toString()).apply()
  }

  private fun containsSourceKey(queue: JSONArray, sourceKey: String): Boolean {
    if (sourceKey.isBlank()) {
      return false
    }

    for (index in 0 until queue.length()) {
      val item = queue.optJSONObject(index)
      val itemKey = item?.optString("importSourceKey").takeUnless { it.isNullOrBlank() }
        ?: item?.optString("sourceKey")
      if (itemKey == sourceKey) {
        return true
      }
    }

    return false
  }

  private fun trimToLatest(items: JSONArray, maxItems: Int): JSONArray {
    val next = JSONArray()
    val start = maxOf(0, items.length() - maxItems)
    for (index in start until items.length()) {
      next.put(items.opt(index))
    }
    return next
  }

  private fun sha256(value: String): String {
    val bytes = MessageDigest.getInstance("SHA-256").digest(value.toByteArray(Charsets.UTF_8))
    return bytes.joinToString("") { "%02x".format(it) }
  }

  private fun isoFormat(): SimpleDateFormat {
    val output = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
    output.timeZone = TimeZone.getTimeZone("UTC")
    return output
  }
}
