// src/components/AgentInstall.tsx
import {Box, Text} from 'ink';
import {type AgentInstallResult} from '../commands/agentInstall.js';

type Props = {
	readonly result: AgentInstallResult;
};

export default function AgentInstall({result}: Props) {
	const {displayName, installUrl, url} = result;

	return (
		<Box flexDirection="column" gap={1}>
			<Box gap={1}>
				<Text color="gray">agent</Text>
				<Text bold>{displayName}</Text>
			</Box>

			{installUrl ? (
				<Box
					flexDirection="column"
					borderStyle="single"
					borderColor="gray"
					paddingX={1}
				>
					<Box gap={1}>
						<Text color="gray">install</Text>
						<Text color="cyan">{installUrl}</Text>
					</Box>
					<Box gap={1}>
						<Text color="gray">website</Text>
						<Text>{url}</Text>
					</Box>
				</Box>
			) : (
				<Box gap={1}>
					<Text color="yellow">⚠</Text>
					<Text>No install page registered. See the website:</Text>
					<Text color="cyan">{url}</Text>
				</Box>
			)}
		</Box>
	);
}
