# Expenser Android releases

1. Set the Android version and increment `android.versionCode` in `expo/app.json`. Update `expo/android-release-notes.json` to match. The APK includes these notes for the first open after an upgrade.
2. Push the commit to `main`. Push a tag of the form `expenser-android-v1.4.0` at that commit. With a dedicated Expo token in the repository's `EXPO_TOKEN` Actions secret, the Android release workflow starts or resumes the matching EAS build and publishes when it succeeds. The token needs access to the Expenser EAS project and its Android signing configuration.
3. To retry, rerun the workflow or dispatch it at the same tag. You can supply an EAS build ID from the `release` profile at that commit. The workflow verifies the build, package, version and APK signing certificate before publishing.

If you keep Expo authentication on your machine, run the same two steps from the clean tagged checkout with `ANDROID_HOME` configured, EAS and GitHub CLI installed, and access to the repository. Load `EXPO_TOKEN` into the environment of the build command from your local credential store.

```sh
assets=$(mktemp -d)
bash .github/scripts/build-android-release.sh "$assets"
bash .github/scripts/publish-android-release.sh "$assets"
```

The publisher uploads the signed APK and update manifest to a draft before making it the latest release. Keep releases for other builds from taking over the latest-release pointer. The Android app reads `expenser-android.json` from that pointer when it enters the foreground. Android handles APK installation, including any permission prompt from the browser.
