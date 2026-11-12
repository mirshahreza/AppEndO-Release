#!/usr/bin/env tsx
/**
 * Local release-cut orchestrator (no GitHub Actions). See plans/core/todo/p-130-local-release-cut.md
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  appendReportLine,
  readCheckpoint,
  releaseCutRunRoot,
  writeCheckpoint,
  type ReleaseCutCheckpoint,
  type ReleaseCutPhaseId,
} from './checkpoint';
import { registryEntryFor } from './releaseCutPackageRegistry';
import {
  applyReleaseCutVersions,
  planVersionBump,
  platformReleaseTagName,
  readReleaseCutVersions,
  releaseCutRepoRoot,
} from './versionManifest';
import { assertPublicOssReleaseScope, type PublicOssManifest } from './assertPublicOssReleaseScope';
import { copyFileEnsured, resolveLatestArtifact, sha256File } from './artifacts';
import {
  createAnnotatedTag,
  createReleaseCommit,
  deleteLocalTag,
  ensureAnnotatedTag,
  getCurrentBranch,
  getHeadSha,
  isWorkingTreeClean,
  pushRelease,
} from './gitReleaseCut';
import { runNpmScript } from './npmRunner';
import { attemptRepairForLog } from './repair';
import type { SemverBump } from './semver';
import { pushAppEndOReleaseTree } from './pushAppEndORelease';
import { pushAppEndOHawietyTree } from './pushAppEndOHawiety';
import { cloneProfilesForSchemaSync } from './cloneProfilesForSchemaSync';

type CliOptions = {
  dryRun: boolean;
  bump: SemverBump;
  publishPackageIds: string[];
  skipOss: boolean;
  push: boolean;
  allowDirty: boolean;
  fast: boolean;
  allowFast: boolean;
  withRepoLint: boolean;
  withTestCritical: boolean;
  allowPlatformBuildFail: boolean;
  pushAppEndORelease: boolean;
  pushAppEndOHawiety: boolean;
  syncCloneSchemas: boolean;
  resumeRunId?: string;
  mainBranchOnly: boolean;
};

function parseArgs(argv: string[]): CliOptions {
  const versions = readReleaseCutVersions();
  let publishPackageIds = [...versions.defaultPublishPackageIds];
  let bump: SemverBump = 'patch';
  let dryRun = false;
  let skipOss = false;
  let push = false;
  let allowDirty = false;
  let fast = false;
  let allowFast = false;
  let withRepoLint = false;
  let withTestCritical = false;
  let allowPlatformBuildFail = false;
  let pushAppEndORelease = false;
  let pushAppEndOHawiety = false;
  let syncCloneSchemas: boolean | undefined;
  let resumeRunId: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') dryRun = true;
    else if (arg === '--skip-oss') skipOss = true;
    else if (arg === '--push') push = true;
    else if (arg === '--allow-dirty') allowDirty = true;
    else if (arg === '--fast') fast = true;
    else if (arg === '--allow-fast') allowFast = true;
    else if (arg === '--with-repo-lint') withRepoLint = true;
    else if (arg === '--with-test-critical') withTestCritical = true;
    else if (arg === '--allow-platform-build-fail') allowPlatformBuildFail = true;
    else if (arg === '--push-appendo-release') pushAppEndORelease = true;
    else if (arg === '--push-appendo-hawiety') pushAppEndOHawiety = true;
    else if (arg === '--bump') bump = (argv[++i] as SemverBump) ?? 'patch';
    else if (arg === '--publish-packages') {
      publishPackageIds = (argv[++i] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    } else if (arg === '--resume') resumeRunId = argv[++i];
    else if (arg === '--sync-clone-schemas') syncCloneSchemas = true;
    else if (arg === '--skip-clone-schemas') syncCloneSchemas = false;
    else if (arg === '--no-main-guard') {
      /* testing */
    }
  }

  const resolvedSyncCloneSchemas = syncCloneSchemas ?? !fast;

  return {
    dryRun,
    bump,
    publishPackageIds,
    skipOss,
    push,
    allowDirty,
    fast,
    allowFast,
    withRepoLint,
    withTestCritical,
    allowPlatformBuildFail,
    pushAppEndORelease,
    pushAppEndOHawiety,
    syncCloneSchemas: resolvedSyncCloneSchemas,
    resumeRunId,
    mainBranchOnly: !argv.includes('--no-main-guard'),
  };
}

