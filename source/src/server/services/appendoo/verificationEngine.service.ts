import type {
  StartVerificationRunInput,
  VerificationGraderDefinition,
  VerificationRun,
} from '../../../shared/api/contracts/appendoo/verificationEngine.types';
import { DEFAULT_VERIFICATION_GRADERS } from '../../../shared/api/contracts/appendoo/verificationEngine.types';
import {
  runVerificationScaffold,
  summarizeVerificationRun,
} from '../../../shared/lib/appendoo/verificationEngineScaffold';
import { engineeringWorkspaceService } from './engineeringWorkspace.service';

export class VerificationEngineService {
  constructor(private graders: VerificationGraderDefinition[] = DEFAULT_VERIFICATION_GRADERS) {}

  startRun(input: StartVerificationRunInput): VerificationRun {
    return runVerificationScaffold(input, this.graders);
  }

  /** Freeze revision, run verification, bind result to workspace. */
  verifyWorkspaceRevision(
    workspaceId: string,
    revisionId: string,
    options: { changeSetId: string; mutationPaths?: string[] } ,
  ): { run: VerificationRun; summary: ReturnType<typeof summarizeVerificationRun> } | null {
    const workspace = engineeringWorkspaceService.getWorkspace(workspaceId);
    const revision = engineeringWorkspaceService.getRevision(workspaceId, revisionId);
    if (!workspace || !revision) return null;

    const frozen = revision.state === 'OPEN'
      ? engineeringWorkspaceService.freezeForVerification(workspaceId, revisionId)
      : revision;

    if (!frozen || frozen.state !== 'FROZEN_FOR_VERIFICATION') return null;

    const run = this.startRun({
      workspaceId,
      revisionId,
      revisionFingerprint: frozen.revisionFingerprint,
      changeSetId: options.changeSetId,
      mutationPaths: options.mutationPaths,
    });

    engineeringWorkspaceService.markVerificationResult(workspaceId, revisionId, {
      passed: run.deployable,
      verificationRunId: run.verificationRunId,
      revisionFingerprint: frozen.revisionFingerprint,
      at: run.completedAt ?? new Date().toISOString(),
    });

    return { run, summary: summarizeVerificationRun(run) };
  }

  listGraders(): VerificationGraderDefinition[] {
    return [...this.graders];
  }
}

export const verificationEngineService = new VerificationEngineService();
