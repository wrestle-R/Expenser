import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNotificationLocally } from './local-bank-parser.js';
test('parser preserves money and identity through notification wrapping, whitespace and Unicode formatting', () => {
  for (let i = 1; i <= 100; i++) {
    const amount = (i * 17.13).toFixed(2);
    const message = `Rs ${amount} debited from A/c XX1234 on 23-10-2026. Ref No SYNTH${String(i).padStart(8, '0')}. Avl Bal Rs 99,999.00`;
    const envelope = { message, sender: 'VM-HDFCBK', capturedAt: '2026-10-23T12:00:00Z', sourceKey: `synthetic-${i}`, sourcePackage: 'synthetic.sms' };
    const original = parseNotificationLocally(envelope);
    assert.equal(original?.parsed.amount, Number(amount));
    for (const mutated of [message.replaceAll(' ', '\n'), message.replaceAll(' ', '\u00a0'), `\u200b${message}\u200b`]) {
      const result = parseNotificationLocally({ ...envelope, message: mutated });
      assert.equal(result?.parsed.amount, Number(amount));
      assert.equal(result.importSourceKey, original.importSourceKey);
    }
  }
});
