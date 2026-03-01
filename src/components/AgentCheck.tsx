// src/components/AgentCheck.tsx
import {useEffect} from 'react';
import {Box, Text, useApp} from 'ink';
import {type AgentCheckSummary} from '../commands/agentCheck.js';

type Props = {
	readonly results: AgentCheckSummary[];
};

function StatusRow({result}: {readonly result: AgentCheckSummary}) {
	const detail = result.version
		? ` (${result.version})`
		: result.path
			? ` (${result.path})`
			: result.error
				? ` — ${result.error}`
				: '';

	return (
		<Box gap={1}>
			<Text color="gray">{result.displayName.padEnd(14)}</Text>
			{result.installed ? (
				<Text color="green">✓ installed</Text>
			) : (
				<Text color="red">✗ not installed</Text>
			)}
			{detail ? <Text color="gray">{detail}</Text> : null}
		</Box>
	);
}

export default function AgentCheck({results}: Props) {
	const {exit} = useApp();

	useEffect(() => {
		const timer = setTimeout(() => {
			exit();
		}, 100);
		return () => {
			clearTimeout(timer);
		};
	}, [exit]);

	return (
		<Box flexDirection="column" gap={1}>
			<Text bold>aitool — Agent Check</Text>
			<Box
				flexDirection="column"
				borderStyle="single"
				borderColor="gray"
				paddingX={1}
			>
				{results.map(r => (
					<StatusRow key={r.id} result={r} />
				))}
			</Box>
		</Box>
	);
}
