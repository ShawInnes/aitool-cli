import nativeLib from '@opentui/core-win32-x64';
import { setupNativeLib } from './bootstrap-native.ts';
import { join } from 'path';
import { appendFileSync } from 'fs';
import { homedir } from 'os';

const logPath = join(homedir(), 'aitool-error.log');

try {
  await setupNativeLib(nativeLib);
  await import('./index.ts');
} catch (err) {
  const msg = `[${new Date().toISOString()}]\n${err}\n${err instanceof Error ? err.stack ?? '' : ''}\n\n`;
  try { appendFileSync(logPath, msg); } catch {}
  process.stderr.write(`\nFatal error: ${err}\n\nSee ${logPath} for details.\n`);
  // Keep the window open so users launching from Explorer can read the error.
  await new Promise(r => setTimeout(r, 15_000));
  process.exit(1);
}
