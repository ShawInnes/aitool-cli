import {useEffect, useState} from 'react';
import {Box, Text, useApp} from 'ink';
import {runAuthUserinfo} from '../commands/authUserinfo.js';

// Well-known OIDC claims shown first, in order, with friendly labels
const KNOWN_CLAIMS: Array<{key: string; label: string}> = [
	{key: 'name', label: 'name'},
	{key: 'given_name', label: 'given name'},
	{key: 'family_name', label: 'family name'},
	{key: 'email', label: 'email'},
	{key: 'email_verified', label: 'email verified'},
	{key: 'preferred_username', label: 'username'},
	{key: 'sub', label: 'subject'},
	{key: 'picture', label: 'picture'},
	{key: 'locale', label: 'locale'},
	{key: 'zoneinfo', label: 'timezone'},
	{key: 'updated_at', label: 'updated at'},
];

const KNOWN_KEYS = new Set(KNOWN_CLAIMS.map(c => c.key));

type Step = 'loading' | 'success' | 'error';

type Props = {
	readonly configDir?: string;
};

function ClaimRow({
	label,
	value,
}: {
	readonly label: string;
	readonly value: unknown;
}) {
	const display =
		typeof value === 'boolean' ? (value ? 'yes' : 'no') : String(value);

	return (
		<Box gap={1}>
			<Text color="gray">{label.padEnd(16)}</Text>
			<Text>{display}</Text>
		</Box>
	);
}

export default function AuthUserinfo({configDir}: Props) {
	const {exit} = useApp();
	const [step, setStep] = useState<Step>('loading');
	const [info, setInfo] = useState<Record<string, unknown>>({});
	const [errorMessage, setErrorMessage] = useState('');

	useEffect(() => {
		void (async () => {
			try {
				const result = await runAuthUserinfo(configDir);
				setInfo(result);
				setStep('success');
				setTimeout(() => {
					exit();
				}, 100);
			} catch (error) {
				setErrorMessage(error instanceof Error ? error.message : String(error));
				setStep('error');
				setTimeout(() => {
					exit();
				}, 100);
			}
		})();
	}, [configDir, exit]);

	if (step === 'loading') {
		return (
			<Box flexDirection="column" gap={1}>
				<Text bold>aitool — User Info</Text>
				<Text color="yellow">⠋ Fetching user info…</Text>
			</Box>
		);
	}

	if (step === 'error') {
		return (
			<Box flexDirection="column" gap={1}>
				<Text bold>aitool — User Info</Text>
				<Text color="red">✗ {errorMessage}</Text>
			</Box>
		);
	}

	const knownRows = KNOWN_CLAIMS.filter(({key}) => key in info);
	const extraEntries = Object.entries(info).filter(
		([key]) => !KNOWN_KEYS.has(key),
	);

	return (
		<Box flexDirection="column" gap={1}>
			<Text bold>aitool — User Info</Text>
			<Box flexDirection="column">
				{knownRows.map(({key, label}) => (
					<ClaimRow key={key} label={label} value={info[key]} />
				))}
			</Box>
			{extraEntries.length > 0 && (
				<Box
					flexDirection="column"
					borderStyle="single"
					borderColor="gray"
					paddingX={1}
				>
					{extraEntries.map(([key, value]) => (
						<ClaimRow
							key={key}
							label={key}
							value={typeof value === 'object' ? JSON.stringify(value) : value}
						/>
					))}
				</Box>
			)}
		</Box>
	);
}
