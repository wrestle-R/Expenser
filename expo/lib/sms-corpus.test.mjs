import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parseNotificationLocally } from './local-bank-parser.js';
import { buildNotificationImportKey, parseBankNotification } from '../modules/expenser-bank-notifications/parser.js';
const corpus = JSON.parse(readFileSync(new URL('./fixtures/bank-sms.json', import.meta.url)));
for (const group of ['completed transactions', 'unsafe or unresolved alerts']) {
  test(`anonymized bank corpus: ${group}`, () => {
    for (const row of corpus.cases.filter((item) => group === 'completed transactions' ? item.amount : !item.amount)) {
      const envelope = { ...row, capturedAt: corpus.capturedAt, sourceKey: row.id, sourcePackage: 'synthetic.sms' };
      const result = parseNotificationLocally(envelope);
      if (row.outcome) { assert.equal(result?.kind ?? 'unresolved', row.outcome, row.id); continue; }
      assert.equal(result?.kind, 'transaction', row.id);
      assert.equal(result.parsed.amount, row.amount, row.id);
      assert.equal(result.parsed.type, row.type, row.id);
      assert.equal(result.parsed.bankName, row.bank, row.id);
      assert.equal(result.parsed.accountSuffix, '1234', row.id);
      assert.equal(result.importSourceKey, buildNotificationImportKey(parseBankNotification(row.message, envelope).parsed, envelope));
    }
  });
}
test('SMS replay across notification sources, whitespace changes and a cloud retry has one canonical identity', () => {
  const row = corpus.cases[0];
  const first = { ...row, capturedAt: corpus.capturedAt, sourceKey: 'first', sourcePackage: 'com.sms.one' };
  const replay = { ...first, sourceKey: 'repost', sourcePackage: 'com.sms.two', message: `  ${row.message.replaceAll(' ', '  ')} `, capturedAt: '2026-10-25T12:00:00Z' };
  assert.equal(parseNotificationLocally(first).importSourceKey, parseNotificationLocally(replay).importSourceKey);
  const cloud = { ...parseNotificationLocally(first).parsed, confidence: 'medium', payee: 'different display name', occurredAt: replay.capturedAt };
  assert.equal(buildNotificationImportKey(cloud, replay), parseNotificationLocally(first).importSourceKey);
});
