// Src/components/AgentConfigure.tsx
import {useCallback, useState} from 'react';
import {Box, Text, useApp} from 'ink';
import {Badge, StatusMessage} from '@inkjs/ui';
import {
	type AgentConfigureResult,
	type DiffNode,
} from '../commands/agentConfigure.js';
import ConfirmSelector from './ConfirmSelector.js';

type Props = {
	readonly result: AgentConfigureResult;
	readonly onPatch: () => void;
};

/** Truncate a JSON value to a readable single-line string. */
function fmtValue(value: unknown): string {
	const raw = JSON.stringify(value);
	if (raw === undefined) return 'undefined';
	return raw.length > 80 ? raw.slice(0, 77) + '...' : raw;
}

/** Recursively render a DiffNode tree with indentation. */
function DiffTree({
	nodes,
	depth = 0,
}: {
	readonly nodes: Record<string, DiffNode>;
	readonly depth?: number;
}) {
	const indent = '  '.repeat(depth);

	return (
		<Box flexDirection="column">
			{Object.entries(nodes).map(([key, node]) => (
				<DiffEntry
					key={key}
					entryKey={key}
					node={node}
					indent={indent}
					depth={depth}
				/>
			))}
		</Box>
	);
}

function DiffEntry({
	entryKey,
	node,
	indent,
	depth,
}: {
	readonly entryKey: string;
	readonly node: DiffNode;
	readonly indent: string;
	readonly depth: number;
}) {
	if (node.kind === 'added') {
		return (
			<Box>
				<Text color="green">{indent}+ </Text>
				<Text bold color="green">
					{entryKey}
				</Text>
				<Text color="gray"> = </Text>
				<Text color="green">{fmtValue(node.value)}</Text>
			</Box>
		);
	}

	if (node.kind === 'removed') {
		return (
			<Box>
				<Text color="red">{indent}- </Text>
				<Text bold color="red">
					{entryKey}
				</Text>
				<Text color="gray"> = </Text>
				<Text color="red">{fmtValue(node.value)}</Text>
			</Box>
		);
	}

	if (node.kind === 'changed') {
		return (
			<Box flexDirection="column">
				<Box>
					<Text color="yellow">{indent}~ </Text>
					<Text bold color="yellow">
						{entryKey}
					</Text>
				</Box>
				<Box>
					<Text color="gray">{indent} template </Text>
					<Text color="red">{fmtValue(node.templateValue)}</Text>
				</Box>
				<Box>
					<Text color="gray">{indent} local </Text>
					<Text color="green">{fmtValue(node.localValue)}</Text>
				</Box>
			</Box>
		);
	}

	if (node.kind === 'object') {
		return (
			<Box flexDirection="column">
				<Box>
					<Text color="cyan">{indent} </Text>
					<Text bold color="cyan">
						{entryKey}
					</Text>
					<Text color="gray"> {'{'}</Text>
				</Box>
				<DiffTree nodes={node.children} depth={depth + 1} />
				<Text color="gray">
					{indent} {'}'}
				</Text>
			</Box>
		);
	}

	if (node.kind === 'array') {
		return (
			<Box flexDirection="column">
				<Box>
					<Text color="cyan">{indent} </Text>
					<Text bold color="cyan">
						{entryKey}
					</Text>
					<Text color="gray"> [</Text>
				</Box>
				{node.items.map((item, i) => (
					<DiffEntry
						// eslint-disable-next-line react/no-array-index-key
						key={`array-item-${i}`}
						entryKey={String(i)}
						node={item}
						indent={indent + '  '}
						depth={depth + 1}
					/>
				))}
				<Text color="gray">{indent} ]</Text>
			</Box>
		);
	}

	return null;
}

function SummaryBadge({
	label,
	count,
	color,
}: {
	readonly label: string;
	readonly count: number;
	readonly color: 'green' | 'red' | 'yellow' | 'blue';
}) {
	if (count === 0) return null;
	return (
		<Box gap={1}>
			<Badge color={color}>{String(count)}</Badge>
			<Text>{label}</Text>
		</Box>
	);
}

export default function AgentConfigure({result, onPatch}: Props) {
	const {exit} = useApp();
	const {agent, templatePath, localConfigPath, diff, counts} = result;
	const hasDiff = diff !== undefined;

	type PatchState = 'idle' | 'confirming' | 'patched' | 'cancelled';
	const [patchState, setPatchState] = useState<PatchState>(
		hasDiff ? 'confirming' : 'idle',
	);

	const handleConfirm = useCallback(() => {
		onPatch();
		setPatchState('patched');
		exit();
	}, [onPatch, exit]);

	const handleCancel = useCallback(() => {
		setPatchState('cancelled');
		exit();
	}, [exit]);

	return (
		<Box flexDirection="column" gap={1}>
			{/* Header */}
			<Box flexDirection="column">
				<Box gap={1}>
					<Text color="gray">agent</Text>
					<Text bold>{agent.displayName}</Text>
				</Box>
				<Box gap={1}>
					<Text color="gray">template</Text>
					<Text>{templatePath}</Text>
				</Box>
				<Box gap={1}>
					<Text color="gray">local</Text>
					<Text>{localConfigPath}</Text>
				</Box>
			</Box>

			{/* Diff tree or match message */}
			{hasDiff ? (
				<Box
					flexDirection="column"
					borderStyle="single"
					borderColor="gray"
					paddingX={1}
				>
					<DiffTree nodes={diff} depth={0} />
				</Box>
			) : (
				<Box gap={1}>
					<Text color="green">✓</Text>
					<Text>Local config matches template</Text>
				</Box>
			)}

			{/* Summary badges */}
			{hasDiff ? (
				<Box gap={2}>
					<SummaryBadge label="missing" count={counts.added} color="green" />
					<SummaryBadge label="changed" count={counts.changed} color="yellow" />
					<SummaryBadge label="local-only" count={counts.removed} color="red" />
				</Box>
			) : null}

			{/* Confirm prompt / result */}
			{patchState === 'confirming' && (
				<Box flexDirection="column" gap={1}>
					<Text>Apply template changes to local config?</Text>
					<ConfirmSelector onConfirm={handleConfirm} onCancel={handleCancel} />
				</Box>
			)}

			{patchState === 'patched' && (
				<StatusMessage variant="success">
					{`Patched ${localConfigPath}`}
				</StatusMessage>
			)}

			{patchState === 'cancelled' && (
				<StatusMessage variant="info">No changes applied.</StatusMessage>
			)}
		</Box>
	);
}