function newRunId(): string {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  return `${stamp}-${Math.random().toString(36).slice(2, 8)}`;
}

function phaseDone(checkpoint: ReleaseCutCheckpoint, phase: ReleaseCutPhaseId): boolean {
  return checkpoint.completedPhases.includes(phase);
}

function markPhase(checkpoint: ReleaseCutCheckpoint, phase: ReleaseCutPhaseId): void {
  if (!checkpoint.completedPhases.includes(phase)) {
    checkpoint.completedPhases.push(phase);
  }
}

function runWithOptionalRepair(
  script: string,
  repoRoot: string,
  logPath: string,
  dryRun: boolean,
  npmOptions?: { nodeOldSpaceMb?: number },
): void {
  if (dryRun) return;
  let result = runNpmScript(script, { cwd: repoRoot, logPath, ...npmOptions });
  if (result.ok) return;

  if (script === 'build' && result.combinedLog.includes('heap out of memory')) {
    result = runNpmScript(script, {
      cwd: repoRoot,
      logPath: `${logPath}.heap-retry`,
      nodeOldSpaceMb: 12288,
    });
    if (result.ok) return;
  }

  const repair = attemptRepairForLog(result.combinedLog, repoRoot, path.dirname(logPath));
  if (repair === 'retry') {
    result = runNpmScript(script, { cwd: repoRoot, logPath: `${logPath}.retry`, ...npmOptions });
  }
  if (!result.ok) {
    throw new Error(`npm run ${script} failed (see ${logPath})`);
  }
}

function readCloneDevSqlPassword(repoRoot: string): string | undefined {
  const fromEnv = process.env.APPENDO_CLONE_SQL_PASSWORD?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  const secretPath = path.join(repoRoot, '.appendo-clone-work', 'clone-sql-login.password');
  if (fs.existsSync(secretPath)) {
    return fs.readFileSync(secretPath, 'utf8').trim();
  }
  return undefined;
}

function packPackageIds(repoRoot: string, runRoot: string, packageIds: string[], dryRun: boolean): void {
  const artifactsDir = path.join(runRoot, 'artifacts', 'packages');
  fs.mkdirSync(artifactsDir, { recursive: true });

  const cloneSqlPassword = readCloneDevSqlPassword(repoRoot);

  for (const packageId of packageIds) {
    const entry = registryEntryFor(packageId);
    if (!entry) {
      throw new Error(`No registry entry for packageId=${packageId}`);
    }

    if (dryRun) continue;

    if (entry.releasePipeline && packageId === 'hawiety') {
      runWithOptionalRepair(entry.releasePipeline, repoRoot, path.join(runRoot, 'logs', `pack-${packageId}.log`), false);
    } else if (packageId === 'cms') {
      if (cloneSqlPassword) {
        process.env.APPENDO_CMS_PACK_SQL_LOGIN = 'appendo_clone_dev';
        process.env.APPENDO_CLONE_SQL_PASSWORD = cloneSqlPassword;
        delete process.env.APPENDO_WINDOWS_SQL_TRUSTED;
      } else if (process.platform === 'win32') {
        process.env.APPENDO_WINDOWS_SQL_TRUSTED =
          process.env.APPENDO_WINDOWS_SQL_TRUSTED ?? '1';
      }
      runWithOptionalRepair('cms:pack', repoRoot, path.join(runRoot, 'logs', `pack-${packageId}.log`), false);
    } else {
      runWithOptionalRepair(entry.packCommand, repoRoot, path.join(runRoot, 'logs', `pack-${packageId}.log`), false);
    }

    let copied = false;
    for (const globPattern of entry.zipArtifactGlobs) {
      const zipPath = resolveLatestArtifact(repoRoot, globPattern);
      if (zipPath) {
        copyFileEnsured(zipPath, path.join(artifactsDir, path.basename(zipPath)));
        copied = true;
        break;
      }
    }
    if (!copied) {
      throw new Error(`Pack succeeded but no zip found for ${packageId} (globs: ${entry.zipArtifactGlobs.join(', ')})`);
    }
  }
}

