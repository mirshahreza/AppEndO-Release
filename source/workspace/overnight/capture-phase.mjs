/**
 * Post-smoke capture + light gates (single Playwright at a time — call sequentially).
 */
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendLog } from '../qa-runners/lib.mjs';
import { HWY_STUDIO_ROUTES } from '../qa-runners/studio-routes.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

export function runCapturePhase(logPath) {
  const steps = [
    { label: 'smoke packages', script: 'workspace/smoke-pass/run-studio-queue.mjs', env: { SMOKE_PACKAGES: '1' } },
    { label: 'visual studio queue', script: 'workspace/ui-visual-pass/run-visual-studio-queue.mjs', env: {} },
    {
      label: 'visual packages',
      script: 'workspace/ui-visual-pass/run-visual-studio-queue.mjs',
      env: { CAPTURE_PACKAGES: '1' },
    },
    { label: 'responsive studio queue', script: 'workspace/ui-responsive-pass/run-responsive-studio-queue.mjs', env: {} },
    {
      label: 'responsive packages',
      script: 'workspace/ui-responsive-pass/run-responsive-studio-queue.mjs',
      env: { CAPTURE_PACKAGES: '1' },
    },
    {
      label: 'hawiety i18n capture',
      script: 'workspace/hawiety-i18n-pass/run-hwy-i18n-capture.mjs',
      env: {
        HWY_CULTURES: process.env.HWY_CULTURES ?? 'iq,ir',
        HWY_ROUTES: process.env.HWY_ROUTES ?? HWY_STUDIO_ROUTES.join(','),
      },
    },
    { label: 'appearance automated tests', script: 'workspace/smoke-pass/run-appearance-automated-tests.mjs', env: {} },
  ];

  for (const step of steps) {
    try {
      appendLog(logPath, `capture phase: ${step.label}`);
      execSync(`node ${step.script}`, {
        cwd: ROOT,
        stdio: 'inherit',
        env: { ...process.env, ...step.env, OVERNIGHT_OWNS_EXHAUSTIVE: '1' },
      });
    } catch (err) {
      appendLog(logPath, `capture phase failed (${step.label}): ${err.message}`);
    }
  }
  appendLog(logPath, 'capture phase complete');
}
