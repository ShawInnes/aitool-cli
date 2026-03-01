#!/usr/bin/env node
import {render} from 'ink';
import {Command} from 'commander';
// @ts-expect-error json reference
import pkg from '../package.json';
import {selfUpdate} from './update.js';
import {
	type SetupResult,
	runSetupCli,
	runSetupFromEnvironment,
	runSetupFromFile,
} from './commands/setup.js';
import {runConfigGet, runConfigSet, runConfigShow} from './commands/config.js';
import {openBrowser, runAuthLogin, startDeviceAuth} from './commands/auth.js';
import {formatRelativeTime, runAuthStatus} from './commands/authStatus.js';
import {runAuthUserinfo} from './commands/authUserinfo.js';
import {runAuthLogout} from './commands/authLogout.js';
import {warnIfTokenExpiring} from './commands/tokenWarning.js';
import {runAgentCheck} from './commands/agentCheck.js';
import {runAgentConfigure} from './commands/agentConfigure.js';
import {runAgentList} from './commands/agentList.js';
import SetupWizard from './components/SetupWizard.js';
import AuthLogin from './components/AuthLogin.js';
import AuthStatus from './components/AuthStatus.js';
import AuthUserinfo from './components/AuthUserinfo.js';

type GlobalOptions = {
	configDir?: string;
	tui: boolean;
	verbose: boolean;
};

function isTuiMode(globalOptions: GlobalOptions): boolean {
	return globalOptions.tui && process.stdout.isTTY;
}

const program = new Command();

program
	.name('aitool')
	.description('Corporate developer authentication and AI tool configuration')
	.version(pkg.version)
	.option('--config-dir <path>', 'override config directory path')
	.option(
		'--no-tui',
		'non-interactive output (also auto-enabled when stdout is not a TTY)',
	)
	.option('--verbose', 'Debug output')
	.action(() => {
		program.help();
	});

program
	.command('setup')
	.description('Run the first-time setup wizard')
	.option('--config-url <url>', 'fetch config from a remote URL')
	.option('--config-file <path>', 'load config from a local JSON file')
	.option(
		'--auto',
		'load config from AITOOL_AUTH_DISCOVERY and AITOOL_AUTH_CLIENT_ID env vars',
	)
	.option('--reset', 'Delete config and credentials before setup')
	.action(
		async (
			options: {
				configUrl?: string;
				configFile?: string;
				auto?: boolean;
				reset?: boolean;
			},
			command: Command,
		) => {
			const globalOptions = command.parent!.opts<GlobalOptions>();
			const {configDir} = globalOptions;

			if (
				!isTuiMode(globalOptions) ||
				options.configUrl ||
				options.configFile ||
				options.auto
			) {
				let result: SetupResult;

				if (options.auto) {
					result = await runSetupFromEnvironment(configDir, {
						reset: options.reset,
					});
				} else if (options.configFile) {
					result = await runSetupFromFile(options.configFile, configDir, {
						reset: options.reset,
					});
				} else if (options.configUrl) {
					result = await runSetupCli(options.configUrl, configDir, {
						reset: options.reset,
					});
				} else {
					console.error(
						'Error: a config source is required in non-interactive mode.',
					);
					console.error('Usage: aitool setup --config-url <url>');
					console.error('       aitool setup --config-file <path>');
					console.error('       aitool setup --auto');
					process.exit(1);
				}

				console.log(
					`Setup complete. Configuration saved to ${result.configFile}`,
				);
				console.log(`  issuer:   ${result.issuer}`);
				console.log(`  clientId: ${result.clientId}`);
			} else {
				const {unmount, waitUntilExit} = render(
					<SetupWizard
						configDir={configDir}
						forceReset={options.reset}
						onComplete={() => unmount()}
					/>,
				);
				await waitUntilExit();
			}
		},
	);

const configCommand = program
	.command('config')
	.description('Manage local configuration');

configCommand
	.command('show')
	.description('Display the current configuration')
	.action((_options, command: Command) => {
		const globalOptions = command.parent!.parent!.opts<GlobalOptions>();
		const {configDir} = globalOptions;
		const config = runConfigShow(configDir);
		console.log(`discoveryUrl:        ${config.discoveryUrl}`);
		console.log(`clientId:            ${config.clientId}`);
		console.log(`scopes:              ${config.scopes.join(', ')}`);
		if (config.cachedDiscovery) {
			console.log(`issuer:              ${config.cachedDiscovery.issuer}`);
			console.log(
				`token_endpoint:      ${config.cachedDiscovery.token_endpoint}`,
			);
		}

		if (config.discoveryFetchedAt) {
			console.log(`discoveryFetchedAt:  ${config.discoveryFetchedAt}`);
		}
	});

configCommand
	.command('get <key>')
	.description('Get a config value (clientId, scopes, discoveryUrl)')
	.action(async (key: string, _options: unknown, command: Command) => {
		const {configDir} = command.parent!.parent!.opts<GlobalOptions>();
		await runConfigGet(key, configDir);
	});

configCommand
	.command('set <key> <value>')
	.description('Set a config value (clientId, scopes, discoveryUrl)')
	.action(
		async (key: string, value: string, _options: unknown, command: Command) => {
			const {configDir} = command.parent!.parent!.opts<GlobalOptions>();
			await runConfigSet(key, value, configDir);
		},
	);

