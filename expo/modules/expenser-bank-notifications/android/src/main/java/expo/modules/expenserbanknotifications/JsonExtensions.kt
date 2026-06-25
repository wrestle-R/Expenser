package expo.modules.expenserbanknotifications

import org.json.JSONObject

fun JSONObject.nullableString(name: String): String? {
  if (isNull(name)) {
    return null
  }

  val value = optString(name)
  return if (value.isBlank()) null else value
}
