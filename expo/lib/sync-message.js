export function syncMessage(status) {
  const count = status.pendingChanges ?? 0;
  const changes = `${count} ${count === 1 ? "change" : "changes"}`;
  if (status.errorKind === "auth" && status.error) return { title: "Sign in to sync", detail: status.error, action: "Sign in", tone: "warning" };
  if (status.rejectedChanges) return { title: "Changes need attention", detail: `${status.rejectedChanges} could not be uploaded. Saved on this device. ${status.error ?? ""}`.trim(), action: "Retry", tone: "warning" };
  if (status.isSyncing) return { title: "Syncing", detail: count ? `${changes} waiting to upload. Saved on this device.` : "Refreshing your saved transactions.", tone: "normal" };
  if (!status.isOnline) return { title: "Offline", detail: count ? `${changes} saved on this device. Uploads resume when online.` : "Saved on this device. You can keep adding and editing.", tone: "normal" };
  if (status.error) return { title: "Sync needs a retry", detail: status.error, action: "Retry", tone: "warning" };
  if (count) return { title: "Waiting to upload", detail: `${changes} saved on this device.`, action: "Retry", tone: "normal" };
  return { title: "Up to date", detail: "All changes uploaded.", tone: "normal" };
}
