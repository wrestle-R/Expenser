import test from 'node:test';
import assert from 'node:assert/strict';
import { indexTransactions, searchTransactions } from './transaction-list.js';
import { parseTransactionDraft } from '../../lite/transaction-draft.js';
test('large history search preserves ordering and matches category, account and reference', () => {
  const rows = Array.from({ length: 10000 }, (_, i) => ({ _id: `row-${i}`, description: `Merchant ${i}`, category: 'Food', amount: i + .25, paymentMethod: 'bank', importedBankReference: `SYNTH${i}`, importedAccountSuffix: '1234' }));
  const index = indexTransactions(rows);
  assert.deepEqual(searchTransactions(index, 'FOOD synth9876 1234').map((row) => row._id), ['row-9876']);
  assert.deepEqual(searchTransactions(index, '　merchant 9876　').map((row) => row._id), ['row-9876']);
  assert.equal(searchTransactions(index, '').length, rows.length);
  assert.equal(searchTransactions(index, 'nonexistent').length, 0);
});
test('lite form rejects malformed money and calendar rollovers and produces API-compatible payloads', () => {
  const draft = { amount: '12.50', description: ' Lunch ', category: ' food ', type: 'expense', paymentMethod: 'cash', date: '2026-10-23' };
  assert.equal(parseTransactionDraft(draft).amount, 12.5);
  assert.equal(parseTransactionDraft(draft).description, 'Lunch');
  for (const amount of ['-10', 'Infinity', '1e3', '12.345', '12abc', '0']) assert.throws(() => parseTransactionDraft({ ...draft, amount }));
  for (const date of ['2026-02-31', '2025-02-29', '2026-13-01', '23-10-2026']) assert.throws(() => parseTransactionDraft({ ...draft, date }));
  assert.equal(parseTransactionDraft({ ...draft, date: '2028-02-29' }).date.slice(0, 10), '2028-02-29');
});
