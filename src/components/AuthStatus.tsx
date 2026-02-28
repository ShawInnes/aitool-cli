import React from 'react';
import {Box, Text} from 'ink';
import {
	type AuthStatusResult,
	type TokenStatus,
	formatRelativeTime,
} from '../commands/authStatus.js';

type Props = {
	readonly status: AuthStatusResult;
};

const tokenColors: Record<TokenStatus, string> = {
	valid: 'green',
	expiring_soon: 'yellow',
	expired: 'red',
	unknown: 'gray',
};

const tokenLabels: Record<TokenStatus, string> = {
	valid: '✓ valid',
	expiring_soon: '⚠ expiring soon',
	expired: '✗ expired',
	unknown: '— unknown',
};

function Row({
	label,
	children,
}: {
	readonly label: string;
	readonly children: React.ReactNode;
}) {
	return (
		<Box gap={1}>
			<Text color="gray">{label.padEnd(14)}</Text>
			{children}
		</Box>
	);
}

export default function AuthStatus({status}: Props) {
	return (
		<Box flexDirection="column" gap={1}>
			<Text bold>aitool — Auth Status</Text>

			<Box flexDirection="column">
				<Row label="configured">
					{status.configured ? (
						<Text color="green">✓ yes</Text>
					) : (
						<Text color="red">✗ no — run `aitool setup` to get started</Text>
					)}
				</Row>

				<Row label="authenticated">
					{status.authenticated ? (
						<Text color="green">✓ yes</Text>
					) : (
						<Text color="red">✗ no — run `aitool auth login`</Text>
					)}
				</Row>

				<Row label="token">
					<Text color={tokenColors[status.tokenStatus]}>
						{tokenLabels[status.tokenStatus]}
					</Text>
				</Row>

				{status.expiresAt ? (
					<Row label="expires">
						<Text>{formatRelativeTime(status.expiresAt)}</Text>
						<Text color="gray">({status.expiresAt})</Text>
					</Row>
				) : null}
			</Box>

			{status.configured ? (
				<Box
					flexDirection="column"
					borderStyle="single"
					borderColor="gray"
					paddingX={1}
				>
					{status.issuer ? (
						<Row label="issuer">
							<Text>{status.issuer}</Text>
						</Row>
					) : null}
					{status.clientId ? (
						<Row label="clientId">
							<Text>{status.clientId}</Text>
						</Row>
					) : null}
					{status.scopes ? (
						<Row label="scopes">
							<Text>{status.scopes.join(' ')}</Text>
						</Row>
					) : null}
				</Box>
			) : null}
		</Box>
	);
}
