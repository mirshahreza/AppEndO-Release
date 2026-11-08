import React, { useEffect, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { AppButton, CreateEditModalShell } from '../../../shared/ui';
import { fetchPackageDeploymentPreview } from '../../../shared/api/queries/packages';
import type { PackageRow } from '../types';
import type { PluginRegistryProposalPreview } from '../../../shared/api/contracts/package-manifest/deploymentPreview';

export type PluginDeploymentProposalModalProps = {
  target: PackageRow | null;
  isApplying: boolean;
  applyErrors?: string[];
  onClose: () => void;
  onConfirm: () => void;
};

export const PackageDeploymentProposalModal: React.FC<PluginDeploymentProposalModalProps> = ({
  target,
  isApplying,
  applyErrors = [],
  onClose,
  onConfirm,
}) => {
  const [preview, setPreview] = useState<PluginRegistryProposalPreview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!target) {
      setPreview(null);
      setErrors([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setErrors([]);
    setPreview(null);

    void fetchPackageDeploymentPreview(target.packageId)
      .then((data) => {
        if (!cancelled) {
          setPreview(data);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setErrors([(error as Error).message || 'Failed to load deployment preview.']);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [target]);

  if (!target) return null;

  return (
    <CreateEditModalShell
      size="3xl"
      title="Apply Platform Deployment"
      onClose={onClose}
      onBackdropClick={onClose}
      footer={(
        <>
          <AppButton intent="cancel" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </AppButton>
          <AppButton
            intent="confirm"
            onClick={() => void onConfirm()}
            disabled={isApplying || isLoading || !preview || errors.length > 0}
          >
            {isApplying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Apply Deployment
          </AppButton>
        </>
      )}
    >
      <div className="flex min-h-0 flex-col gap-3 overflow-auto">
          <div className="text-xs text-slate-600">
            <span className="font-semibold text-slate-700">{target.displayName}</span>
            <span className="mx-1">-</span>
            <span>version {target.version}</span>
          </div>

          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {preview?.schema === 'package-ui-routes-preview'
              ? 'This extension install is waiting for platform route bindings. Review the proposed page modules and routes below, then apply to register them on the selected mount.'
              : 'This vertical-app install is waiting for platform registry changes. Review the deployment blueprint below, then apply to create mount, shell, and route bindings.'}
          </div>

          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-slate-500 py-6 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading deployment preview...
            </div>
          )}

          {errors.length > 0 && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {errors.map((issue) => (
                <div key={issue}>{issue}</div>
              ))}
            </div>
          )}

          {applyErrors.length > 0 && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              <div className="font-semibold mb-1">Apply failed:</div>
              {applyErrors.map((issue) => (
                <div key={issue}>{issue}</div>
              ))}
            </div>
          )}

          {preview && (
            <pre className="rounded-md border border-slate-200 bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-700 overflow-auto max-h-[45vh]">
              {JSON.stringify(preview, null, 2)}
            </pre>
          )}
        </div>
    </CreateEditModalShell>
  );
};
