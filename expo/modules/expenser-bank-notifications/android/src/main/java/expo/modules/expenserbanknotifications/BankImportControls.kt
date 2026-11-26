package expo.modules.expenserbanknotifications

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService
import android.widget.RemoteViews

internal object BankImportControls {
  fun enabled(context: Context) = context.getSharedPreferences("expenser_bank_notifications", Context.MODE_PRIVATE).getBoolean("import_enabled", true)
  fun setEnabled(context: Context, enabled: Boolean) {
    context.getSharedPreferences("expenser_bank_notifications", Context.MODE_PRIVATE).edit().putBoolean("import_enabled", enabled).commit()
    BankImportWidget.update(context)
    TileService.requestListeningState(context, ComponentName(context, BankImportTile::class.java))
    context.sendBroadcast(Intent("expo.modules.expenserbanknotifications.BANK_IMPORT_QUEUED").setPackage(context.packageName))
    if (enabled) BankImportWork.enqueue(context)
  }
}

class BankImportTile : TileService() {
  override fun onStartListening() { refresh() }
  override fun onClick() {
    super.onClick()
    if (isLocked) { unlockAndRun { toggle() } } else toggle()
  }
  private fun toggle() { BankImportControls.setEnabled(this, !BankImportControls.enabled(this)); refresh() }
  private fun refresh() {
    qsTile?.apply {
      label = "SMS import"
      state = if (BankImportControls.enabled(this@BankImportTile)) Tile.STATE_ACTIVE else Tile.STATE_INACTIVE
      updateTile()
    }
  }
}

class BankImportWidget : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) { update(context) }
  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    if (intent.action == TOGGLE) BankImportControls.setEnabled(context, !BankImportControls.enabled(context))
  }
  companion object {
    private const val TOGGLE = "expo.modules.expenserbanknotifications.TOGGLE_IMPORT"
    fun update(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, BankImportWidget::class.java))
      val views = RemoteViews(context.packageName, R.layout.bank_import_widget)
      val enabled = BankImportControls.enabled(context)
      views.setTextViewText(R.id.bank_import_toggle, "SMS import: " + if (enabled) "On" else "Paused")
      views.setContentDescription(R.id.bank_import_toggle, if (enabled) "Pause SMS import" else "Resume SMS import")
      val intent = Intent(context, BankImportWidget::class.java).setAction(TOGGLE)
      views.setOnClickPendingIntent(R.id.bank_import_toggle, PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
      val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
      if (launch != null) views.setOnClickPendingIntent(R.id.bank_import_open, PendingIntent.getActivity(context, 1, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
      manager.updateAppWidget(ids, views)
    }
  }
}
