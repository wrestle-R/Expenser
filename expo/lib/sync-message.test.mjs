import test from 'node:test';
import assert from 'node:assert/strict';
import { syncMessage } from './sync-message.js';
test('connectivity never hides pending uploads, authentication failures or rejected changes', () => {
  const online = { isOnline: true, isSyncing: false, pendingChanges: 2, rejectedChanges: 0 };
  assert.equal(syncMessage(online).title, 'Waiting to upload');
  assert.match(syncMessage({ ...online, isOnline: false }).detail, /saved on this device/);
  assert.equal(syncMessage({ ...online, errorKind: 'auth', error: 'Expired' }).action, 'Sign in');
  assert.equal(syncMessage({ ...online, rejectedChanges: 1 }).title, 'Changes need attention');
  assert.equal(syncMessage({ ...online, pendingChanges: 0 }).title, 'Up to date');
});
