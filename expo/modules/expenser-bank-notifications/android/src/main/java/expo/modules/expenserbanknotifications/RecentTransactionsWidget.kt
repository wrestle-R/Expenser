package expo.modules.expenserbanknotifications

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.util.AtomicFile
import android.util.SizeF
import android.os.Bundle
import android.view.View
import android.widget.RemoteViews
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.IOException

class RecentTransactionsWidget : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    refresh(context, manager, ids)
  }

  override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) {
    refresh(context, manager, intArrayOf(id))
  }

  companion object {
    private const val DEFAULT_HEIGHT_DP = 156

    private fun component(context: Context) = ComponentName(context, RecentTransactionsWidget::class.java)
    private fun snapshotFile(context: Context) = AtomicFile(File(context.filesDir, "widget-transactions.json"))

    @Synchronized
    private fun readEntries(context: Context): JSONArray {
      val owner = BankNotificationStore.owner(context) ?: return JSONArray()
      val snapshot = readSnapshot(context) ?: return JSONArray()
      return if (snapshot.optString("owner") == owner) snapshot.optJSONArray("entries") ?: JSONArray() else JSONArray()
    }

    private fun readSnapshot(context: Context): JSONObject? = runCatching {
      JSONObject(snapshotFile(context).readFully().toString(Charsets.UTF_8))
    }.getOrNull()

    @Synchronized
    fun clearForOwnerChange(context: Context, owner: String?) {
      val saved = readSnapshot(context)
      if (saved != null && (owner == null || saved.optString("owner") != owner)) {
        snapshotFile(context).delete()
        notifyChanged(context)
      }
      context.getSharedPreferences("expenser_widgets", Context.MODE_PRIVATE)
        .edit().remove("recent_transactions").apply()
    }

    @Synchronized
    fun save(context: Context, titles: List<String>, amounts: List<String>, details: List<String>, owner: String?) {
      // A headless fetch may finish after sign-out or a switch to another account.
      if (BankNotificationStore.owner(context) != owner) return

      val provider = component(context)
      if (context.packageManager.getComponentEnabledSetting(provider) == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT) {
        context.packageManager.setComponentEnabledSetting(
          provider, PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP
        )
      }

      val entries = JSONArray()
      titles.zip(amounts).forEachIndexed { index, (title, amount) ->
        entries.put(JSONObject()
          .put("title", title.take(160))
          .put("amount", amount.take(40))
          .put("details", details.getOrElse(index) { "" }.take(100)))
      }
      val snapshot = JSONObject().put("owner", owner ?: JSONObject.NULL).put("entries", entries).toString()
      val previous = readSnapshot(context)
      if (previous?.toString() == snapshot) return

      val file = snapshotFile(context)
      val output = try { file.startWrite() } catch (_: IOException) { return }
      try {
        output.write(snapshot.toByteArray(Charsets.UTF_8))
        file.finishWrite(output)
      } catch (_: IOException) {
        file.failWrite(output)
        return
      }
      notifyChanged(context)
    }

    fun isPinned(context: Context): Boolean =
      AppWidgetManager.getInstance(context).getAppWidgetIds(component(context)).isNotEmpty()

    fun pin(context: Context): Boolean {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false
      val manager = AppWidgetManager.getInstance(context)
      return manager.isRequestPinAppWidgetSupported && manager.requestPinAppWidget(component(context), null, null)
    }

    private fun notifyChanged(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      refresh(context, manager, manager.getAppWidgetIds(component(context)))
    }

    private fun refresh(context: Context, manager: AppWidgetManager, ids: IntArray) {
      if (ids.isEmpty()) return
      val entries = readEntries(context)
      val resources = context.resources
      val density = resources.displayMetrics.density
      val rowHeight = resources.getDimension(R.dimen.transaction_widget_row_height) / density
      val headerHeight = (resources.getDimension(R.dimen.transaction_widget_header_height) +
        2 * resources.getDimension(R.dimen.transaction_widget_vertical_padding)) / density
      ids.forEach { id ->
        val options = manager.getAppWidgetOptions(id)
        val sizes = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
          options.getParcelableArrayList(AppWidgetManager.OPTION_APPWIDGET_SIZES, SizeF::class.java)
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          @Suppress("DEPRECATION")
          options.getParcelableArrayList<SizeF>(AppWidgetManager.OPTION_APPWIDGET_SIZES)
        } else null

        val views = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !sizes.isNullOrEmpty()) {
          val byRowCount = mutableMapOf<Int, RemoteViews>()
          RemoteViews(sizes.take(16).associateWith { size ->
            val count = WidgetRowCapacity.count(size.height, headerHeight, rowHeight, entries.length())
            byRowCount.getOrPut(count) { render(context, entries, count) }
          })
        } else {
          val heightKey = if (context.resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE) {
            AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT
          } else AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT
          val height = options.getInt(heightKey, DEFAULT_HEIGHT_DP).takeIf { it > 0 } ?: DEFAULT_HEIGHT_DP
          render(context, entries, WidgetRowCapacity.count(height.toFloat(), headerHeight, rowHeight, entries.length()))
        }
        manager.updateAppWidget(id, views)
      }
    }

    private fun render(context: Context, entries: JSONArray, count: Int): RemoteViews {
      val views = RemoteViews(context.packageName, R.layout.recent_transactions_widget)
      views.setViewVisibility(R.id.recent_widget_empty, if (entries.length() == 0) View.VISIBLE else View.GONE)
      views.removeAllViews(R.id.recent_widget_rows)
      repeat(count) { position ->
        val item = entries.getJSONObject(position)
        val row = RemoteViews(context.packageName, R.layout.recent_transaction_widget_row)
        row.setTextViewText(R.id.recent_widget_label, item.optString("title"))
        row.setTextViewText(R.id.recent_widget_amount, item.optString("amount"))
        row.setTextViewText(R.id.recent_widget_details, item.optString("details"))
        views.addView(R.id.recent_widget_rows, row)
      }
      context.packageManager.getLaunchIntentForPackage(context.packageName)?.let { launch ->
        launch.action = Intent.ACTION_VIEW
        launch.removeCategory(Intent.CATEGORY_LAUNCHER)
        launch.data = Uri.parse("expenser:///transactions")
        views.setOnClickPendingIntent(
          R.id.recent_widget_title,
          PendingIntent.getActivity(context, 10, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        )
      }
      return views
    }
  }
}
