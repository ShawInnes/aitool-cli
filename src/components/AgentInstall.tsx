// src/components/AgentInstall.tsx
import {useEffect} from 'react';
import {Box, Text, useApp} from 'ink';
import {type AgentInstallResult} from '../commands/agentInstall.js';

type Props = {
	readonly result: AgentInstallResult;
};

const LABEL_WIDTH = 8;

function CmdRow({
	label,
	command,
}: {
	readonly label: string;
	readonly command: string;
}) {
	return (
		<Box gap={1}>
			<Text color="gray">{label.padEnd(LABEL_WIDTH)}</Text>
			<Text color="yellow">{command}</Text>
		</Box>
	);
}

export default function AgentInstall({result}: Props) {
	const {exit} = useApp();
	const {displayName, installUrl, installCommands, url} = result;

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
			<Box gap={1}>
				<Text color="gray">agent</Text>
				<Text bold>{displayName}</Text>
			</Box>

			<Box
				flexDirection="column"
				borderStyle="single"
				borderColor="gray"
				paddingX={1}
			>
				{installUrl ? (
					<Box gap={1}>
						<Text color="gray">{'docs'.padEnd(LABEL_WIDTH)}</Text>
						<Text color="cyan">{installUrl}</Text>
					</Box>
				) : (
					<Box gap={1}>
						<Text color="gray">{'website'.padEnd(LABEL_WIDTH)}</Text>
						<Text color="cyan">{url}</Text>
					</Box>
				)}

				{installCommands && (
					<Box flexDirection="column" marginTop={1}>
						{installCommands.mac && (
							<CmdRow label="macOS" command={installCommands.mac} />
						)}
						{installCommands.linux && (
							<CmdRow label="Linux" command={installCommands.linux} />
						)}
						{installCommands.windows && (
							<CmdRow label="Windows" command={installCommands.windows} />
						)}
					</Box>
				)}
			</Box>
		</Box>
	);
}