const authCommand = program
	.command('auth')
	.description('Authenticate with the OIDC provider');

authCommand
	.command('login')
	.description('Authenticate via OIDC Device Authorization Grant')
	.action(async (_options, command: Command) => {
		const globalOptions = command.parent!.parent!.opts<GlobalOptions>();
		const {configDir} = globalOptions;

		if (isTuiMode(globalOptions)) {
			render(<AuthLogin configDir={configDir} />);
		} else {
			const start = await startDeviceAuth(configDir);
			openBrowser(start.verificationUriComplete ?? start.verificationUri);
			console.log(`Open this URL in your browser: ${start.verificationUri}`);
			console.log(`Enter code: ${start.userCode}`);
			console.log('Waiting for authentication…');
			const result = await runAuthLogin(configDir);
			console.log('Authentication successful. Credentials saved.');
			if (result.expiresAt) console.log(`  expires: ${result.expiresAt}`);
		}
	});

authCommand
	.command('logout')
	.description('Clear stored credentials')
	.action((_options, command: Command) => {
		const {configDir} = command.parent!.parent!.opts<GlobalOptions>();
		const removed = runAuthLogout(configDir);
		if (removed) {
			console.log('Logged out. Credentials cleared.');
		} else {
			console.log('Not logged in.');
		}
	});

authCommand
	.command('status')
	.description('Show current authentication status and token expiry')
	.option('--output <format>', 'output format: text or json', 'text')
	.action((options: {output: string}, command: Command) => {
		const globalOptions = command.parent!.parent!.opts<GlobalOptions>();
		const {configDir} = globalOptions;
		const status = runAuthStatus(configDir);

		if (options.output === 'json') {
			console.log(JSON.stringify(status, null, 2));
			return;
		}

		if (isTuiMode(globalOptions)) {
			render(<AuthStatus status={status} />);
			return;
		}

		const tokenLabel: Record<string, string> = {
			valid: 'valid',
			expiring_soon: 'expiring soon',
			expired: 'expired',
			unknown: 'unknown',
		};

		console.log(`configured:    ${status.configured}`);
		console.log(`authenticated: ${status.authenticated}`);
		if (status.issuer) console.log(`issuer:        ${status.issuer}`);
		if (status.clientId) console.log(`clientId:      ${status.clientId}`);
		if (status.scopes)
			console.log(`scopes:        ${status.scopes.join(', ')}`);
		console.log(
			`token:         ${tokenLabel[status.tokenStatus] ?? status.tokenStatus}`,
		);
		if (status.expiresAt)
			console.log(
				`expiresAt:     ${status.expiresAt} (${formatRelativeTime(
					status.expiresAt,
				)})`,
			);
		if (status.scope) console.log(`scope:         ${status.scope}`);
	});

authCommand
	.command('whoami')
	.description(
		'Fetch user profile from the identity provider userinfo endpoint',
	)
	.action(async (_options, command: Command) => {
		const globalOptions = command.parent!.parent!.opts<GlobalOptions>();
		const {configDir} = globalOptions;

		if (isTuiMode(globalOptions)) {
			render(<AuthUserinfo configDir={configDir} />);
		} else {
			const info = await runAuthUserinfo(configDir);
			console.log(JSON.stringify(info, null, 2));
		}
	});

program
	.command('update')
	.description('Update to the latest version')
	.action(async () => {
		await selfUpdate();
	});

const agentCommand = program
	.command('agent')
	.description('Manage and inspect AI coding agents');

agentCommand
	.command('list')
	.description('List all available agent types and their capabilities')
	.option('--json', 'output results as JSON')
	.action((options: {json?: boolean}) => {
		runAgentList({json: options.json});
	});

agentCommand
	.command('check [agent-id]')
	.description(
		'Check whether AI coding agents are installed. ' +
			'Pass an agent id (claude-code, opencode) to check a specific one, ' +
			'or omit to check all.',
	)
	.option('--json', 'output results as JSON')
	.action(async (agentId: string | undefined, options: {json?: boolean}) => {
		await runAgentCheck({agent: agentId, json: options.json});
	});

agentCommand
	.command('configure <agent-id>')
	.description(
		"Diff an agent's local config file against its bundled template. " +
			'Shows keys that are missing, changed, or only present locally.',
	)
	.option(
		'--config-file <path>',
		'override the local config file path to compare',
	)
	.action(async (agentId: string, options: {configFile?: string}) => {
		await runAgentConfigure({agent: agentId, configFile: options.configFile});
	});

program.hook('preAction', (_thisCommand, actionCommand) => {
	// Skip warning for auth sub-commands — user is already acting on auth
	const commandPath: string[] = [];
	let cmd = actionCommand;
	while (cmd.parent) {
		commandPath.unshift(cmd.name());
		cmd = cmd.parent;
	}

	const rootOptions = cmd.opts<{configDir?: string; verbose?: boolean}>();
	if (rootOptions.verbose) {
		process.env['AITOOL_VERBOSE'] = '1';
	}

	const {configDir} = rootOptions;
	if (commandPath[0] === 'auth') return;
	warnIfTokenExpiring(configDir);
});

program.parseAsync().catch((error: Error) => {
	console.error(`Error: ${error.message}`);
	process.exit(1);
});
