package expo.modules.expenserbanknotifications

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class FinancialSmsCandidateDetectorTest {
  @Test
  fun acceptsTransactionAndReviewCandidates() {
    assertTrue(FinancialSmsCandidateDetector.isCandidate("Rs.125.40 debited from A/c XX4455 via UPI"))
    assertTrue(FinancialSmsCandidateDetector.isCandidate("Lien of INR 500 marked on your account"))
    assertTrue(FinancialSmsCandidateDetector.isCandidate("Payment request for Rs 800 received via UPI"))
    assertTrue(FinancialSmsCandidateDetector.isCandidate("Your card payment of INR 99 failed"))
    assertTrue(FinancialSmsCandidateDetector.isCandidate("A/c XX4455 debited Rs 10. Never share OTP or PIN"))
    assertTrue(FinancialSmsCandidateDetector.isCandidate("Union Bank of India A/c *4280 Debited Rs:30.00 on 06-08-2026 16:57:37 by Mob Bk ref no 621803008608, Fvg: Paresh R Avl Bal Rs:96.23. Not you?Call 18002333/SMS BLOCK 4280 to 8879365472"))
    assertTrue(FinancialSmsCandidateDetector.isCandidate("Union Bank of India A/c *4280 Debited Rs:4.85 on 13-07-2026 17:31:48 by Mob Bk ref no 173147514539, Fvg: Indian R Avl Bal Rs:54.73. Not you?Call 18002333/SMS BLOCK 4280 to 8879365472z"))
  }

  @Test
  fun rejectsOrdinaryAndOtpNotifications() {
    assertFalse(FinancialSmsCandidateDetector.isCandidate("You have a new message"))
    assertFalse(FinancialSmsCandidateDetector.isCandidate("123456 is your OTP for login. Do not share it."))
    assertFalse(FinancialSmsCandidateDetector.isCandidate("Special cashback offer ends tonight"))
  }

  @Test
  fun onlyMatchesTheDefaultSmsPackage() {
    assertTrue(DefaultSmsSourceFilter.matches("com.google.android.apps.messaging", "com.google.android.apps.messaging"))
    assertFalse(DefaultSmsSourceFilter.matches("com.google.android.apps.messaging", "com.example.bank"))
    assertFalse(DefaultSmsSourceFilter.matches(null, "com.google.android.apps.messaging"))
  }

  @Test
  fun fallsBackToTheResolvedSmsHandlerWhenTelephonyIsUnavailable() {
    assertEquals(
      "com.google.android.apps.messaging",
      DefaultSmsPackageResolver.choose(null, "com.google.android.apps.messaging")
    )
    assertEquals(
      "com.android.messaging",
      DefaultSmsPackageResolver.choose("com.android.messaging", "com.google.android.apps.messaging")
    )
    assertEquals(null, DefaultSmsPackageResolver.choose("", null))
  }

  @Test
  fun ignoresGroupSummaries() {
    val groupSummaryFlag = 0x200
    assertTrue(NotificationCapturePolicy.isGroupSummary(0x210, groupSummaryFlag))
    assertFalse(NotificationCapturePolicy.isGroupSummary(0x10, groupSummaryFlag))
  }

  @Test
  fun deduplicatesAndBoundsQueuedSourceKeys() {
    assertFalse(QueueRetentionPolicy.shouldEnqueue(listOf("sms:1", "sms:2"), "sms:2"))
    assertTrue(QueueRetentionPolicy.shouldEnqueue(listOf("sms:1", "sms:2"), "sms:3"))
    assertEquals(3, QueueRetentionPolicy.firstRetainedIndex(itemCount = 8, maxItems = 5))
    assertEquals(0, QueueRetentionPolicy.firstRetainedIndex(itemCount = 3, maxItems = 5))
  }

  @Test
  fun evaluatesRecentListenerActivity() {
    val now = 10_000L
    assertTrue(NotificationAccessHealthPolicy.isRecent(9_000L, now, 2_000L))
    assertFalse(NotificationAccessHealthPolicy.isRecent(7_000L, now, 2_000L))
    assertFalse(NotificationAccessHealthPolicy.isRecent(0L, now, 2_000L))
  }

  @Test
  fun selectsMessagingTextBeforeFallbackExtras() {
    assertEquals(
      "Latest debit INR 100",
      SmsNotificationTextSelector.select(
        bigText = "Older expanded message",
        textLines = listOf("line one", "line two"),
        text = "compact text",
        messagingTexts = listOf("Earlier message", "Latest debit INR 100")
      )
    )
  }

  @Test
  fun normalizesExpandedText() {
    assertEquals(
      "INR 250 credited to account",
      SmsNotificationTextSelector.select(
        bigText = " INR 250\ncredited   to account ",
        textLines = emptyList(),
        text = null,
        messagingTexts = emptyList()
      )
    )
  }
}
