package expo.modules.expenserbanknotifications

import org.junit.Assert.assertEquals
import org.junit.Test

class WidgetRowCapacityTest {
  @Test
  fun showsNewestRowsThatFitTheCurrentWidgetSize() {
    val header = 40f
    val row = 42f
    assertEquals(4, WidgetRowCapacity.count(208f, header, row, availableRows = 20))
    assertEquals(5, WidgetRowCapacity.count(250f, header, row, availableRows = 20))
    assertEquals(10, WidgetRowCapacity.count(460f, header, row, availableRows = 20))
  }

  @Test
  fun excludesPartialRowsAndNeverRendersMoreRowsThanExist() {
    assertEquals(4, WidgetRowCapacity.count(249f, 40f, 42f, availableRows = 20))
    assertEquals(2, WidgetRowCapacity.count(460f, 40f, 42f, availableRows = 2))
    assertEquals(0, WidgetRowCapacity.count(30f, 40f, 42f, availableRows = 20))
    assertEquals(0, WidgetRowCapacity.count(460f, 40f, 42f, availableRows = 0))
  }
}
