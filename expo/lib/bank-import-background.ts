import { AppState, Platform } from "react-native";
import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { api } from "./api";
import { clearQueuedRawBankImportCandidates, getQueuedRawBankImportCandidates, getBankNotificationAccessEnabled, markRawBankCandidateForReview } from "./bank-imports";
import { parsedResponsePayload } from "./bank-import-result";
import { notificationService } from "./notifications";
import { getStoredProfile } from "./storage";
import { supabase } from "./supabase";

const TASK = "expenser-bank-import";
const MAX_BATCH = 20;

if (Platform.OS === "android") {
  TaskManager.defineTask(TASK, async ({ error }) => {
    if (error) return BackgroundTask.BackgroundTaskResult.Failed;
    if (AppState.currentState === "active" || !getBankNotificationAccessEnabled()) {
      return BackgroundTask.BackgroundTaskResult.Success;
    }

    const profile = await getStoredProfile();
    if (!profile?.userId) return BackgroundTask.BackgroundTaskResult.Success;
    const candidates = getQueuedRawBankImportCandidates(profile.userId, true).slice(0, MAX_BATCH);
    if (!candidates.length) return BackgroundTask.BackgroundTaskResult.Success;

    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (session?.user.id !== profile.userId) return BackgroundTask.BackgroundTaskResult.Success;

    let failed = false;
    for (const candidate of candidates) {
      try {
        const result = await api.parseBankNotification(candidate, true, session.access_token);
        if (result.kind === "transaction") {
          // The API deduplicates by user and import source, including if JS
          // stops after the server saves the row but before we clear the alert.
          await api.createTransaction(parsedResponsePayload(result), session.access_token);
          clearQueuedRawBankImportCandidates([candidate.sourceKey]);
          await notificationService.notifyBankReview(result.importSourceKey, "transaction");
        } else if (result.kind === "non_transaction") {
          clearQueuedRawBankImportCandidates([candidate.sourceKey]);
        } else {
          // Keep uncertain alerts in the owner's native queue for review.
          await notificationService.notifyBankReview(candidate.sourceKey, "alert");
          markRawBankCandidateForReview(candidate.sourceKey);
        }
      } catch {
        failed = true;
      }
    }
    return failed ? BackgroundTask.BackgroundTaskResult.Failed : BackgroundTask.BackgroundTaskResult.Success;
  });
}

let registration: Promise<void> | undefined;

export function registerBankImportTask(): Promise<void> {
  if (Platform.OS !== "android" || !getBankNotificationAccessEnabled()) return Promise.resolve();
  registration ??= (async () => {
    if (await BackgroundTask.getStatusAsync() !== BackgroundTask.BackgroundTaskStatus.Available) return;
    if (!await TaskManager.isTaskRegisteredAsync(TASK)) {
      await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 15 });
    }
  })().finally(() => { registration = undefined; });
  return registration;
}
