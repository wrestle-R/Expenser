const RELEASE_ROOT = "https://github.com/wrestle-R/Expenser/releases";
export const ANDROID_RELEASE_MANIFEST = `${RELEASE_ROOT}/latest/download/expenser-android.json`;

export function availableAndroidRelease(data, installedCode, skippedCode) {
  if (
    !Number.isSafeInteger(installedCode) || installedCode < 1 ||
    !data || !Number.isSafeInteger(data.versionCode) ||
    data.versionCode <= installedCode || data.versionCode === skippedCode ||
    typeof data.version !== "string" || !/^\d+\.\d+\.\d+$/.test(data.version) ||
    typeof data.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(data.sha256)
  ) {
    return null;
  }

  return {
    version: data.version,
    versionCode: data.versionCode,
    sha256: data.sha256,
  };
}
