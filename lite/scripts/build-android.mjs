import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
const defaults = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url))).build.preview.env;
const child = spawn('./gradlew', ['assembleRelease', '--max-workers=2', ...process.argv.slice(2)], { cwd: new URL('../android/', import.meta.url), stdio: 'inherit', env: { ...defaults, ...process.env, NODE_ENV: 'production' } });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
