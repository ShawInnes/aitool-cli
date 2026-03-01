// src/commands/agentConfigure.ts
import {readFileSync, existsSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {AGENT_REGISTRY, type Agent} from '../agents/index.js';

export type AgentConfigureOptions = {
	/** Agent id to configure (e.g. "claude-code"). */
	agent: string;
	/** Override the local config file path to diff against. */
	configFile?: string;
};

type DiffLine =
	| {kind: 'same'; key: string; value: unknown}
	| {kind: 'added'; key: string; value: unknown}
	| {kind: 'removed'; key: string; value: unknown}
	| {kind: 'changed'; key: string; templateValue: unknown; localValue: unknown};

/**
 * Recursively flattens a nested object into dot-notation key/value pairs.
 * e.g. { a: { b: 1 } } → { "a.b": 1 }
 */
function flatten(obj: unknown, prefix = ''): Record<string, unknown> {
	if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
		return {[prefix]: obj};
	}

	const result: Record<string, unknown> = {};
	for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
		const fullKey = prefix ? `${prefix}.${key}` : key;
		if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
			Object.assign(result, flatten(val, fullKey));
		} else {
			result[fullKey] = val;
		}
	}

	return result;
}

/**
 * Computes a flat diff between two JSON objects.
 * Keys present only in `template` are "added" (missing from local).
 * Keys present only in `local` are "removed" (extra in local).
 * Keys present in both with different values are "changed".
 */
function diffObjects(
	template: Record<string, unknown>,
	local: Record<string, unknown>,
): DiffLine[] {
	const flat_template = flatten(template);
	const flat_local = flatten(local);

	const allKeys = new Set([
		...Object.keys(flat_template),
		...Object.keys(flat_local),
	]);

	const lines: DiffLine[] = [];

	for (const key of [...allKeys].sort()) {
		const inTemplate = Object.hasOwn(flat_template, key);
		const inLocal = Object.hasOwn(flat_local, key);

		if (inTemplate && inLocal) {
			const tv = flat_template[key];
			const lv = flat_local[key];
			if (JSON.stringify(tv) === JSON.stringify(lv)) {
				lines.push({kind: 'same', key, value: tv});
			} else {
				lines.push({kind: 'changed', key, templateValue: tv, localValue: lv});
			}
		} else if (inTemplate) {
			lines.push({kind: 'added', key, value: flat_template[key]});
		} else {
			lines.push({kind: 'removed', key, value: flat_local[key]});
		}
	}

	return lines;
}

/**
 * Resolves the template JSON for an agent, reading from `src/templates/<templatePath>`.
 * Returns the parsed object or throws with a descriptive message.
 */
function loadTemplate(agent: Agent): Record<string, unknown> {
	if (agent.templateUrl) {
		throw new Error(
			`Agent "${agent.id}" uses a remote templateUrl — only local templatePath is supported for diff.`,
		);
	}

	if (!agent.templatePath) {
		throw new Error(
			`Agent "${agent.id}" has no configured template (templatePath / templateUrl).`,
		);
	}

	// Resolve relative to this file's location: src/commands/ → src/templates/
	const thisDir = dirname(fileURLToPath(import.meta.url));
	const templateFile = resolve(thisDir, '..', 'templates', agent.templatePath);

	if (!existsSync(templateFile)) {
		throw new Error(`Template file not found: ${templateFile}`);
	}

	return JSON.parse(readFileSync(templateFile, 'utf8')) as Record<
		string,
		unknown
	>;
}

/**
 * Resolves the local config file path to diff against.
 * Uses --config-file override when provided; otherwise falls back to the
 * agent's `defaultConfigFilePath()`.
 */
function resolveLocalConfigFile(agent: Agent, configFile?: string): string {
	if (configFile) return configFile;

	const defaultPath = agent.defaultConfigFilePath?.();
	if (!defaultPath) {
		throw new Error(
			`Agent "${agent.id}" has no known default config file location. ` +
				'Use --config-file to specify one.',
		);
	}

	return defaultPath;
}

