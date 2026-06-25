# Expenser Lite

React Native CLI Android app for the lightweight Expenser mobile flow.

## Scope

- Sign in
- Dashboard
- Transactions add, edit, delete
- Bank SMS notification import
- Setup screen for notification access and categories
- Stealth mode toggle
- Dark mode toggle

The Android application id is `com.rdp.expenserlite`, so it installs side-by-side with the Expo app.

## Defaults

```txt
EXPO_PUBLIC_API_URL=https://expenser-rdp.vercel.app
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_Z3VpZGluZy1jYWltYW4tNjIuY2xlcmsuYWNjb3VudHMuZGV2JA
```

These values are built in as defaults. Override them in the shell before bundling if needed.

## Local Android Commands

```bash
cd rn-lite
npm install
npm run typecheck
npm run lint
npm run android
```

Release APK locally:

```bash
cd rn-lite/android
./gradlew assembleRelease
```

Unsigned/debug-signed fallback output:

```txt
rn-lite/android/app/build/outputs/apk/release/app-release.apk
```

## GitHub Release

The workflow at `.github/workflows/android-lite-release.yml` runs when a tag matching `v*.*.*` is pushed. It builds only the Lite APK and uploads it to GitHub Releases.

Required repository secrets:

```txt
ANDROID_KEYSTORE_BASE64
ANDROID_KEYSTORE_PASSWORD
ANDROID_KEY_ALIAS
ANDROID_KEY_PASSWORD
```

Tag command for the user to run manually:

```bash
git tag v1.0.0
git push origin v1.0.0
```
