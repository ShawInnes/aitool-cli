// src/agents/index.ts
export {type AgentCheckResult, type AgentChecker} from './agent.js';
export {ClaudeCodeChecker} from './claudeCode.js';
export {OpenCodeChecker} from './openCode.js';

import {ClaudeCodeChecker} from './claudeCode.js';
import {OpenCodeChecker} from './openCode.js';
import {type AgentChecker} from './agent.js';

/**
 * All registered agent checkers. Add new checkers here to include them
 * in `aitool agent check` (no-arg) output.
 */
export const AGENT_REGISTRY: AgentChecker[] = [
	new ClaudeCodeChecker(),
	new OpenCodeChecker(),
];
