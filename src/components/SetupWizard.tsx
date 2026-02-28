import React, {useState, useEffect} from 'react';
import {Box, Text, useInput} from 'ink';
import {runSetupCli, resetConfig} from '../commands/setup.js';

type Step = 'resetting' | 'input' | 'fetching' | 'success' | 'error';

type Props = {
	configDir?: string;
	onComplete?: () => void;
	reset?: boolean;
};

export default function SetupWizard({configDir, onComplete, reset}: Props) {
	const [step, setStep] = useState<Step>(reset ? 'resetting' : 'input');
	const [inputUrl, setInputUrl] = useState('');
	const [errorMessage, setErrorMessage] = useState('');

	useEffect(() => {
		if (!reset) return;
		resetConfig(configDir)
			.then(() => {
				setStep('input');
			})
			.catch((error: unknown) => {
				setErrorMessage(error instanceof Error ? error.message : String(error));
				setStep('error');
			});
	}, []);

	useInput((input, key) => {
		if (step === 'input') {
			if (key.return) {
				void runSetup(inputUrl.trim());
			} else if (key.backspace || key.delete) {
				setInputUrl((prev) => prev.slice(0, -1));
			} else if (input) {
				setInputUrl((prev) => prev + input);
			}
		} else if (step === 'error' && key.return) {
			setStep('input');
			setErrorMessage('');
		}
	});

	async function runSetup(url: string) {
		if (!url) return;
		setStep('fetching');
		try {
			await runSetupCli(url, configDir);
			setStep('success');
			onComplete?.();
		} catch (err) {
			setErrorMessage(err instanceof Error ? err.message : String(err));
			setStep('error');
		}
	}

	if (step === 'resetting') {
		return (
			<Box flexDirection="column" gap={1}>
				<Text bold>aitool — First-Run Setup</Text>
				<Text color="yellow">Resetting config...</Text>
			</Box>
		);
	}

	if (step === 'input') {
		return (
			<Box flexDirection="column" gap={1}>
				<Text bold>aitool — First-Run Setup</Text>
				<Text>Enter your corporate config URL:</Text>
				<Box>
					<Text color="cyan">{'> '}</Text>
					<Text>{inputUrl}</Text>
					<Text color="gray">{'█'}</Text>
				</Box>
				<Text color="gray">Press Enter to continue</Text>
			</Box>
		);
	}

	if (step === 'fetching') {
		return (
			<Box flexDirection="column" gap={1}>
				<Text bold>aitool — First-Run Setup</Text>
				<Text color="yellow">⠋ Fetching configuration…</Text>
			</Box>
		);
	}

	if (step === 'success') {
		return (
			<Box flexDirection="column" gap={1}>
				<Text bold>aitool — First-Run Setup</Text>
				<Text color="green">✓ Setup complete! Configuration saved.</Text>
				<Text color="gray">Run `aitool login` to authenticate.</Text>
			</Box>
		);
	}

	// error
	return (
		<Box flexDirection="column" gap={1}>
			<Text bold>aitool — First-Run Setup</Text>
			<Text color="red">✗ Setup failed:</Text>
			<Text color="red">{errorMessage}</Text>
			<Text color="gray">Press Enter to try again.</Text>
		</Box>
	);
}
