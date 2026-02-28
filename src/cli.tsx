#!/usr/bin/env node
import React from 'react';
import {render} from 'ink';
import meow from 'meow';
import {version} from '../package.json';
import App from './app.js';
import {selfUpdate} from './update.js';

const cli = meow(
	`
	Usage
	  $ aitool [command]

	Commands
	  update    Update to the latest version
	  version   Print the current version

	Options
	  --name  Your name

	Examples
	  $ aitool --name=Jane
	  Hello, Jane

	  $ aitool version
	  $ aitool update
`,
	{
		importMeta: import.meta,
		flags: {
			name: {
				type: 'string',
			},
		},
	},
);

const [command] = cli.input;

if (command === 'version') {
	console.log(version);
	process.exit(0);
} else if (command === 'update') {
	selfUpdate().catch((err: Error) => {
		console.error(`Update failed: ${err.message}`);
		process.exit(1);
	});
} else {
	render(<App name={cli.flags.name} />);
}
