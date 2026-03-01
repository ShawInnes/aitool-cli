// src/commands/agentConfigure.ts
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import * as jsondiffpatch from 'jsondiffpatch';
import {type Delta} from 'jsondiffpatch';
import {AGENT_REGISTRY, type Agent} from '../agents/index.js';

export type AgentConfigureOptions = {
	/** Agent id to configure (e.g. "claude-code"). */
	agent: string;
	/** Override the local config file path to diff against. */
	configFile?: string;
};

/** A single nested diff node — mirrors the jsondiffpatch delta shape for display. */
export type DiffNode =
	| {kind: 'added'; value: unknown}
	| {kind: 'removed'; value: unknown}
	| {kind: 'changed'; templateValue: unknown; localValue: unknown}
	| {kind: 'object'; children: Record<string, DiffNode>}
	| {kind: 'array'; items: DiffNode[]};

export type AgentConfigureResult = {
	agent: {id: string; displayName: string};
	templatePath: string;
	localConfigPath: string;
	/** undefined when files are identical */
	diff: Record<string, DiffNode> | undefined;
	/** Counts for the summary line */
	counts: {added: number; changed: number; removed: number};
	/**
	 * Raw jsondiffpatch delta — passed to applyPatch() to write changes.
	 * undefined when files are identical.
	 */
	rawDelta: Delta | undefined;
};

/** Recursively parse a jsondiffpatch delta into our display-friendly DiffNode tree. */
export function parseDelta(delta: unknown): DiffNode | undefined {
	if (delta === null || delta === undefined) return undefined;

	// Array-encoded leaf nodes
	if (Array.isArray(delta)) {
		if (delta.length === 1) {
			// [newValue] — key was added (present in template, absent in local)
			return {kind: 'added', value: delta[0]};
		}

		if (delta.length === 2) {
			// [oldValue, newValue] — value changed
			return {kind: 'changed', templateValue: delta[0], localValue: delta[1]};
		}

		if (delta.length === 3 && delta[1] === 0 && delta[2] === 0) {
			// [oldValue, 0, 0] — key was removed (present in local, absent in template)
			return {kind: 'removed', value: delta[0]};
		}

		// Fallback: treat as opaque changed value
		return {kind: 'changed', templateValue: delta[0], localValue: delta[1]};
	}

	// Object node — recurse into children, skipping jsondiffpatch internal markers
	if (typeof delta === 'object') {
		const obj = delta as Record<string, unknown>;

		// Array diff: _t === 'a' means this is an array diff node
		if (obj['_t'] === 'a') {
			const items: DiffNode[] = [];
			for (const [key, val] of Object.entries(obj)) {
				if (key === '_t') continue;
				const child = parseDelta(val);
				if (child) items.push(child);
			}

			return {kind: 'array', items};
		}

		// Plain object diff
		const children: Record<string, DiffNode> = {};
		for (const [key, val] of Object.entries(obj)) {
			const child = parseDelta(val);
			if (child) children[key] = child;
		}

		if (Object.keys(children).length === 0) return undefined;
		return {kind: 'object', children};
	}

	return undefined;
}

/** Count leaf-level changes recursively. */
export function countChanges(node: DiffNode): {
	added: number;
	changed: number;
	removed: number;
} {
	if (node.kind === 'added') return {added: 1, changed: 0, removed: 0};
	if (node.kind === 'removed') return {added: 0, changed: 0, removed: 1};
	if (node.kind === 'changed') return {added: 0, changed: 1, removed: 0};

	let added = 0;
	let changed = 0;
	let removed = 0;

	const children =
		node.kind === 'object' ? Object.values(node.children) : node.items;

	for (const child of children) {
		const c = countChanges(child);
		added += c.added;
		changed += c.changed;
		removed += c.removed;
	}

	return {added, changed, removed};
}

/** Load and parse the template JSON for an agent. */
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

/** Resolve the local config file path, using override or agent default. */
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
 * Runs `agent configure <agent-id>`: diffs the agent's template against the
 * local config file using jsondiffpatch and returns a structured result for
 * rendering. Exits the process on hard errors (unknown agent, missing files).
 *
 * Future: pass the returned delta to jsondiffpatch.patch() to apply changes.
 */
export async function runAgentConfigure(
	options: AgentConfigureOptions,
): Promise<AgentConfigureResult> {
	const {agent: agentId, configFile} = options;

	const agent = AGENT_REGISTRY.find(a => a.id === agentId);
	if (!agent) {
		const valid = AGENT_REGISTRY.map(a => a.id).join(', ');
		console.error(`Unknown agent "${agentId}". Valid options: ${valid}`);
		process.exit(1);
	}

	let template: Record<string, unknown>;
	try {
		template = loadTemplate(agent);
	} catch (err) {
		console.error(`Error: ${(err as Error).message}`);
		process.exit(1);
	}

	let localPath: string;
	try {
		localPath = resolveLocalConfigFile(agent, configFile);
	} catch (err) {
		console.error(`Error: ${(err as Error).message}`);
		process.exit(1);
	}

	if (!existsSync(localPath)) {
		console.error(`Local config not found: ${localPath}`);
		console.error('Use --config-file to specify an alternative path.');
		process.exit(1);
	}

	let local: Record<string, unknown>;
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

	// Diff: template is "left" (desired), local is "right" (current)
	// No text diff plugin — structural diffs only
	const instance = jsondiffpatch.create({});

	const rawDelta = instance.diff(template, local);

	if (!rawDelta) {
		return {
			agent: {id: agent.id, displayName: agent.displayName},
			templatePath: agent.templatePath!,
			localConfigPath: localPath,
			diff: undefined,
			counts: {added: 0, changed: 0, removed: 0},
			rawDelta: undefined,
		};
	}

	const root = parseDelta(rawDelta);
	const diff = root?.kind === 'object' ? root.children : undefined;

	const counts = diff
		? Object.values(diff).reduce(
				(acc, node) => {
					const c = countChanges(node);
					return {
						added: acc.added + c.added,
						changed: acc.changed + c.changed,
						removed: acc.removed + c.removed,
					};
				},
				{added: 0, changed: 0, removed: 0},
			)
		: {added: 0, changed: 0, removed: 0};

	return {
		agent: {id: agent.id, displayName: agent.displayName},
		templatePath: agent.templatePath!,
		localConfigPath: localPath,
		diff,
		counts,
		rawDelta,
	};
}

/**
 * Applies a jsondiffpatch delta to the local config file, writing the result
 * back to disk. The delta produced by diff(template, local) brings `local`
 * toward `template` — i.e. missing/changed keys are updated to match the
 * template values.
 *
 * Note: jsondiffpatch.patch() mutates the object in-place, so we deep-clone
 * the parsed local config before patching to avoid side effects.
 */
export function applyPatch(localConfigPath: string, rawDelta: Delta): void {
	const local = JSON.parse(readFileSync(localConfigPath, 'utf8')) as Record<
		string,
		unknown
	>;
	// patch() mutates in-place; clone first so the original parsed value is untouched
	const patched = structuredClone(local);
	jsondiffpatch.patch(patched, rawDelta);
	writeFileSync(
		localConfigPath,
		JSON.stringify(patched, null, 2) + '\n',
		'utf8',
	);
}
