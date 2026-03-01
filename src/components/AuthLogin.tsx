import {useEffect, useRef, useState} from 'react';
import {Box, Text, useApp, useInput} from 'ink';
import {
	type DeviceAuthStart,
	type AuthLoginResult,
	openBrowser,
	pollForToken,
	startDeviceAuth,
} from '../commands/auth.js';

type Step = 'init' | 'code_ready' | 'success' | 'error';

type Props = {
	readonly configDir?: string;
	readonly onComplete?: (result: AuthLoginResult) => void;
};

export default function AuthLogin({configDir, onComplete}: Props) {
	const {exit} = useApp();
	const [step, setStep] = useState<Step>('init');
	const [deviceAuth, setDeviceAuth] = useState<DeviceAuthStart | undefined>(
		undefined,
	);
	const [secondsLeft, setSecondsLeft] = useState(0);
	const [errorMessage, setErrorMessage] = useState('');
	const pollingRef = useRef(false);

	useInput((_input, key) => {
		if (step === 'error' && key.return) {
			setStep('init');
			setErrorMessage('');
			pollingRef.current = false;
		}
	});

	useEffect(() => {
		if (step !== 'init') return;
		void (async () => {
			try {
				const auth = await startDeviceAuth(configDir);
				openBrowser(auth.verificationUriComplete ?? auth.verificationUri);
				setDeviceAuth(auth);
				setSecondsLeft(auth.expiresIn);
				setStep('code_ready');
			} catch (error) {
				setErrorMessage(error instanceof Error ? error.message : String(error));
				setStep('error');
			}
		})();
	}, [step, configDir]);

	useEffect(() => {
		if (step !== 'code_ready' || !deviceAuth || pollingRef.current) return;
		pollingRef.current = true;

		void (async () => {
			try {
				const result = await pollForToken(deviceAuth, configDir);
				setStep('success');
				onComplete?.(result);
				setTimeout(() => {
					exit();
				}, 1000);
			} catch (error) {
				setErrorMessage(error instanceof Error ? error.message : String(error));
				setStep('error');
			}
		})();
	}, [step, deviceAuth, configDir, exit, onComplete]);

	useEffect(() => {
		if (step !== 'code_ready') return;
		if (secondsLeft <= 0) return;
		const timer = setTimeout(() => {
			setSecondsLeft(s => s - 1);
		}, 1000);
		return () => {
			clearTimeout(timer);
		};
	}, [step, secondsLeft]);

	if (step === 'init') {
		return (
			<Box flexDirection="column" gap={1}>
				<Text bold>aitool — Login</Text>
				<Text color="yellow">⠋ Starting device authorization…</Text>
			</Box>
		);
	}

	if (step === 'code_ready' && deviceAuth) {
		const minutes = Math.floor(secondsLeft / 60);
		const seconds = secondsLeft % 60;
		const countdown = `${String(minutes).padStart(2, '0')}:${String(
			seconds,
		).padStart(2, '0')}`;

		return (
			<Box flexDirection="column" gap={1}>
				<Text bold>aitool — Login</Text>
				<Text>Open the following URL in your browser to authenticate:</Text>
				<Text color="cyan">{deviceAuth.verificationUriComplete}</Text>
				<Box gap={1}>
					<Text>Enter code:</Text>
					<Text bold color="yellow">
						{deviceAuth.userCode}
					</Text>
				</Box>
				<Text color="gray">
					Waiting for authentication… {countdown} remaining
				</Text>
			</Box>
		);
	}

	if (step === 'success') {
		return (
			<Box flexDirection="column" gap={1}>
				<Text bold>aitool — Login</Text>
				<Text color="green">
					✓ Authentication successful. Credentials saved.
				</Text>
			</Box>
		);
	}

	// Error
	return (
		<Box flexDirection="column" gap={1}>
			<Text bold>aitool — Login</Text>
			<Text color="red">✗ Login failed:</Text>
			<Text color="red">{errorMessage}</Text>
			<Text color="gray">Press Enter to try again.</Text>
		</Box>
	);
}
