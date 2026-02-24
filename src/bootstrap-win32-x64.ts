import nativeLib from '@opentui/core-win32-x64';
import { setupNativeLib } from './bootstrap-native.ts';
await setupNativeLib(nativeLib);
await import('./index.ts');
