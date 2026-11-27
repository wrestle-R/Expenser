import { AppState, Platform } from "react-native";
import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { api } from "./api";
import { clearQueuedRawBankImportCandidates, getQueuedRawBankImportCandidates, isBankImportEnabled, markRawBankCandidateForReview } from "./bank-imports";
import { parsedResponsePayload } from "./bank-import-result";
import { notificationService } from "./notifications";
import { getStoredProfile } from "./storage";
import { supabase } from "./supabase";
import { refreshBackgroundTransactionWidget } from "./transaction-widget";

const TASK = "expenser-bank-import";
const MAX_BATCH = 20;
let activeImport: Promise<BackgroundTask.BackgroundTaskResult> | undefined;

async function importBankAlerts() {
  if (AppState.currentState === "active") {
    return BackgroundTask.BackgroundTaskResult.Success;
  }

  const profile = await getStoredProfile();
  if (!profile?.userId) return BackgroundTask.BackgroundTaskResult.Success;
  const candidates = isBankImportEnabled()
    ? getQueuedRawBankImportCandidates(profile.userId, true).slice(0, MAX_BATCH) : [];

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
        const payload = parsedResponsePayload(result);
        await api.createTransaction(payload, session.access_token);
        await notificationService.notifyBankReview(result.importSourceKey, "transaction", payload.type);
        clearQueuedRawBankImportCandidates([candidate.sourceKey]);
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
  try {
    await refreshBackgroundTransactionWidget(profile.userId, session.access_token);
  } catch {
    // Keep the last available snapshot and retry on the next scheduled run.
  }
  // Keep draining batches even when no more notifications arrive to wake us.
  const remaining = getQueuedRawBankImportCandidates(profile.userId, true).length;
  return failed || remaining > 0 ? BackgroundTask.BackgroundTaskResult.Failed : BackgroundTask.BackgroundTaskResult.Success;
}

if (Platform.OS === "android") {
  TaskManager.defineTask(TASK, ({ error }) => {
    if (error) return Promise.resolve(BackgroundTask.BackgroundTaskResult.Failed);
    activeImport ??= importBankAlerts().finally(() => { activeImport = undefined; });
    return activeImport;
  });
}

let registration: Promise<void> | undefined;

export function registerBankImportTask(): Promise<void> {
  if (Platform.OS !== "android") return Promise.resolve();
  registration ??= (async () => {
    if (await BackgroundTask.getStatusAsync() !== BackgroundTask.BackgroundTaskStatus.Available) return;
    if (!await TaskManager.isTaskRegisteredAsync(TASK)) {
      await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 15 });
    }
  })().finally(() => { registration = undefined; });
  return registration;
}
