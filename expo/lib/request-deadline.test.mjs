import test from 'node:test';
import assert from 'node:assert/strict';
import { withRequestDeadline } from './request-deadline.js';

test('a stalled refresh or response body cannot hold the sync lock forever', async () => {
  let aborted = false;
  await assert.rejects(withRequestDeadline((signal) => {
    signal.addEventListener('abort', () => { aborted = true; });
    return new Promise(() => {});
  }, 15), /timed out/);
  assert.equal(aborted, true);
  assert.equal(await withRequestDeadline(async () => 'next request', 50), 'next request');
});
