import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const require = createRequire(import.meta.url), ts = require('typescript');
function load(value) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL('./supabase.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  runInNewContext(source, { exports, URL, Promise, JSON, setTimeout, clearTimeout, AbortController,
    require: (name) => {
      if (name === 'react-native-url-polyfill/auto') return {};
      if (name === '@react-native-async-storage/async-storage') return { default: { getItem: async () => value } };
      if (name === 'react-native') return { Platform: { OS: 'web' }, AppState: { addEventListener() {} } };
      if (name === '../env') return { ENV: { SUPABASE_URL: 'https://synthetic.supabase.co', SUPABASE_ANON_KEY: 'synthetic-public' } };
      if (name === '@supabase/supabase-js') return { createClient: () => ({ auth: { getSession: () => new Promise(() => {}) } }) };
      throw new Error(name);
    },
  });
  return exports.initialSession;
}
test('expired persisted identity opens local storage without waiting for online refresh', async () => {
  const session = { user: { id: 'synthetic-user' }, access_token: 'synthetic-expired', refresh_token: 'synthetic-refresh', expires_at: Math.floor(Date.now() / 1000) - 7 * 86400 };
  assert.equal((await load(JSON.stringify(session))).user.id, session.user.id);
});
test('missing or corrupt persisted identity does not invent a signed-in session', async () => {
  for (const value of [null, '{broken', '{}', '{"user":{"id":"x"}}']) assert.equal(await load(value), null);
});