function runCloneSchemaSyncPillar(
  options: CliOptions,
  repoRoot: string,
  runRoot: string,
  dryRun: boolean,
): void {
  if (!options.syncCloneSchemas) {
    appendReportLine(runRoot, '- P9 clone schema sync skipped (fast or --skip-clone-schemas)');
    return;
  }

  const profiles = cloneProfilesForSchemaSync({
    skipOss: options.skipOss,
    publishPackageIds: options.publishPackageIds,
  });

  if (profiles.length === 0) {
    appendReportLine(runRoot, '- P9 clone schema sync skipped (no profiles)');
    return;
  }

  if (dryRun) {
    appendReportLine(runRoot, `- P9 clone schema sync dry-run profiles=${profiles.join(', ')}`);
    return;
  }

  for (const profileId of profiles) {
    const logPath = path.join(runRoot, 'logs', `provision-${profileId}.log`);
    const result = runNpmScript('clone:provision', {
      cwd: repoRoot,
      logPath,
      extraArgs: ['--profile', profileId],
      env: {
        APPENDO_CLONE_WINDOWS_SQL_TRUSTED: process.env.APPENDO_CLONE_WINDOWS_SQL_TRUSTED ?? '1',
      },
    });
    if (!result.ok) {
      throw new Error(
        `npm run clone:provision -- --profile ${profileId} failed (see ${logPath})`,
      );
    }
  }
  appendReportLine(runRoot, `- P9 clone schema sync OK profiles=${profiles.join(', ')}`);
}

function runTestPillar(options: CliOptions, repoRoot: string, runRoot: string, publishIds: string[]): void {
  if (options.dryRun) return;
  if (options.fast && !options.allowFast) {
    throw new Error('Refusing --fast without --allow-fast (operator release requires full tests)');
  }

  const logs = path.join(runRoot, 'logs');

  if (!options.fast) {
    if (options.withRepoLint) {
      runWithOptionalRepair('lint', repoRoot, path.join(logs, 'lint.log'), false);
    }
    runWithOptionalRepair('test:release-cut', repoRoot, path.join(logs, 'test-release-cut.log'), false);
    runWithOptionalRepair('test:release-cut-packaging', repoRoot, path.join(logs, 'test-packaging-exit.log'), false);
    if (options.withTestCritical) {
      runWithOptionalRepair('test:critical', repoRoot, path.join(logs, 'test-critical.log'), false);
    }
  }

  for (const packageId of publishIds) {
    const entry = registryEntryFor(packageId);
    if (entry?.releasePipeline) {
      // hawiety:release already ran in pack for hawiety — avoid duplicate unless not packed
      if (packageId !== 'hawiety') {
        runWithOptionalRepair(entry.releasePipeline, repoRoot, path.join(logs, `test-${packageId}.log`), false);
      }
    }
  }

}

function resolvePackageZipForOss(
  repoRoot: string,
  runRoot: string,
  packageId: string,
): { src: string; fileName: string } {
  const artifactsDir = path.join(runRoot, 'artifacts', 'packages');
  if (fs.existsSync(artifactsDir)) {
    const zipInArtifacts = fs
      .readdirSync(artifactsDir)
      .filter((name) => name.startsWith(`${packageId}-`) && name.endsWith('.zip'))
      .sort()
      .pop();
    if (zipInArtifacts) {
      return { src: path.join(artifactsDir, zipInArtifacts), fileName: zipInArtifacts };
    }
  }

  const entry = registryEntryFor(packageId);
  if (!entry) throw new Error(`Missing registry for OSS package ${packageId}`);
  for (const globPattern of entry.zipArtifactGlobs) {
    const found = resolveLatestArtifact(repoRoot, globPattern);
    if (found) {
      return { src: found, fileName: path.basename(found) };
    }
  }

  throw new Error(`Could not resolve OSS zip for ${packageId}`);
}

