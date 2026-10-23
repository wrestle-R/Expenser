import { readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const files = readdirSync(new URL('../lib/', import.meta.url)).filter((file) => file.endsWith('.test.mjs')).map((file) => `lib/${file}`);
const child = spawn(process.execPath, ['--test', ...files], { cwd: root, stdio: 'inherit' });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
