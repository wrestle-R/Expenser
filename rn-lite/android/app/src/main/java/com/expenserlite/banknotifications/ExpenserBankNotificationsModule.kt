package com.expenserlite.banknotifications

import android.content.ComponentName
import android.content.Intent
import android.provider.Settings
import android.text.TextUtils
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableMap
import org.json.JSONArray
import org.json.JSONObject

class ExpenserBankNotificationsModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "ExpenserBankNotifications"

  @ReactMethod
  fun isNotificationAccessEnabled(promise: Promise) {
    val enabledListeners = Settings.Secure.getString(
      reactContext.contentResolver,
      "enabled_notification_listeners"
    )
    val expected = ComponentName(
      reactContext,
      ExpenserBankNotificationListenerService::class.java
    ).flattenToString()
    val enabled = !TextUtils.isEmpty(enabledListeners) &&
      enabledListeners.split(":").any { it.equals(expected, ignoreCase = true) }
    promise.resolve(enabled)
  }

  @ReactMethod
  fun openNotificationAccessSettings(promise: Promise) {
    val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    reactContext.startActivity(intent)
    promise.resolve(true)
  }

  @ReactMethod
  fun getQueuedImports(promise: Promise) {
    val queued = BankNotificationStore.getQueued(reactContext)
    promise.resolve(jsonArrayToWritable(queued))
  }

  @ReactMethod
  fun clearQueuedImports(sourceKeys: ReadableArray, promise: Promise) {
    val keys = mutableListOf<String>()
    for (index in 0 until sourceKeys.size()) {
      sourceKeys.getString(index)?.let { keys.add(it) }
    }
    BankNotificationStore.clearQueued(reactContext, keys)
    promise.resolve(true)
  }

  private fun jsonArrayToWritable(array: JSONArray) = Arguments.createArray().apply {
    for (index in 0 until array.length()) {
      val value = array.opt(index)
      if (value is JSONObject) {
        pushMap(jsonObjectToWritable(value))
      }
    }
  }

  private fun jsonObjectToWritable(obj: JSONObject): WritableMap = Arguments.createMap().apply {
    val keys = obj.keys()
    while (keys.hasNext()) {
      val key = keys.next()
      when (val value = obj.opt(key)) {
        JSONObject.NULL -> putNull(key)
        is String -> putString(key, value)
        is Boolean -> putBoolean(key, value)
        is Int -> putInt(key, value)
        is Double -> putDouble(key, value)
        is Long -> putDouble(key, value.toDouble())
        is JSONObject -> putMap(key, jsonObjectToWritable(value))
        is JSONArray -> putArray(key, jsonArrayToWritable(value))
        else -> putString(key, value?.toString())
      }
    }
  }
}