function buildPublicOssBundle(
  repoRoot: string,
  runRoot: string,
  versions: ReturnType<typeof readReleaseCutVersions>,
  gitSha: string,
  dryRun: boolean,
): void {
  if (dryRun) return;

  const publicDir = path.join(runRoot, 'public-oss');
  fs.mkdirSync(publicDir, { recursive: true });
  const artifactsDir = path.join(runRoot, 'artifacts', 'packages');
  fs.mkdirSync(artifactsDir, { recursive: true });

  const manifest: PublicOssManifest = {
    platformVersion: versions.platform,
    bundledPackageIds: versions.publicOssPackageIds,
    packageArtifacts: [],
    createdAt: new Date().toISOString(),
    gitSha,
  };

  for (const packageId of versions.publicOssPackageIds) {
    const { src, fileName } = resolvePackageZipForOss(repoRoot, runRoot, packageId);
    const dest = path.join(publicDir, fileName);
    copyFileEnsured(src, dest);
    copyFileEnsured(src, path.join(artifactsDir, fileName));
    manifest.packageArtifacts.push({
      packageId,
      fileName,
      sha256: sha256File(dest),
    });
  }

  fs.writeFileSync(path.join(publicDir, 'MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  assertPublicOssReleaseScope(publicDir);
}

function runPublicAssembleScript(repoRoot: string, runRoot: string, dryRun: boolean): void {
  if (dryRun) return;
  const logPath = path.join(runRoot, 'logs', 'public-assemble.log');
  const result = runNpmScript('release:export-appendo-release', { cwd: repoRoot, logPath });
  if (!result.ok) {
    throw new Error(`npm run release:export-appendo-release failed (see ${logPath})`);
  }
  appendReportLine(runRoot, `- staging: .appendo-release-staging/v${readReleaseCutVersions().platform} → push AppEndO-Release`);
}

async function main(): Promise<void> {
  const repoRoot = releaseCutRepoRoot();
  const options = parseArgs(process.argv.slice(2));
  const versionsFile = readReleaseCutVersions();

  let runId = options.resumeRunId ?? newRunId();
  let runRoot = releaseCutRunRoot(repoRoot, runId);

  let checkpoint: ReleaseCutCheckpoint;
  if (options.resumeRunId) {
    runRoot = releaseCutRunRoot(repoRoot, options.resumeRunId);
    checkpoint = readCheckpoint(runRoot);
    options.dryRun = checkpoint.dryRun;
    options.publishPackageIds = checkpoint.publishPackageIds;
    options.bump = checkpoint.bump;
    options.skipOss = checkpoint.skipOss;
    options.fast = checkpoint.fastMode;
    options.syncCloneSchemas = checkpoint.syncCloneSchemas ?? options.syncCloneSchemas;
    runId = checkpoint.runId;
    if (checkpoint.tagName && phaseDone(checkpoint, 'P3')) {
      ensureAnnotatedTag(repoRoot, checkpoint.tagName, `Release ${checkpoint.versions?.platform ?? ''}`);
    }
  } else {
    checkpoint = {
      runId,
      startedAt: new Date().toISOString(),
      gitSha: getHeadSha(repoRoot),
      dryRun: options.dryRun,
      bump: options.bump,
      publishPackageIds: options.publishPackageIds,
      skipOss: options.skipOss,
      fastMode: options.fast,
      syncCloneSchemas: options.syncCloneSchemas,
      completedPhases: [],
    };
    fs.mkdirSync(runRoot, { recursive: true });
    writeCheckpoint(runRoot, checkpoint);
  }

  appendReportLine(runRoot, `- Run \`${runId}\` dryRun=${options.dryRun} bump=${options.bump}`);

  const phases: ReleaseCutPhaseId[] = ['P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P9', 'P8'];
  let tagName: string | undefined;

  try {
    for (const phase of phases) {
      if (phaseDone(checkpoint, phase)) continue;

      if (phase === 'P0') {
        const branch = getCurrentBranch(repoRoot);
        if (options.mainBranchOnly && branch !== 'main') {
          throw new Error(`Release cut requires branch main (current: ${branch || 'detached'})`);
        }
        if (!isWorkingTreeClean(repoRoot) && !options.allowDirty) {
          throw new Error('Working tree not clean — commit/stash or pass --allow-dirty');
        }
        checkpoint.gitSha = getHeadSha(repoRoot);
        appendReportLine(runRoot, `- P0 OK sha=\`${checkpoint.gitSha}\``);
        markPhase(checkpoint, phase);
        writeCheckpoint(runRoot, checkpoint);
      }

      if (phase === 'P1') {
        const plan = planVersionBump({
          bump: options.bump,
          publishPackageIds: options.publishPackageIds,
        });
        if (!options.dryRun) {
          applyReleaseCutVersions(plan.after);
        }
        checkpoint.versions = plan.after;
        tagName = platformReleaseTagName(plan.after.platform);
        checkpoint.tagName = tagName;
        appendReportLine(
          runRoot,
          `- P1 versions platform=${plan.after.platform} publish=${options.publishPackageIds.join(',')}`,
        );
        markPhase(checkpoint, phase);
        writeCheckpoint(runRoot, checkpoint);
      }

      if (phase === 'P2') {
        if (!options.dryRun) {
          const msg = `chore(release): prepare ${checkpoint.versions?.platform ?? 'unknown'}`;
          checkpoint.releaseCommitSha = createReleaseCommit(repoRoot, msg);
        }
        appendReportLine(runRoot, `- P2 release commit ${options.dryRun ? '(skipped dry-run)' : checkpoint.releaseCommitSha}`);
        markPhase(checkpoint, phase);
        writeCheckpoint(runRoot, checkpoint);
      }

      if (phase === 'P3') {
        if (!options.dryRun && checkpoint.tagName) {
          createAnnotatedTag(repoRoot, checkpoint.tagName, `Release ${checkpoint.versions?.platform}`);
        }
        appendReportLine(runRoot, `- P3 tag ${checkpoint.tagName ?? 'n/a'}`);
        markPhase(checkpoint, phase);
        writeCheckpoint(runRoot, checkpoint);
      }

      if (phase === 'P4') {
        const ossIds = options.skipOss ? [] : versionsFile.publicOssPackageIds;
        const packIds = [...new Set([...options.publishPackageIds, ...ossIds])];
        packPackageIds(repoRoot, runRoot, packIds, options.dryRun);
        appendReportLine(runRoot, `- P4 packed ${packIds.join(', ')}`);
        markPhase(checkpoint, phase);
        writeCheckpoint(runRoot, checkpoint);
      }

      if (phase === 'P5') {
        runTestPillar(options, repoRoot, runRoot, options.publishPackageIds);
        appendReportLine(runRoot, `- P5 tests ${options.fast ? 'fast' : 'full'}`);
        markPhase(checkpoint, phase);
        writeCheckpoint(runRoot, checkpoint);
      }

      if (phase === 'P6') {
        if (!options.dryRun && !options.skipOss) {
          const platformDir = path.join(runRoot, 'platform');
          fs.mkdirSync(platformDir, { recursive: true });
          const buildLog = path.join(runRoot, 'logs', 'build.log');
          try {
            runWithOptionalRepair('build', repoRoot, buildLog, false, {
              nodeOldSpaceMb: 8192,
            });
            const srcDist = path.join(repoRoot, 'dist');
            const destDist = path.join(platformDir, 'dist');
            fs.mkdirSync(destDist, { recursive: true });
            for (const entry of fs.readdirSync(srcDist, { withFileTypes: true })) {
              if (entry.name === 'release-cut') {
                continue;
              }
              fs.cpSync(path.join(srcDist, entry.name), path.join(destDist, entry.name), { recursive: true });
            }
            const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
              version: string;
            };
            fs.writeFileSync(path.join(platformDir, 'PLATFORM_VERSION.txt'), `${pkg.version}\n`, 'utf8');
            appendReportLine(runRoot, '- P6 platform build OK');
          } catch (buildError) {
            const message = buildError instanceof Error ? buildError.message : String(buildError);
            fs.mkdirSync(runRoot, { recursive: true });
            fs.writeFileSync(path.join(runRoot, 'PLATFORM_BUILD_FAILED.txt'), `${message}\n`, 'utf8');
            if (!options.allowPlatformBuildFail) {
              throw buildError;
            }
            appendReportLine(runRoot, `- P6 platform build SKIPPED (see BUILD_FAILED.txt): ${message}`);
          }
        }
        markPhase(checkpoint, phase);
        writeCheckpoint(runRoot, checkpoint);
      }

      if (phase === 'P7') {
        if (!options.skipOss) {
          buildPublicOssBundle(
            repoRoot,
            runRoot,
            checkpoint.versions ?? readReleaseCutVersions(),
            checkpoint.releaseCommitSha ?? checkpoint.gitSha,
            options.dryRun,
          );
        }
        appendReportLine(runRoot, `- P7 public-oss ${options.skipOss ? 'skipped' : 'ok'}`);
        markPhase(checkpoint, phase);
        writeCheckpoint(runRoot, checkpoint);
      }

      if (phase === 'P9') {
        runCloneSchemaSyncPillar(options, repoRoot, runRoot, options.dryRun);
        markPhase(checkpoint, phase);
        writeCheckpoint(runRoot, checkpoint);
      }

      if (phase === 'P8') {
        if (
          !options.skipOss &&
          !options.dryRun &&
          fs.existsSync(path.join(repoRoot, 'dist', 'server.cjs'))
        ) {
          runPublicAssembleScript(repoRoot, runRoot, options.dryRun);
        }
        if (!options.dryRun && !options.skipOss && fs.existsSync(path.join(repoRoot, 'dist', 'server.cjs'))) {
          if (options.pushAppEndORelease) {
            try {
              runNpmScript('release:export-appendo-release', { cwd: repoRoot, logPath: path.join(runRoot, 'logs', 'export-release.log') });
              const pushSummary = pushAppEndOReleaseTree({ repoRoot });
              appendReportLine(runRoot, `- AppEndO-Release: ${pushSummary}`);
            } catch (pushError) {
              const pushMessage = pushError instanceof Error ? pushError.message : String(pushError);
              appendReportLine(runRoot, `- AppEndO-Release push failed: ${pushMessage}`);
              throw pushError;
            }
          }
          if (options.pushAppEndOHawiety) {
            try {
              runNpmScript('release:export-appendo-hawiety', {
                cwd: repoRoot,
                logPath: path.join(runRoot, 'logs', 'export-hawiety.log'),
              });
              const hawietySummary = pushAppEndOHawietyTree({ repoRoot });
              appendReportLine(runRoot, `- AppEndO-Hawiety: ${hawietySummary}`);
            } catch (hawietyError) {
              const hawietyMessage = hawietyError instanceof Error ? hawietyError.message : String(hawietyError);
              appendReportLine(runRoot, `- AppEndO-Hawiety push failed: ${hawietyMessage}`);
              throw hawietyError;
            }
          }
        }
        appendReportLine(runRoot, `- P8 complete — artifacts: \`${runRoot}\``);
        if (!options.dryRun && options.push && checkpoint.tagName) {
          pushRelease(repoRoot, checkpoint.tagName);
          appendReportLine(runRoot, `- pushed branch and tag ${checkpoint.tagName}`);
        }
        markPhase(checkpoint, phase);
        writeCheckpoint(runRoot, checkpoint);
      }
    }

    console.log(`Release cut OK: ${runRoot}`);
    console.log(`Report: ${path.join(runRoot, 'REPORT.md')}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    checkpoint.failedPhase = phases.find((p) => !phaseDone(checkpoint, p));
    checkpoint.lastError = message;
    writeCheckpoint(runRoot, checkpoint);
    appendReportLine(runRoot, `- FAILED: ${message}`);

    if (!options.dryRun && checkpoint.tagName) {
      deleteLocalTag(repoRoot, checkpoint.tagName);
      appendReportLine(runRoot, `- rolled back local tag ${checkpoint.tagName}`);
    }

    console.error(`Release cut failed: ${message}`);
    process.exit(1);
  }
}

void main();
