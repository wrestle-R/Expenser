import assert from "node:assert/strict";
import { test } from "node:test";

import { availableAndroidRelease } from "./android-release.js";

const sha256 = "a".repeat(64);

test("only a newer Android build is offered, regardless of version label ordering", () => {
  const manifest = { version: "1.10.0", versionCode: 10, sha256 };
  assert.deepEqual(availableAndroidRelease(manifest, 9, 0), manifest);
  assert.equal(availableAndroidRelease(manifest, 10, 0), null);
  assert.equal(availableAndroidRelease(manifest, 11, 0), null);
});

test("skipping one build allows the next build to be offered", () => {
  assert.equal(availableAndroidRelease({ version: "1.4.1", versionCode: 6, sha256 }, 5, 6), null);
  assert.equal(availableAndroidRelease({ version: "1.4.2", versionCode: 7, sha256 }, 5, 6)?.versionCode, 7);
});

test("an update needs a valid release version and APK checksum", () => {
  assert.equal(availableAndroidRelease({ version: "../../../../untrusted", versionCode: 6, sha256 }, 5, 0), null);
  assert.equal(availableAndroidRelease({ version: "1.4.1", versionCode: "6", sha256 }, 5, 0), null);
  assert.equal(availableAndroidRelease({ version: "1.4.1", versionCode: 6, sha256: "invalid" }, 5, 0), null);
  assert.equal(availableAndroidRelease(null, 5, 0), null);
});
