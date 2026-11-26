export interface AndroidRelease {
  version: string;
  versionCode: number;
  downloadUrl: string;
}

export const ANDROID_RELEASE_MANIFEST: string;
export function availableAndroidRelease(
  data: unknown,
  installedCode: number,
  skippedCode: number,
): AndroidRelease | null;
