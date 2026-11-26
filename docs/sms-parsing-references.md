# SMS parsing references

The shared parser runs on the phone and server. It extracts completed INR bank movements independently of a bank-specific template, with cloud parsing and a review inbox for unresolved messages. It does not assume a fixed year or require numeric-only references.

References inspected on 2026-11-26:

- https://github.com/Hike-12/budget-mobile: Android SMS broadcast capture and recent-inbox recovery alongside notification capture.
- https://github.com/rahatsayyed/BankSMSParser: bank-specific tests, including SBI debit/credit wording. Its full bank library was not vendored.
- https://github.com/DeepakSilaych/umber: generic amount extraction and rejection of negated/future transactions. Its implementation was not copied.

Regression checks include compact Dr/Cr, ordinary completed movements, prefixed and suffixed INR amounts, SBI verb-anchored amounts, dates with different years, named references, and negated or future movements. Existing anonymized multi-bank fixtures remain in `expo/lib/fixtures/bank-sms.json`.

Android import can be paused with the app switch, home-screen widget or Quick Settings tile. The setting is shared and persists across restarts. Inbox scanning requires SMS permission. Captured work is persisted before processing and is retried by WorkManager. Android can delay scheduled work, and force-stopping an app prevents background delivery until it is opened again.

Cloud HTTP 5xx responses now produce a saved review item instead of an endless retry loop. Authentication and connection failures retain the retry path. The cloud service's underlying production error remains a separate operational investigation.
