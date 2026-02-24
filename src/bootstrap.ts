/**
 * Bootstrap entry point for compiled binaries.
 *
 * When `bun build --compile` produces a standalone executable, the native
 * Zig library (libopentui.dylib/.so/.dll) is embedded in the binary's virtual
 * filesystem (bunfs). dlopen cannot load from virtual paths, so we extract it
 * to a real temp directory before @opentui/core tries to initialize.
 *
 * In dev mode (bun run src/bootstrap.ts), the lib path is a real filesystem
 * path and isBunfsPath returns false — this file is a no-op passthrough.
 */
import { platform as osPlatform, arch as osArch, tmpdir } from 'os';
import { join, basename } from 'path';
import { mkdirSync, writeFileSync, existsSync } from 'fs';

function isBunfsPath(p: string): boolean {
  return p.includes('$bunfs') || /^B:[\\\/]~BUN/i.test(p);
}

// Import the platform-specific package to discover the native lib path.
// @opentui/core does the same import internally; this one will be cached.
const nativePkg = await import(`@opentui/core-${osPlatform()}-${osArch()}`);
const nativeLibPath: string = nativePkg.default;

if (isBunfsPath(nativeLibPath)) {
  // Running as a compiled binary — extract embedded native lib to real fs.
  const libName = basename(nativeLibPath);
  const destDir = join(tmpdir(), 'aitool-cli');
  const destPath = join(destDir, libName);

  if (!existsSync(destPath)) {
    mkdirSync(destDir, { recursive: true });
    const data = await Bun.file(nativeLibPath).arrayBuffer();
    writeFileSync(destPath, Buffer.from(data));
  }

  // Tell @opentui/core to use the extracted path.
  // setRenderLibPath clears the cached lib so resolveRenderLib() picks up
  // the real path when the renderer is first created.
  const { setRenderLibPath } = await import('@opentui/core');
  setRenderLibPath(destPath);
}

await import('./index.ts');
