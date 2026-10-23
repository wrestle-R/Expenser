import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
import { dedupeTransactions, mergeServerTransactions } from '../lib/transaction-state.js';
import { indexTransactions, searchTransactions } from '../lib/transaction-list.js';
const timings = [];
function measure(name, run) { const start = performance.now(); const result = run(); timings.push({ name, milliseconds: +(performance.now() - start).toFixed(2) }); return result; }
for (const count of [1000, 10000, 50000]) {
  const rows = Array.from({ length: count }, (_, i) => ({ _id: `synthetic-${i}`, clientRequestId: `client-${i}`, amount: i + .25, description: `Synthetic merchant ${i}`, category: i % 2 ? 'food' : 'transport', paymentMethod: 'bank', type: 'expense', date: new Date(Date.UTC(2026, 0, 1) + i * 60000).toISOString() }));
  const json = JSON.stringify(rows);
  const cached = measure(`${count}: cache JSON load`, () => JSON.parse(json));
  const sorted = measure(`${count}: deduplicate/sort`, () => dedupeTransactions([...cached, ...cached.slice(0, 100)]));
  assert.equal(sorted.length, count);
  const index = measure(`${count}: search index`, () => indexTransactions(sorted));
  const found = measure(`${count}: 20 searches`, () => { let found; for (let i = 0; i < 20; i++) found = searchTransactions(index, `merchant ${count - 1}`); return found; });
  assert.equal(found.length, 1);
  assert.equal(found[0]._id, `synthetic-${count - 1}`);
  const merged = measure(`${count}: reconnect merge`, () => mergeServerTransactions({ localTransactions: sorted, serverTransactions: rows, operations: [{ entity: 'transaction', entityId: `synthetic-${count - 1}`, action: 'delete' }] }));
  assert.equal(merged.length, count - 1);
}
console.log(JSON.stringify({ runtime: process.version, platform: process.platform, scope: 'Synthetic CPU benchmark on development computer; device scrolling and startup measured separately.', timings }, null, 2));
