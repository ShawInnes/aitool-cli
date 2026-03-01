// src/templates/index.ts
//
// Static JSON imports so Bun bundles the template files directly into the
// compiled binary. Filesystem path resolution via import.meta.url fails inside
// `bun build --compile` binaries because the virtual path (e.g. B:\~BUN\...)
// does not exist on disk at runtime.

import claudeCode from './claudeCode.json' with {type: 'json'};
import opencode from './opencode.json' with {type: 'json'};
import crush from './crush.json' with {type: 'json'};

export const TEMPLATES: Record<string, Record<string, unknown>> = {
	'claudeCode.json': claudeCode as Record<string, unknown>,
	'opencode.json': opencode as Record<string, unknown>,
	'crush.json': crush as Record<string, unknown>,
};
