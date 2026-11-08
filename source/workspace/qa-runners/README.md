# QA runners (background / resume-safe)

Shared contract: [`.claude/skills/BACKGROUND-EXECUTION.md`](../../.claude/skills/BACKGROUND-EXECUTION.md)

| Module | Use |
|--------|-----|
| [`lib.mjs`](./lib.mjs) | login, progress, errors, Reset/dismiss, settle waits |

Import from skill runners:

```javascript
import {
  loadProgress,
  saveProgress,
  appendLog,
  collect,
  assertClean,
  loginViaApi,
  launchOptions,
} from '../qa-runners/lib.mjs';
```

Run long jobs in a terminal (hours); agent triages `progress.json` when the phase completes.

| Runner | Progress file |
|--------|----------------|
| `workspace/smoke-pass/run-studio-queue.mjs` | `workspace/smoke-pass/progress.json` |
| `workspace/functional-pass/run-functional-pass.mjs` | (phase logs in skill QUEUE) |
| `workspace/functional-pass/run-exhaustive-pass.mjs` | `workspace/functional-pass/exhaustive-progress.json` |
| `workspace/ui-visual-pass/run-visual-capture.mjs` | `workspace/ui-visual-pass/progress.json` |
| `workspace/ui-responsive-pass/run-responsive-capture.mjs` | `workspace/ui-responsive-pass/progress.json` |
| `workspace/hawiety-i18n-pass/run-hwy-i18n-capture.mjs` | `workspace/hawiety-i18n-pass/progress.json` |
| `workspace/optimization-pass/run-optimization-pass.mjs` | `workspace/optimization-pass/progress.json` |

Agent-only build skills: [`.claude/skills/BACKGROUND-BUILD.md`](../../.claude/skills/BACKGROUND-BUILD.md).

Overnight stack (concurrency rules): [`workspace/overnight/run-overnight.mjs`](../overnight/run-overnight.mjs).
