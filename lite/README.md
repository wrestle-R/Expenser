# Expenser Lite

A separate Android app (`com.rdp.expenser.lite`) with the existing Expenser theme and logo, a native splash screen and one transactions screen. Uses the same account/API and local-first SMS import. Add, edit, search and delete transactions online or offline. Existing splits and transaction timestamps are preserved when editing unrelated fields.

The full app remains in `expo/`. Lite shares its parser, native SMS listener, storage, outbox and sync implementation instead of forking financial logic. It has its own package/storage and needs its own sign-in and notification-access permission. No charts, dashboard, workflows, router, tab navigation, animation runtime, SVG package or icon font is included in Lite's dependency graph. Sync only refreshes transactions and profile.

## Development

From `lite/`:

```sh
npm ci
npm start
npm run prebuild -- --platform android
node scripts/build-android.mjs
npm run typecheck
```

The launch/build wrappers use the public endpoints and publishable Supabase key in `eas.json`, with process environment overrides. No service-role key or private credential belongs in the client. Keep shared source in `../expo/` available when building; Metro resolves one React instance from Lite's dependencies.

Release APKs use Hermes, R8/resource shrinking, compressed native libraries and ARM64/ARMv7 architectures. x86 Android emulators require a separate development build with their architecture enabled. The local generated Gradle template signs releases with a development key; sign a distributable APK with your release credentials, or use EAS signing. Do not commit signing credentials. APK size comparisons must identify the ABI differences.

Tests: `cd ../expo && node --test lib/*.test.mjs`. Synthetic performance benchmark: `node scripts/benchmark-transactions.mjs`. Unit tests simulate elapsed offline days and expired authentication; they do not claim a real seven-day device soak.
