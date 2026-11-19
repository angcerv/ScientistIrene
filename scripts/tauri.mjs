import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const [command, ...options] = process.argv.slice(2);
const args = command === 'dev' ? [command, '--no-watch', '--no-dev-server', ...options] : process.argv.slice(2);
const env = { ...process.env };
const xcode = '/Applications/Xcode.app/Contents/Developer';
if (process.platform === 'darwin' && !env.DEVELOPER_DIR && existsSync(xcode)) env.DEVELOPER_DIR = xcode;

const child = spawn(process.execPath, [require.resolve('@tauri-apps/cli/tauri.js'), ...args], {
  env, stdio: 'inherit',
});
child.on('error', error => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on('exit', (status, signal) => {
  process.exitCode = status ?? (signal === 'SIGINT' ? 130 : 1);
});
