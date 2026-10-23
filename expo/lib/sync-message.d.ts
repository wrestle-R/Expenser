import type { SyncStatus } from './sync';
export function syncMessage(status: SyncStatus): { title: string; detail: string; action?: string; tone: string };
