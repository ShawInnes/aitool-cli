// src/components/AgentSelector.tsx
import {Box, Text, useApp, useInput} from 'ink';
import {useState} from 'react';
import {type Agent} from '../agents/agent.js';

const VISIBLE_COUNT = 8;

type Props = {
	/** Agents to display in the list. */
	agents: Agent[];
	/** Called with the chosen agent when the user presses Enter. */
	onSelect: (agent: Agent) => void;
	/**
	 * Text shown after "aitool — " in the title bar.
	 * Defaults to "Select Agent".
	 */
	title?: string;
};

/**
 * Scrollable agent picker. Navigate with ↑↓, confirm with Enter, cancel with Esc.
 * Calls `onSelect` and exits when the user confirms a selection.
 * Exits without calling `onSelect` when the user cancels.
 */
export default function AgentSelector({
	agents,
	onSelect,
	title = 'Select Agent',
}: Props) {
	const {exit} = useApp();
	const [cursor, setCursor] = useState(0);
	const [scrollOffset, setScrollOffset] = useState(0);

	useInput((input, key) => {
		if (key.upArrow) {
			const next = Math.max(0, cursor - 1);
			setCursor(next);
			if (next < scrollOffset) setScrollOffset(next);
		} else if (key.downArrow) {
			const next = Math.min(agents.length - 1, cursor + 1);
			setCursor(next);
			if (next >= scrollOffset + VISIBLE_COUNT) {
				setScrollOffset(next - VISIBLE_COUNT + 1);
			}
		} else if (key.return) {
			const agent = agents[cursor];
			if (agent) {
				onSelect(agent);
				exit();
			}
		} else if (key.escape) {
			exit();
		}
	});

	const visibleAgents = agents.slice(scrollOffset, scrollOffset + VISIBLE_COUNT);
	const canScrollUp = scrollOffset > 0;
	const canScrollDown = scrollOffset + VISIBLE_COUNT < agents.length;

	return (
		<Box flexDirection="column">
			<Text bold>aitool — {title}</Text>
			<Box
				borderStyle="single"
				borderColor="gray"
				paddingX={1}
				flexDirection="column"
			>
				{canScrollUp && <Text color="gray">↑</Text>}
				{visibleAgents.map((agent, i) => {
					const actualIndex = i + scrollOffset;
					const isActive = actualIndex === cursor;
					return (
						<Box key={agent.id}>
							<Text color={isActive ? 'cyan' : undefined}>
								{isActive ? '> ' : '  '}
								{agent.displayName}
							</Text>
						</Box>
					);
				})}
				{canScrollDown && <Text color="gray">↓</Text>}
			</Box>
			<Text color="gray">↑↓ navigate · enter select · esc cancel</Text>
		</Box>
	);
}
