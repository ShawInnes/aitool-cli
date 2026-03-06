# Workflow

## Planning

- Enter plan mode for any non-trivial task (3+ steps or architectural decisions).
- If something goes sideways, stop and re-plan — don't keep pushing.
- Write a plan to `tasks/todo.md` with checkable items before implementation.

## Subagents

- Offload research, exploration, and parallel analysis to subagents.
- Keep the main context window clean; use one task per subagent.

## Verification Before Done

- Never mark a task complete without proving it works.
- Run `bun run test` and `bun run lint` after changes.
- Ask: "Would a staff engineer approve this?"

## Elegance

- For non-trivial changes: pause and ask "is there a more elegant way?"
- Skip for simple, obvious fixes — don't over-engineer.

## Autonomous Bug Fixing

- When given a bug report: just fix it. Point at logs/errors/failing tests, then resolve.
- Fix failing CI tests without being told how.

## Self-Improvement

- After any correction from the user: update `tasks/lessons.md` with the pattern.
- Review lessons at session start for context.
