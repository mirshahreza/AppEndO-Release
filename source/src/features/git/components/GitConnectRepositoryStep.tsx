import React from 'react';
import { FolderGit2, Github } from 'lucide-react';
import { AppSurfaceBox } from '../../../shared/ui/AppSurfaceBox';
import { UiCheckboxChoice, UiInput, UiOptionCardGroup, UiSelect } from '../../../shared/ui';
import {
  REPO_VISIBILITY_OPTIONS,
  resolveGithubAccountLabel,
  resolveGithubOwner,
  resolveExistingRepoSyncOverrideMessage,
  buildGithubWebUrl,
  type GitConnectRepositoryState,
} from '../gitConnectRepository';
import type { GitSettingsFormState } from '../gitSettingsForm';

type GitConnectRepositoryStepProps = {
  form: GitSettingsFormState;
  repository: GitConnectRepositoryState;
  workspacePath: string;
  isRepository: boolean;
  onFormChange: (next: GitSettingsFormState) => void;
  onRepositoryChange: (next: GitConnectRepositoryState) => void;
  hasStoredAuth?: boolean;
};

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ps-[4px]">
    {children}
  </label>
);

export const GitConnectRepositoryStep: React.FC<GitConnectRepositoryStepProps> = ({
  form,
  repository,
  workspacePath,
  isRepository,
  onFormChange,
  onRepositoryChange,
  hasStoredAuth = false,
}) => {
  const canConnectToGithub = hasStoredAuth;
  const owner = resolveGithubOwner(form);
  const repoName = form.prRepo.trim();
  const githubRepoRef = owner && repoName ? `${owner}/${repoName}` : null;
  const githubRepoUrl = githubRepoRef ? buildGithubWebUrl(owner, repoName) : '';
  const syncOverrideMessage = resolveExistingRepoSyncOverrideMessage(
    repository.existingRepoSync,
    githubRepoRef,
    workspacePath,
  );

  const patchRepository = (patch: Partial<GitConnectRepositoryState>) => {
    onRepositoryChange({ ...repository, ...patch });
  };

  return (
    <div className="flex flex-col gap-4">
      <AppSurfaceBox tone="slate" title="Initialize a local Git repository">
        <p className="text-sm text-slate-600">
          AppEndO will use your workspace root as the local repository path.
        </p>
        <p className="mt-2 text-sm text-slate-600">
          After you complete the initial setup, refer to the{' '}
          <span className="font-mono text-xs text-slate-800">.gitignore</span>
          {' '}file in your workspace for finer control over which changes to track, keep, or ignore.
        </p>
        <p className="mt-2 break-all font-mono text-xs font-medium text-slate-800">
          {workspacePath || '—'}
        </p>
        {!isRepository ? (
          <p className="mt-2 ps-[4px] text-xs text-slate-500">
            A new Git repository will be created here when you save. A standard .gitignore will be applied automatically.
          </p>
        ) : null}
      </AppSurfaceBox>

      <AppSurfaceBox
        tone="indigo"
        headerExtra={(
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <UiCheckboxChoice
              id="git-connect-github"
              checked={repository.connectToGithub}
              disabled={!canConnectToGithub}
              onChange={(checked) => {
                if (!canConnectToGithub) {
                  return;
                }
                patchRepository({ connectToGithub: checked });
              }}
            >
              <span className={canConnectToGithub ? 'text-sm font-medium text-slate-800' : 'text-sm font-medium text-slate-400'}>
                Connect to GitHub
              </span>
            </UiCheckboxChoice>
            {repository.connectToGithub ? (
              <>
                <div className="flex min-w-0 items-center gap-2 text-sm text-slate-700">
                  <Github className="size-4 shrink-0 text-slate-500" aria-hidden />
                  <span className="truncate">{resolveGithubAccountLabel(form)}</span>
                </div>
                <div className="ms-auto flex min-w-0 items-center gap-2">
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                    Owner
                  </span>
                  <span className="truncate text-sm font-medium text-slate-800">
                    {owner || '—'}
                  </span>
                </div>
              </>
            ) : null}
          </div>
        )}
      >
        {!canConnectToGithub ? (
          <p className="text-sm text-slate-500">
            Sign in on the previous steps to connect a GitHub remote.
          </p>
        ) : null}

        {repository.connectToGithub ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                <FieldLabel>Repository name</FieldLabel>
                <UiInput
                  value={form.prRepo}
                  onChange={(event) => onFormChange({ ...form, prRepo: event.target.value })}
                  placeholder="my-project"
                  ariaLabel="GitHub repository name"
                  size="sm"
                />
              </div>
              <div className="flex w-full shrink-0 flex-col gap-[2px] md:w-32">
                <FieldLabel>Default branch</FieldLabel>
                <UiInput
                  value={form.defaultBranch}
                  onChange={(event) => onFormChange({ ...form, defaultBranch: event.target.value })}
                  placeholder="main"
                  ariaLabel="Git default branch"
                  size="sm"
                />
              </div>
              <div className="flex w-full shrink-0 flex-col gap-[2px] md:w-36">
                <FieldLabel>Visibility</FieldLabel>
                <UiSelect
                  value={repository.repoVisibility}
                  onChange={(event) => patchRepository({
                    repoVisibility: event.target.value === 'public' ? 'public' : 'private',
                  })}
                  ariaLabel="GitHub repository visibility"
                  size="sm"
                >
                  {REPO_VISIBILITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </UiSelect>
              </div>
            </div>
            <div className="flex flex-col gap-[2px]">
              <FieldLabel>Description</FieldLabel>
              <UiInput
                value={repository.repoDescription}
                onChange={(event) => patchRepository({ repoDescription: event.target.value })}
                placeholder="Optional"
                ariaLabel="GitHub repository description"
                size="sm"
              />
            </div>
          </div>
        ) : null}
      </AppSurfaceBox>

      {repository.connectToGithub ? (
        <div className="flex flex-col gap-[2px]">
          <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">
              {githubRepoRef
                ? <>If <span className="font-mono normal-case">{githubRepoRef}</span> already exists on GitHub</>
                : 'If the GitHub repository already exists'}
            </p>
            <p className="mt-1 text-sm text-amber-900/90">
              {githubRepoRef ? (
                <>
                  These options apply only to the GitHub repository{' '}
                  {githubRepoUrl ? (
                    <a
                      href={githubRepoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-xs font-semibold text-amber-950 underline decoration-amber-400/80 underline-offset-2"
                    >
                      {githubRepoRef}
                    </a>
                  ) : (
                    <span className="font-mono text-xs font-semibold text-amber-950">{githubRepoRef}</span>
                  )}
                  . One side will be overwritten to match the other.
                </>
              ) : (
                'Enter a repository name above to see which GitHub repository will be affected.'
              )}
            </p>
            <UiOptionCardGroup
              value={repository.existingRepoSync}
              onChange={(next) => patchRepository({
                existingRepoSync: next === 'use_remote' ? 'use_remote' : 'use_workspace',
              })}
              className="mt-2"
              columns={2}
              ariaLabel="Existing repository sync preference"
              accentClassName="border-amber-300 bg-white"
              accentIconClassName="text-amber-800"
              options={[
                {
                  value: 'use_workspace',
                  title: 'Use this workspace',
                  icon: FolderGit2,
                  description: githubRepoRef ? (
                    <>
                      Force{' '}
                      <span className="font-mono text-xs font-semibold text-slate-700">{githubRepoRef}</span>
                      {' '}on GitHub to match your local files (remote history is overwritten).
                    </>
                  ) : (
                    'Push local changes to GitHub. The remote will match this workspace.'
                  ),
                },
                {
                  value: 'use_remote',
                  title: 'Use GitHub',
                  icon: Github,
                  description: githubRepoRef ? (
                    <>
                      Download{' '}
                      <span className="font-mono text-xs font-semibold text-slate-700">{githubRepoRef}</span>
                      {' '}and replace this workspace at{' '}
                      <span className="font-mono text-xs font-semibold text-slate-700">{workspacePath || 'your workspace root'}</span>
                      .
                    </>
                  ) : (
                    'Download the remote and replace this local workspace.'
                  ),
                },
              ]}
            />
          </div>
          {syncOverrideMessage ? (
            <p className="ps-[4px] text-sm font-bold text-rose-700">
              {syncOverrideMessage}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
