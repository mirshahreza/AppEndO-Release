import fs from 'node:fs';
import path from 'node:path';
import type { ReleaseCutVersionsFile } from './versionManifest';
import type { SemverBump } from './semver';

export type ReleaseCutPhaseId = 'P0' | 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6' | 'P7' | 'P8';

export type ReleaseCutCheckpoint = {
  runId: string;
  startedAt: string;
  gitSha: string;
  dryRun: boolean;
  bump: SemverBump;
  publishPackageIds: string[];
  skipOss: boolean;
  fastMode: boolean;
  completedPhases: ReleaseCutPhaseId[];
  versions?: ReleaseCutVersionsFile;
  tagName?: string;
  releaseCommitSha?: string;
  failedPhase?: ReleaseCutPhaseId;
  lastError?: string;
};

export function releaseCutRunRoot(repoRoot: string, runId: string): string {
  return path.join(repoRoot, 'dist', 'release-cut', runId);
}

export function checkpointPath(runRoot: string): string {
  return path.join(runRoot, 'checkpoint.json');
}

export function writeCheckpoint(runRoot: string, checkpoint: ReleaseCutCheckpoint): void {
  fs.mkdirSync(runRoot, { recursive: true });
  fs.writeFileSync(checkpointPath(runRoot), `${JSON.stringify(checkpoint, null, 2)}\n`, 'utf8');
}

export function readCheckpoint(runRoot: string): ReleaseCutCheckpoint {
  const raw = fs.readFileSync(checkpointPath(runRoot), 'utf8');
  return JSON.parse(raw) as ReleaseCutCheckpoint;
}

export function appendReportLine(runRoot: string, line: string): void {
  const reportPath = path.join(runRoot, 'REPORT.md');
  fs.mkdirSync(runRoot, { recursive: true });
  if (!fs.existsSync(reportPath)) {
    fs.writeFileSync(reportPath, `# Release cut report\n\n`, 'utf8');
  }
  fs.appendFileSync(reportPath, `${line}\n`, 'utf8');
}
