const RELEASE_ROOT = "https://github.com/wrestle-R/Expenser/releases";
export const ANDROID_RELEASE_MANIFEST = `${RELEASE_ROOT}/latest/download/expenser-android.json`;

export function availableAndroidRelease(data, installedCode, skippedCode) {
  if (
    !Number.isSafeInteger(installedCode) || installedCode < 1 ||
    !data || !Number.isSafeInteger(data.versionCode) ||
    data.versionCode <= installedCode || data.versionCode === skippedCode ||
    typeof data.version !== "string" || !/^\d+\.\d+\.\d+$/.test(data.version)
  ) {
    return null;
  }

  return {
    version: data.version,
    versionCode: data.versionCode,
    downloadUrl: `${RELEASE_ROOT}/download/expenser-android-v${data.version}/expenser-android.apk`,
  };
}
