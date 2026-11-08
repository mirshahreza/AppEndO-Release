import path from 'node:path';
import { runNpmScript } from './npmRunner';

export type RepairOutcome = 'retry' | 'abort';

export function repairActionForLog(combinedLog: string): RepairOutcome {
  if (combinedLog.includes('ZIP_VERSION_MISMATCH')) return 'retry';
  if (combinedLog.includes('parity') || combinedLog.includes('ui-routes')) return 'retry';
  if (
    combinedLog.includes('PrismaClient') ||
    combinedLog.includes('prisma generate') ||
    combinedLog.includes('@prisma/client did not initialize')
  ) {
    return 'retry';
  }
  return 'abort';
}

export function attemptRepairForLog(
  combinedLog: string,
  repoRoot: string,
  logDir: string,
): RepairOutcome {
  const action = repairActionForLog(combinedLog);
  if (action === 'abort') return 'abort';

  if (combinedLog.includes('ZIP_VERSION_MISMATCH')) {
    runNpmScript('vertical:pack', { cwd: repoRoot, logPath: path.join(logDir, 'repair-vertical-pack.log') });
    return 'retry';
  }

  if (combinedLog.includes('parity') || combinedLog.includes('ui-routes')) {
    runNpmScript('vertical:repair-ui-routes', {
      cwd: repoRoot,
      logPath: path.join(logDir, 'repair-vertical-routes.log'),
    });
    return 'retry';
  }

  if (
    combinedLog.includes('PrismaClient') ||
    combinedLog.includes('prisma generate') ||
    combinedLog.includes('@prisma/client did not initialize')
  ) {
    runNpmScript('prisma:generate', { cwd: repoRoot, logPath: path.join(logDir, 'repair-prisma.log') });
    return 'retry';
  }

  return 'abort';
}
