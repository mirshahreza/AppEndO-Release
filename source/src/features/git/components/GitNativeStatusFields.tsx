import React from 'react';
import type { GitStatusPayload } from '../../../shared/api/contracts/git/types';

type GitNativeStatusFieldsProps = {
  status: GitStatusPayload | undefined;
};

const ReadOnlyField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex flex-col gap-[2px]">
    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider ps-[4px]">{label}</span>
    <div className="h-8 flex items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 break-all">
      {value || '—'}
    </div>
  </div>
);

export const GitNativeStatusFields: React.FC<GitNativeStatusFieldsProps> = ({ status }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div className="md:col-span-2 pt-2">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider ps-[4px]">
        Native repository (read-only)
      </p>
      <p className="mt-1 text-xs text-slate-500 ps-[4px]">
        Remote and branch are managed in <span className="font-mono">.git</span> — use Git Config to change them.
      </p>
    </div>

    <ReadOnlyField
      label="Remote URL"
      value={status?.remoteUrl?.trim() ?? ''}
    />
    <ReadOnlyField
      label="Default branch"
      value={status?.defaultBranch?.trim() ?? ''}
    />
    <ReadOnlyField
      label="Current branch"
      value={status?.currentBranch?.trim() ?? ''}
    />
    <ReadOnlyField
      label="Remote name"
      value={status?.remoteName?.trim() ?? ''}
    />
  </div>
);