/**
 * Formats a value for display in a single-line diff entry.
 */
function fmtVal(val: unknown): string {
	if (Array.isArray(val)) return JSON.stringify(val);
	if (typeof val === 'string') return JSON.stringify(val);
	return String(val);
}

/**
 * Runs `agent configure <agent-id>`: loads the agent's template and local
 * config file, diffs them, and prints the result to stdout.
 *
 * Exit codes:
 *   0 — files are identical (or only differ in keys not in the template)
 *   1 — diff has additions or changes (template keys missing/different locally)
 */
export async function runAgentConfigure(
	options: AgentConfigureOptions,
): Promise<void> {
	const {agent: agentId, configFile} = options;

	// Resolve agent from registry
	const agent = AGENT_REGISTRY.find(a => a.id === agentId);
	if (!agent) {
		const valid = AGENT_REGISTRY.map(a => a.id).join(', ');
		console.error(`Unknown agent "${agentId}". Valid options: ${valid}`);
		process.exit(1);
	}

	// Load template
	let template: Record<string, unknown>;
	try {
		template = loadTemplate(agent);
	} catch (err) {
		console.error(`Error: ${(err as Error).message}`);
		process.exit(1);
	}

	// Resolve local config path
	let localPath: string;
	try {
		localPath = resolveLocalConfigFile(agent, configFile);
	} catch (err) {
		console.error(`Error: ${(err as Error).message}`);
		process.exit(1);
	}

	// Load local config
	let local: Record<string, unknown>;
	if (!existsSync(localPath)) {
		console.log(`Local config not found: ${localPath}`);
		console.log(`Template: ${agent.templatePath}`);
		console.log('');
		console.log(
			'No local config to compare against — the file does not exist.',
		);
		process.exit(1);
	}

	try {
		local = JSON.parse(readFileSync(localPath, 'utf8')) as Record<
			string,
			unknown
		>;
	} catch (err) {
		console.error(
			`Failed to parse local config at ${localPath}: ${(err as Error).message}`,
		);
		process.exit(1);
	}

	// Diff
	const diff = diffObjects(template, local);

	const added = diff.filter(l => l.kind === 'added');
	const changed = diff.filter(l => l.kind === 'changed');
	const removed = diff.filter(l => l.kind === 'removed');
	const same = diff.filter(l => l.kind === 'same');

	console.log(`Agent:        ${agent.displayName}`);
	console.log(`Template:     ${agent.templatePath}`);
	console.log(`Local config: ${localPath}`);
	console.log('');

	if (added.length === 0 && changed.length === 0 && removed.length === 0) {
		console.log('No differences — local config matches template.');
		return;
	}

	// Keys in template not present locally (would be applied by configure)
	if (added.length > 0) {
		console.log(`Missing from local config (${added.length}):`);
		for (const line of added) {
			console.log(`  + ${line.key} = ${fmtVal(line.value)}`);
		}

		console.log('');
	}

	// Keys present locally with different values from template
	if (changed.length > 0) {
		console.log(`Different from template (${changed.length}):`);
		for (const line of changed) {
			if (line.kind !== 'changed') continue;
			console.log(`  ~ ${line.key}`);
			console.log(`      template: ${fmtVal(line.templateValue)}`);
			console.log(`      local:    ${fmtVal(line.localValue)}`);
		}

		console.log('');
	}

	// Keys present locally but not in template (informational only)
	if (removed.length > 0) {
		console.log(`Only in local config (${removed.length}):`);
		for (const line of removed) {
			console.log(`  - ${line.key} = ${fmtVal(line.value)}`);
		}

		console.log('');
	}

	console.log(
		`Summary: ${same.length} matching, ${added.length} missing, ` +
			`${changed.length} changed, ${removed.length} local-only`,
	);

	// Non-zero exit when template keys are missing or different locally
	if (added.length > 0 || changed.length > 0) {
		process.exit(1);
	}
}
