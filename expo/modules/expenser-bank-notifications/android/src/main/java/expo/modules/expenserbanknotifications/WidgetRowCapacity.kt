package expo.modules.expenserbanknotifications

internal object WidgetRowCapacity {
  fun count(height: Float, headerHeight: Float, rowHeight: Float, availableRows: Int): Int =
    ((height - headerHeight) / rowHeight).toInt().coerceIn(0, availableRows)
}
