import {useEffect} from 'react';
import {Box, Text, useApp} from 'ink';
import {
	type SkillsInstallResult,
	type SkillLinkResult,
} from '../commands/skillsInstall.js';

type Props = {
	readonly result: SkillsInstallResult;
};

function StepRow({
	isOk,
	isWarn,
	label,
}: {
	readonly isOk: boolean;
	readonly isWarn?: boolean;
	readonly label: string;
}) {
	const icon = isWarn ? '⚠' : isOk ? '✓' : '✗';
	const color = isWarn ? 'yellow' : isOk ? 'green' : 'red';
	return (
		<Box gap={1}>
			<Text color={color}>{icon}</Text>
			<Text>{label}</Text>
		</Box>
	);
}

function LinkRow({link}: {readonly link: SkillLinkResult}) {
	const skipped = link.status === 'skipped';
	return (
		<StepRow
			isOk={!skipped}
			isWarn={skipped}
			label={
				skipped
					? `skipped: ${link.name} (${link.reason})`
					: `linked: ${link.name}`
			}
		/>
	);
}

function LinkGroup({
	label,
	links,
}: {
	readonly label: string;
	readonly links: SkillLinkResult[];
}) {
	return (
		<Box flexDirection="column">
			<Text color="gray">{label}</Text>
			{links.map(link => (
				<LinkRow key={link.name} link={link} />
			))}
		</Box>
	);
}

export default function SkillsInstall({result}: Props) {
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
			<Text bold>aitool — Skills Install</Text>
			<Box
				flexDirection="column"
				borderStyle="single"
				borderColor="gray"
				paddingX={1}
			>
				{result.error ? (
					<StepRow isOk={false} label={result.error} />
				) : (
					<>
						<StepRow isOk={result.cloned} label={`cloned ${result.repoName}`} />
						{result.cloned ? (
							<>
								<StepRow
									isOk={result.hasSkillsDir}
									label={
										result.hasSkillsDir
											? 'found skills/ directory'
											: 'no skills/ directory — nothing linked'
									}
								/>
								{result.hasSkillsDir ? (
									<>
										<LinkGroup label="~/.claude/skills/" links={result.links} />
										<LinkGroup
											label="~/.agents/skills/"
											links={result.agentLinks}
										/>
									</>
								) : null}
							</>
						) : null}
					</>
				)}
			</Box>
		</Box>
	);
}
