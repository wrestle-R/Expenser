import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import { useEffect, useRef, useState } from "react";
import { AppState, Linking, Platform, Pressable, ScrollView, StyleSheet, Text } from "react-native";

import ConfirmModal from "./ConfirmModal";
import ResponsiveModal from "./ResponsiveModal";
import notes from "../android-release-notes.json";
import { Colors } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { ANDROID_RELEASE_MANIFEST, availableAndroidRelease, type AndroidRelease } from "../lib/android-release";
import { withRequestDeadline } from "../lib/request-deadline";

const SKIPPED_BUILD = "android-release:skipped-build";
const SEEN_NOTES = "android-release:seen-notes";

function AndroidUpdatePrompt() {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const { showToast } = useToast();
  const [release, setRelease] = useState<AndroidRelease | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [opening, setOpening] = useState(false);
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
    void AsyncStorage.setItem(SKIPPED_BUILD, String(release.versionCode)).catch(() => {});
  };

  const download = async () => {
    if (!release || opening) return;
    setOpening(true);
    try {
      await Linking.openURL(release.downloadUrl);
      dismissedBuild.current = release.versionCode;
      setRelease(null);
    } catch {
      showToast("Couldn't open the update download. Please try again.", "error");
    } finally {
      setOpening(false);
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
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      </ResponsiveModal>
      {release && !showNotes && (
        <ConfirmModal
          visible
          title={`Expenser ${release.version} is available`}
          message="Download the update, then open the APK to install it."
          icon="cloud-download-outline"
          confirmText="Update"
          cancelText="Skip"
          loading={opening}
          onConfirm={() => { void download(); }}
          onClose={skip}
        />
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
  doneText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
