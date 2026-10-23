import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
const defaults = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url))).build.preview.env;
const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['expo', ...process.argv.slice(2)], {
  stdio: 'inherit', env: { ...defaults, ...process.env },
});
child.on('exit', (code) => { process.exitCode = code ?? 1; });
