#!/usr/bin/env node
import React from 'react';
import {render} from 'ink';
import {Command} from 'commander';
import pkg from '../package.json';
import {selfUpdate} from './update.js';
import {
	type SetupResult,
	runSetupCli,
	runSetupFromEnvironment,
	runSetupFromFile,
} from './commands/setup.js';
import {runConfigShow} from './commands/config.js';
import {openBrowser, runAuthLogin, startDeviceAuth} from './commands/auth.js';
import SetupWizard from './components/SetupWizard.js';
import AuthLogin from './components/AuthLogin.js';

type GlobalOptions = {
	configDir?: string;
	tui: boolean;
};

function isTuiMode(globalOptions: GlobalOptions): boolean {
	return globalOptions.tui && process.stdout.isTTY !== false;
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
	.action(
		async (
			options: {configUrl?: string; configFile?: string; auto?: boolean},
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
					result = await runSetupFromEnvironment(configDir);
				} else if (options.configFile) {
					result = await runSetupFromFile(options.configFile, configDir);
				} else if (options.configUrl) {
					result = await runSetupCli(options.configUrl, configDir);
				} else {
					console.error(
						'Error: a config source is required in non-interactive mode.',
					);
					console.error('Usage: aitool setup --config-url <url>');
					console.error('       aitool setup --config-file <path>');
					console.error('       aitool setup --auto');
					process.exit(1);
				}

				console.log('Setup complete. Configuration saved.');
				console.log(`  issuer:   ${result.issuer}`);
				console.log(`  clientId: ${result.clientId}`);
			} else {
				render(<SetupWizard configDir={configDir} />);
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

const authCommand = program.command('auth').description('Authenticate with the OIDC provider');

authCommand
	.command('login')
	.description('Authenticate via OIDC Device Authorization Grant')
	.action(async (_options, command: Command) => {
		const globalOptions = command.parent!.parent!.opts<GlobalOptions>();
		const {configDir} = globalOptions;

		if (!isTuiMode(globalOptions)) {
			const start = await startDeviceAuth(configDir);
			openBrowser(start.verificationUriComplete ?? start.verificationUri);
			console.log(`Open this URL in your browser: ${start.verificationUri}`);
			console.log(`Enter code: ${start.userCode}`);
			console.log('Waiting for authentication…');
			const result = await runAuthLogin(configDir);
			console.log('Authentication successful. Credentials saved.');
			if (result.expiresAt) console.log(`  expires: ${result.expiresAt}`);
		} else {
			render(<AuthLogin configDir={configDir} />);
		}
	});

program
	.command('update')
	.description('Update to the latest version')
	.action(async () => {
		await selfUpdate();
	});

program.parseAsync().catch((err: Error) => {
	console.error(`Error: ${err.message}`);
	process.exit(1);
});
