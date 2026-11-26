import assert from "node:assert/strict";
import { test } from "node:test";

import { availableAndroidRelease } from "./android-release.js";

test("only a newer Android build is offered, regardless of version label ordering", () => {
  const manifest = { version: "1.10.0", versionCode: 10 };
  assert.deepEqual(availableAndroidRelease(manifest, 9, 0), {
    version: "1.10.0",
    versionCode: 10,
    downloadUrl: "https://github.com/wrestle-R/Expenser/releases/download/expenser-android-v1.10.0/expenser-android.apk",
  });
  assert.equal(availableAndroidRelease(manifest, 10, 0), null);
  assert.equal(availableAndroidRelease(manifest, 11, 0), null);
});

test("skipping one build allows the next build to be offered", () => {
  assert.equal(availableAndroidRelease({ version: "1.4.1", versionCode: 6 }, 5, 6), null);
  assert.equal(availableAndroidRelease({ version: "1.4.2", versionCode: 7 }, 5, 6)?.versionCode, 7);
});

test("untrusted metadata cannot choose the APK host or inject a download path", () => {
  assert.equal(availableAndroidRelease({ version: "../../../../untrusted", versionCode: 6 }, 5, 0), null);
  assert.equal(availableAndroidRelease({ version: "1.4.1", versionCode: "6" }, 5, 0), null);
  assert.equal(availableAndroidRelease(null, 5, 0), null);
  assert.equal(availableAndroidRelease({
    version: "1.4.1", versionCode: 6, downloadUrl: "https://example.com/external.apk",
  }, 5, 0)?.downloadUrl, "https://github.com/wrestle-R/Expenser/releases/download/expenser-android-v1.4.1/expenser-android.apk");
});
