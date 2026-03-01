// src/agents/index.ts
export {type Agent, type AgentCheckResult, type Executor} from './agent.js';
export {ClaudeCodeAgent, claudeCode} from './claudeCode.js';
export {OpenCodeAgent, openCode} from './openCode.js';

import {type Agent} from './agent.js';
import {claudeCode} from './claudeCode.js';
import {openCode} from './openCode.js';

/**
 * All registered AI coding agents. Add new agents here to include them
 * in `aitool agent check` (no-arg) output and any future agent commands.
 */
export const AGENT_REGISTRY: Agent[] = [claudeCode, openCode];
