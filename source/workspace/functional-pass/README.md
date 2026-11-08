# Functional pass artifacts

Created by the **appendo-qa-functional-pass** skill (`.claude/skills/appendo-qa-functional-pass/`).

- **screenshots/** — step PNGs from browser QA (`{phase}-{slug}-{step}.png`)
- Progress lives in `.claude/skills/appendo-qa-functional-pass/QUEUE.md`

Appearance automated gate (no browser):

```bash
node workspace/smoke-pass/run-appearance-automated-tests.mjs
```

## Exhaustive pass (every option + screenshot)

Operator request: full end-user validation — not one toggle per section.

```bash
node workspace/functional-pass/run-exhaustive-pass.mjs
```

See [`.claude/skills/appendo-qa-functional-pass/EXHAUSTIVE.md`](../.claude/skills/appendo-qa-functional-pass/EXHAUSTIVE.md).

Resume / monitor without chat: `exhaustive-progress.json`, tail `exhaustive-run.log`, PNG count under
`screenshots/exhaustive/`. Shared Reset/dismiss: [`workspace/qa-runners/lib.mjs`](../qa-runners/lib.mjs).
After updating the runner, delete `FAIL` keys (or the whole progress file) and re-run the same command.
