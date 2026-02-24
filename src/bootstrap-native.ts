/**
 * Shared native-lib extraction logic for compiled binaries.
 *
 * When `bun build --compile` embeds a native .dylib/.so/.dll into the binary's
 * virtual filesystem (bunfs), dlopen cannot load it from a virtual path.
 * This helper extracts it to a real temp directory so @opentui/core can load it.
 *
 * In dev mode (real filesystem paths) this is a no-op.
 */
import { tmpdir } from 'os';
import { join, basename } from 'path';
import { mkdirSync, writeFileSync, existsSync } from 'fs';

function isBunfsPath(p: string): boolean {
  return p.includes('$bunfs') || /^B:[\\\/]~BUN/i.test(p);
}

export async function setupNativeLib(nativeLibPath: string): Promise<void> {
  if (!isBunfsPath(nativeLibPath)) return;

  const libName = basename(nativeLibPath);
  const destDir = join(tmpdir(), 'aitool-cli');
  const destPath = join(destDir, libName);

  if (!existsSync(destPath)) {
    mkdirSync(destDir, { recursive: true });
    // Normalize to forward slashes — Bun.file() may not handle Windows
    // backslash bunfs paths (e.g. B:\~BUN\root\...) reliably.
    const normalizedPath = nativeLibPath.replace(/\\/g, '/');
    const data = await Bun.file(normalizedPath).arrayBuffer();
    if (data.byteLength === 0) {
      throw new Error(`Native lib extraction returned empty buffer from: ${nativeLibPath}`);
    }
    writeFileSync(destPath, Buffer.from(data));
  }

  const { setRenderLibPath } = await import('@opentui/core');
  setRenderLibPath(destPath);
}