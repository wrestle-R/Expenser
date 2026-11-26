package expo.modules.expenserbanknotifications

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.view.View
import android.widget.RemoteViews
import org.json.JSONArray
import org.json.JSONObject

class RecentTransactionsWidget : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    refresh(context, manager, ids)
  }

  companion object {
    private const val KEY = "recent_transactions"
    private fun prefs(context: Context) = context.getSharedPreferences("expenser_widgets", Context.MODE_PRIVATE)
    private fun component(context: Context) = ComponentName(context, RecentTransactionsWidget::class.java)

    fun save(context: Context, titles: List<String>, amounts: List<String>) {
      val provider = component(context)
      if (context.packageManager.getComponentEnabledSetting(provider) == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT) {
        context.packageManager.setComponentEnabledSetting(
          provider, PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP
        )
      }
      val entries = JSONArray()
      titles.zip(amounts).take(5).forEach { (title, amount) ->
        entries.put(JSONObject().put("title", title.take(80)).put("amount", amount.take(24)))
      }
      val snapshot = entries.toString()
      if (prefs(context).getString(KEY, null) == snapshot) return
      prefs(context).edit().putString(KEY, snapshot).apply()
      val manager = AppWidgetManager.getInstance(context)
      refresh(context, manager, manager.getAppWidgetIds(provider))
    }

    fun pin(context: Context): Boolean {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false
      val manager = AppWidgetManager.getInstance(context)
      return manager.isRequestPinAppWidgetSupported && manager.requestPinAppWidget(component(context), null, null)
    }

    private fun refresh(context: Context, manager: AppWidgetManager, ids: IntArray) {
      if (ids.isEmpty()) return
      val views = RemoteViews(context.packageName, R.layout.recent_transactions_widget)
      val entries = JSONArray(prefs(context).getString(KEY, "[]"))
      views.setViewVisibility(R.id.recent_widget_empty, if (entries.length() == 0) View.VISIBLE else View.GONE)
      views.removeAllViews(R.id.recent_widget_rows)
      for (index in 0 until entries.length()) {
        val entry = entries.getJSONObject(index)
        val row = RemoteViews(context.packageName, R.layout.recent_transaction_widget_row)
        row.setTextViewText(R.id.recent_widget_label, entry.getString("title"))
        row.setTextViewText(R.id.recent_widget_amount, entry.getString("amount"))
        views.addView(R.id.recent_widget_rows, row)
      }
      context.packageManager.getLaunchIntentForPackage(context.packageName)?.let { launch ->
        launch.action = Intent.ACTION_VIEW
        launch.removeCategory(Intent.CATEGORY_LAUNCHER)
        launch.data = Uri.parse("expenser:///transactions")
        views.setOnClickPendingIntent(
          R.id.recent_widget_root,
          PendingIntent.getActivity(context, 10, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        )
      }
      manager.updateAppWidget(ids, views)
    }
  }
}
