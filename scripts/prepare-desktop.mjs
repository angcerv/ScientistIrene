import { cpSync, existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = join(root, 'src-tauri', 'desktop-runtime');
const stage = mkdtempSync(join(root, 'src-tauri', '.desktop-stage-'));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

try {
  for (const name of ['package.json', 'package-lock.json', 'server', 'dist']) {
    cpSync(join(root, name), join(stage, name), { recursive: true });
  }
  // A private build can carry the first-run profile without bundling the local database or PDF.
  const seed = join('data', 'Perfil-Irene.json');
  if (existsSync(join(root, seed))) {
    mkdirSync(join(stage, 'data'));
    cpSync(join(root, seed), join(stage, seed));
  }
  const result = spawnSync(npm, ['ci', '--omit=dev', '--no-audit', '--no-fund'], {
    cwd: stage, stdio: 'inherit', shell: process.platform === 'win32',
  });
  if (result.status !== 0) throw result.error || new Error('No se pudieron preparar las dependencias de escritorio.');
  const license = await fetch('https://raw.githubusercontent.com/nodejs/node/' + process.version + '/LICENSE', {
    signal: AbortSignal.timeout(15000),
  });
  if (!license.ok) throw new Error('No se pudo obtener la licencia de Node.js.');
  mkdirSync(join(stage, 'bin'));
  cpSync(process.execPath, join(stage, 'bin', process.platform === 'win32' ? 'node.exe' : 'node'));
  writeFileSync(join(stage, 'NODE-LICENSE.txt'), await license.text());
  rmSync(output, { recursive: true, force: true });
  renameSync(stage, output);
} finally {
  rmSync(stage, { recursive: true, force: true });
}
