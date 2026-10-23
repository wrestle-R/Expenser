import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTransactionPage, transactionPageCursor } from './transaction-pagination.js';
test('history cursor roundtrips full timestamp precision and uses bounded page sizes', () => {
  const row = { id: '12345678-1234-1234-1234-123456789012', cursor_date: '2026-10-23 12:00:00.123456+00', cursor_created_at: '2026-10-23 12:00:00.654321+00' };
  const parsed = parseTransactionPage(new URLSearchParams({ limit: '250', cursor: transactionPageCursor(row) }));
  assert.equal(parsed.cursor.date, row.cursor_date);
  assert.equal(parsed.cursor.createdAt, row.cursor_created_at);
  assert.equal(parsed.cursor.id, row.id);
  assert.equal(parseTransactionPage(new URLSearchParams()), null);
  for (const limit of ['-1', '0', '501', '1.5', 'garbage']) assert.throws(() => parseTransactionPage(new URLSearchParams({ limit })));
  for (const cursor of ['!bad', Buffer.from('{}').toString('base64url')]) assert.throws(() => parseTransactionPage(new URLSearchParams({ limit: '250', cursor })));
});
