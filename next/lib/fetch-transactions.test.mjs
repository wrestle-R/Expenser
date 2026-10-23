import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchTransactionHistory } from './fetch-transactions.js';
test('web history assembles complete pages and rejects a failed partial download', async () => {
  let count = 0;
  const result = await fetchTransactionHistory(async () => ({ ok: true, json: async () => ++count === 1 ? { transactions: [{ _id: 'one' }], nextCursor: 'next' } : { transactions: [{ _id: 'two' }], nextCursor: null } }));
  assert.equal(result.transactions.length, 2);
  count = 0;
  await assert.rejects(fetchTransactionHistory(async () => ({ ok: ++count === 1, json: async () => count === 1 ? { transactions: [{ _id: 'partial' }], nextCursor: 'next' } : { error: 'Unavailable' } })), /Unavailable/);
});
