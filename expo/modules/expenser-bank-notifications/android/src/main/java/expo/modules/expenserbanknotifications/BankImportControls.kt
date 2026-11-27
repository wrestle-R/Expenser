package expo.modules.expenserbanknotifications

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService

internal object BankImportControls {
  fun enabled(context: Context) = context.getSharedPreferences("expenser_bank_notifications", Context.MODE_PRIVATE).getBoolean("import_enabled", true)
  fun setEnabled(context: Context, enabled: Boolean) {
    context.getSharedPreferences("expenser_bank_notifications", Context.MODE_PRIVATE).edit().putBoolean("import_enabled", enabled).commit()
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
