package expo.modules.expenserbanknotifications

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

object BankNotificationStore {
  private const val PREFS_NAME = "expenser_bank_notifications"
  private const val QUEUE_KEY = "queued_imports"

  fun enqueue(context: Context, parsed: JSONObject) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val queue = JSONArray(prefs.getString(QUEUE_KEY, "[]"))
    val sourceKey = parsed.optString("importSourceKey")

    for (index in 0 until queue.length()) {
      val item = queue.optJSONObject(index)
      if (item?.optString("importSourceKey") == sourceKey) {
        return
      }
    }

    queue.put(parsed)
    prefs.edit().putString(QUEUE_KEY, queue.toString()).apply()
  }

  fun getQueued(context: Context): JSONArray {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    return JSONArray(prefs.getString(QUEUE_KEY, "[]"))
  }

  fun clearQueued(context: Context, sourceKeys: List<String>) {
    if (sourceKeys.isEmpty()) {
      return
    }

    val keys = sourceKeys.toSet()
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val queue = JSONArray(prefs.getString(QUEUE_KEY, "[]"))
    val next = JSONArray()

    for (index in 0 until queue.length()) {
      val item = queue.optJSONObject(index)
      if (item == null || !keys.contains(item.optString("importSourceKey"))) {
        next.put(item)
      }
    }

    prefs.edit().putString(QUEUE_KEY, next.toString()).apply()
  }
}
