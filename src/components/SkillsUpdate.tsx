import {useEffect} from 'react';
import {Box, Text, useApp} from 'ink';
import {type SkillsUpdateRepoResult} from '../commands/skillsUpdate.js';
import {type SkillLinkResult} from '../commands/skillsInstall.js';

type Props = {
	readonly results: SkillsUpdateRepoResult[];
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

function RepoBlock({result}: {readonly result: SkillsUpdateRepoResult}) {
	return (
		<Box flexDirection="column">
			{result.error ? (
				<StepRow isOk={false} label={`${result.repoName} — ${result.error}`} />
			) : (
				<>
					<StepRow isOk={result.pulled} label={`pulled ${result.repoName}`} />
					{result.pulled ? (
						<StepRow
							isOk={result.hasSkillsDir}
							label={
								result.hasSkillsDir
									? 'found skills/ directory'
									: 'no skills/ directory — nothing linked'
							}
						/>
					) : null}
					{result.links.map(link => (
						<LinkRow key={link.name} link={link} />
					))}
				</>
			)}
		</Box>
	);
}

export default function SkillsUpdate({results}: Props) {
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
			<Text bold>aitool — Skills Update</Text>
			<Box
				flexDirection="column"
				borderStyle="single"
				borderColor="gray"
				paddingX={1}
			>
				{results.length === 0 ? (
					<StepRow
						isOk={false}
						label="no skills repos found in ~/.agent-skills/"
					/>
				) : (
					results.map(r => <RepoBlock key={r.repoName} result={r} />)
				)}
			</Box>
		</Box>
	);
}
