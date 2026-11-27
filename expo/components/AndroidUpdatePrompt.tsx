import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import {
  addAndroidUpdateProgressListener,
  downloadAndroidUpdate,
  installAndroidUpdate,
  type AndroidUpdateProgress,
} from "expenser-bank-notifications";
import * as Application from "expo-application";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, AppState, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View,
} from "react-native";

import ResponsiveModal from "./ResponsiveModal";
import notes from "../android-release-notes.json";
import { Colors } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { ANDROID_RELEASE_MANIFEST, availableAndroidRelease, type AndroidRelease } from "../lib/android-release";
import { withRequestDeadline } from "../lib/request-deadline";

const SKIPPED_BUILD = "android-release:skipped-build";
const SEEN_NOTES = "android-release:seen-notes";

function AndroidUpdatePrompt() {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const { fontScale, width } = useWindowDimensions();
  const [release, setRelease] = useState<AndroidRelease | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [operation, setOperation] = useState<"download" | "install" | null>(null);
  const [progress, setProgress] = useState<AndroidUpdateProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadedCode, setDownloadedCode] = useState(0);
  const [permissionRequired, setPermissionRequired] = useState(false);
  const dismissedBuild = useRef(0);
  const installedCode = Number(Application.nativeBuildVersion);

  useEffect(() => {
    let mounted = true;
    let checking = false;

    const check = async () => {
      if (checking || AppState.currentState === "background") return;
      checking = true;

      try {
        const data = await withRequestDeadline(async (signal) => {
          const response = await fetch(ANDROID_RELEASE_MANIFEST, { signal, cache: "no-cache" });
          return response.ok ? response.json() : null;
        }, 8_000);
        const skipped = Number(await AsyncStorage.getItem(SKIPPED_BUILD));
        const update = availableAndroidRelease(data, installedCode, skipped);
        if (mounted && AppState.currentState === "active" &&
            update && update.versionCode !== dismissedBuild.current) {
          setRelease(update);
        }
      } catch {
        // Unavailable update metadata should never interrupt the app.
      } finally {
        checking = false;
      }
    };

    void check();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void check();
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [installedCode]);

  useEffect(() => {
    if (Application.nativeApplicationVersion !== notes.version || notes.notes.length === 0) return;
    let mounted = true;

    void Promise.all([
      AsyncStorage.getItem(SEEN_NOTES),
      Application.getInstallationTimeAsync(),
      Application.getLastUpdateTimeAsync(),
    ]).then(([seenBuild, installedAt, updatedAt]) => {
      if (mounted && seenBuild !== String(installedCode) && updatedAt > installedAt) setShowNotes(true);
    }).catch(() => {
      // Install history is optional and never blocks startup.
    });

    return () => { mounted = false; };
  }, [installedCode]);

  const closeNotes = () => {
    setShowNotes(false);
    void AsyncStorage.setItem(SEEN_NOTES, String(installedCode)).catch(() => {});
  };

  const skip = () => {
    if (!release) return;
    dismissedBuild.current = release.versionCode;
    setRelease(null);
    setError(null);
    void AsyncStorage.setItem(SKIPPED_BUILD, String(release.versionCode)).catch(() => {});
  };

  const ready = release?.versionCode === downloadedCode;
  const downloading = operation === "download";
  const inlineActions = width >= 350 && fontScale < 1.3;
  const activeProgress = progress?.versionCode === release?.versionCode ? progress : null;
  const percent = activeProgress && activeProgress.total > 0
    ? Math.min(100, Math.floor(100 * activeProgress.received / activeProgress.total))
    : null;
  const title = downloading ? "Downloading update"
    : ready && permissionRequired ? "Allow installation"
    : ready ? "Ready to install" : "Update available";
  const description = ready && permissionRequired
    ? "Allow installs from Expenser in Android settings, then return and tap Install."
    : ready ? "Android will ask you to confirm the installation."
    : "Download in Expenser, then confirm the install in Android.";

  const update = async () => {
    if (!release || operation) return;
    setError(null);
    setProgress(null);
    let canInstall = ready;
    let subscription: ReturnType<typeof addAndroidUpdateProgressListener> | undefined;
    try {
      if (!canInstall) {
        setOperation("download");
        subscription = addAndroidUpdateProgressListener(setProgress);
        await downloadAndroidUpdate(release.version, release.versionCode, release.sha256);
        canInstall = true;
        setDownloadedCode(release.versionCode);
      }
      setOperation("install");
      const result = await installAndroidUpdate(release.versionCode, release.sha256);
      setPermissionRequired(result === "permission");
      if (result === "missing") {
        setDownloadedCode(0);
        setError("The download is no longer on this device. Download it again.");
      }
    } catch {
      setError(canInstall ? "Couldn't open the installer. Try again."
        : "Couldn't download the update. Check your connection and try again.");
    } finally {
      subscription?.remove();
      setOperation(null);
    }
  };

  return (
    <>
      <ResponsiveModal visible={showNotes} onClose={closeNotes} maxWidth={380} contentStyle={styles.notesModal}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
          What’s new in {notes.version}
        </Text>
        <ScrollView style={styles.notesList}>
          {notes.notes.map((note) => (
            <Text key={note} style={[styles.note, { color: colors.text }]}>•  {note}</Text>
          ))}
        </ScrollView>
        <Pressable accessibilityRole="button" onPress={closeNotes} style={[styles.done, { backgroundColor: colors.primary }]}>
          <Text style={[styles.actionText, { color: colors.primaryForeground }]}>Done</Text>
        </Pressable>
      </ResponsiveModal>
      {release && !showNotes && (
        <ResponsiveModal visible onClose={skip} loading={Boolean(operation)} maxWidth={360} contentStyle={styles.updateModal}>
          <View style={styles.heading}>
            <Ionicons
              name={ready && permissionRequired ? "shield-outline" : ready ? "checkmark-circle-outline" : "download-outline"}
              size={23}
              color={ready && permissionRequired ? colors.warning : ready ? colors.success : colors.text}
              accessible={false}
            />
            <View style={styles.headingText}>
              <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{title}</Text>
              <Text style={[styles.version, { color: colors.textMuted }]}>Expenser {release.version}</Text>
            </View>
          </View>

          {downloading ? (
            <View style={styles.progress} accessibilityLiveRegion="polite">
              <View style={styles.progressLabel}>
                <Text style={[styles.description, { color: colors.text }]}>
                  {percent === 100 ? "Verifying download…" : percent === null && !activeProgress?.received
                    ? "Starting download…" : "Downloading…"}
                </Text>
                {percent === null ? <ActivityIndicator size="small" color={colors.primary} /> : (
                  <Text style={[styles.progressNumber, { color: colors.text }]}>{percent}%</Text>
                )}
              </View>
              {percent !== null && (
                <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: percent }}
                  style={[styles.track, { backgroundColor: colors.backgroundSecondary }]}>
                  <View style={[styles.fill, { backgroundColor: colors.primary, width: `${percent}%` }]} />
                </View>
              )}
            </View>
          ) : (
            <Text accessibilityRole={error ? "alert" : undefined}
              style={[styles.description, { color: error ? colors.error : colors.text }]}>
              {error ?? description}
            </Text>
          )}

          {!downloading && (
            <View style={[styles.actions, !inlineActions && styles.stackedActions]}>
              <Pressable accessibilityRole="button" disabled={Boolean(operation)} onPress={skip}
                style={[styles.action, inlineActions && styles.secondary, { backgroundColor: colors.backgroundSecondary }]}>
                <Text style={[styles.actionText, { color: colors.text }]}>Skip</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityState={{ busy: Boolean(operation), disabled: Boolean(operation) }}
                disabled={Boolean(operation)} onPress={() => { void update(); }}
                style={[styles.action, inlineActions && styles.primary, { backgroundColor: colors.primary }]}>
                <Text style={[styles.actionText, { color: colors.primaryForeground }]}>
                  {operation === "install" ? "Opening installer…" : ready ? "Install" : error ? "Retry download" : "Download update"}
                </Text>
              </Pressable>
            </View>
          )}
        </ResponsiveModal>
      )}
    </>
  );
}

export default function AndroidUpdates() {
  if (Platform.OS !== "android" || Application.applicationId !== "com.rdp.expenser") return null;
  return <AndroidUpdatePrompt />;
}

const styles = StyleSheet.create({
  notesModal: { padding: 24, gap: 12 },
  title: { fontSize: 20, fontWeight: "700" },
  notesList: { flexGrow: 0 },
  note: { fontSize: 15, lineHeight: 22, marginBottom: 8 },
  done: { alignItems: "center", justifyContent: "center", minHeight: 48, borderRadius: 12 },
  updateModal: { padding: 20, gap: 14 },
  heading: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  headingText: { flex: 1 },
  version: { fontSize: 13, marginTop: 3 },
  description: { fontSize: 15, lineHeight: 21 },
  actions: { flexDirection: "row", gap: 8 },
  stackedActions: { flexDirection: "column-reverse" },
  action: { minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  primary: { flex: 2 },
  secondary: { flex: 1 },
  actionText: { fontSize: 15, fontWeight: "700", textAlign: "center" },
  progress: { gap: 8 },
  progressLabel: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  progressNumber: { fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] },
  track: { borderRadius: 4, height: 6, overflow: "hidden" },
  fill: { borderRadius: 4, height: "100%" },
});
