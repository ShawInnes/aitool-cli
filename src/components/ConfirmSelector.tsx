// src/components/ConfirmSelector.tsx
import {Box, Text, useInput} from 'ink';
import {useState} from 'react';

type Props = {
	onConfirm: () => void;
	onCancel: () => void;
};

/**
 * Arrow-key Yes / No selector. Navigate with ↑↓, confirm with Enter, cancel
 * with Esc. Defaults the cursor to "No" to avoid accidental destructive actions.
 */
export default function ConfirmSelector({onConfirm, onCancel}: Props) {
	// 0 = Yes, 1 = No — default to No (safer)
	const [cursor, setCursor] = useState(1);

	useInput((_input, key) => {
		if (key.upArrow || key.downArrow) {
			setCursor(c => (c === 0 ? 1 : 0));
		} else if (key.return) {
			if (cursor === 0) {
				onConfirm();
			} else {
				onCancel();
			}
		} else if (key.escape) {
			onCancel();
		}
	});

	const options = ['Yes', 'No'] as const;

	return (
		<Box flexDirection="column">
			{options.map((label, i) => (
				<Box key={label}>
					<Text color={i === cursor ? 'cyan' : undefined}>
						{i === cursor ? '> ' : '  '}
						{label}
					</Text>
				</Box>
			))}
			<Text color="gray">↑↓ navigate · enter select · esc cancel</Text>
		</Box>
	);
}
