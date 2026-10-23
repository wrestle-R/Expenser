import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeSnapshot, readSnapshot, writeSnapshots } from './snapshot-storage.js';
function harness() {
  const values = new Map();
  const storage = { getItem: async (key) => values.get(key) ?? null, multiGet: async (keys) => keys.map((key) => [key, values.get(key) ?? null]), multiSet: async (pairs) => { for (const [key, value] of pairs) { assert.ok(value.length < 100000); values.set(key, value); } }, multiRemove: async (keys) => keys.forEach((key) => values.delete(key)) };
  return { storage, values };
}
test('10,000 transactions roundtrip below per-entry limits and shrink without leaving stale chunks', async () => {
  const h = harness(), rows = Array.from({ length: 10000 }, (_, i) => ({ _id: `row-${i}`, description: 'Synthetic merchant', amount: i, date: '2026-10-23', category: 'food' }));
  await writeSnapshots(h.storage, [['transactions', rows], ['outbox', [{ id: 'pending' }]]]);
  assert.ok(h.values.size > 2);
  assert.deepEqual(await readSnapshot(h.storage, 'transactions'), rows);
  assert.deepEqual(await readSnapshot(h.storage, 'outbox'), [{ id: 'pending' }]);
  await writeSnapshots(h.storage, [['transactions', rows.slice(0, 1)]]);
  assert.equal([...h.values.keys()].filter((key) => key.startsWith('transactions:part:')).length, 0);
});
test('legacy snapshots remain readable and missing chunks fail without overwriting saved data', async () => {
  const h = harness();
  h.values.set('transactions', '[{"_id":"legacy"}]');
  assert.deepEqual(await readSnapshot(h.storage, 'transactions'), [{ _id: 'legacy' }]);
  h.values.set('transactions', '{"version":3,"parts":2,"count":100}');
  await assert.rejects(readSnapshot(h.storage, 'transactions'), /missing/);
  assert.throws(() => encodeSnapshot('transactions', [{ text: 'x'.repeat(100000) }]), /too large/);
});
test('a failed atomic snapshot write retains the previously acknowledged cache and queue', async () => {
  const h = harness();
  await writeSnapshots(h.storage, [['transactions', [{ _id: 'saved' }]], ['outbox', []]]);
  h.storage.multiSet = async () => { throw new Error('Disk full'); };
  await assert.rejects(writeSnapshots(h.storage, [['transactions', [{ _id: 'new' }]], ['outbox', [{ id: 'pending' }]]]), /Disk full/);
  assert.deepEqual(await readSnapshot(h.storage, 'transactions'), [{ _id: 'saved' }]);
  assert.deepEqual(await readSnapshot(h.storage, 'outbox'), []);
});
