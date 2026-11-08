import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ListPlus, Loader2, Upload, X } from 'lucide-react';
import { AppButton, CreateEditModalShell, UiCheckbox, UiInput } from '../../../shared/ui';
import { APP_TABLE_GRID_HEADER_CELL_CLASS, APP_TABLE_GRID_ROW_CLASS, APP_TABLE_GRID_TABLE_CLASS } from '../../../shared/ui/surfaceClasses';
import { cn } from '../../../lib/utils';
import type { PackageWorkspaceAssetSummary } from '../../../shared/api/queries/packages';
import {
  fetchPackageWorkspaceAssets,
  uploadPackageWorkspaceAsset,
} from '../lib/packageWorkspaceAssetsClient';

export type PackageWorkspaceAssetsPickerDialogProps = {
  open: boolean;
  selectedPaths: readonly string[];
  onClose: () => void;
  onConfirm: (paths: string[]) => void;
  onNotify?: (type: 'success' | 'error', text: string) => void;
};

export const PackageWorkspaceAssetsPickerDialog: React.FC<PackageWorkspaceAssetsPickerDialogProps> = ({
  open,
  selectedPaths,
  onClose,
  onConfirm,
  onNotify,
}) => {
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<PackageWorkspaceAssetSummary[]>([]);
  const [rootPath, setRootPath] = useState('workspace/assets');
  const [urlPrefix, setUrlPrefix] = useState('/assets/workspace');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [checkedPaths, setCheckedPaths] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) {
      return;
    }

    setSearch('');
    const initialChecked: Record<string, boolean> = {};
    selectedPaths.forEach((path) => {
      initialChecked[path] = true;
    });
    setCheckedPaths(initialChecked);

    let cancelled = false;
    const loadAssets = async () => {
      setIsLoading(true);
      try {
        const result = await fetchPackageWorkspaceAssets();
        if (!cancelled) {
          setAssets(result.assets);
          setRootPath(result.rootPath);
          setUrlPrefix(result.urlPrefix);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          onNotify?.('error', (error as Error).message || 'Failed to load workspace assets.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadAssets();
    return () => {
      cancelled = true;
    };
  }, [onNotify, open, selectedPaths]);

  const filteredAssets = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) {
      return assets;
    }

    return assets.filter((asset) => (
      asset.path.toLowerCase().includes(needle)
      || asset.name.toLowerCase().includes(needle)
    ));
  }, [assets, search]);

  if (!open) {
    return null;
  }

  const handleUpload = async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) {
      return;
    }

    setIsUploading(true);
    try {
      const asset = await uploadPackageWorkspaceAsset(file);
      setAssets((current) => {
        const next = current.filter((item) => item.path !== asset.path);
        return [...next, asset].sort((left, right) => left.path.localeCompare(right.path));
      });
      setCheckedPaths((current) => ({ ...current, [asset.path]: true }));
      onNotify?.('success', `${asset.name} uploaded to workspace assets.`);
    } catch (error: unknown) {
      onNotify?.('error', (error as Error).message || 'Failed to upload workspace asset.');
    } finally {
      setIsUploading(false);
    }
  };

  const selectedCount = Object.values(checkedPaths).filter(Boolean).length;

  return (
    <CreateEditModalShell
      size="3xl"
      title="Workspace Assets"
      onClose={onClose}
      onBackdropClick={onClose}
      footer={(
        <>
          <AppButton intent="cancel" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </AppButton>
          <AppButton
            intent="primary"
            disabled={selectedCount === 0}
            onClick={() => {
              onConfirm(Object.entries(checkedPaths)
                .filter(([, checked]) => checked)
                .map(([path]) => path));
              onClose();
            }}
          >
            <ListPlus className="h-3.5 w-3.5" />
            Add Selected
          </AppButton>
        </>
      )}
    >
      <div className="flex flex-col gap-4">
        <p className="ps-[4px] text-sm text-slate-600">
          Select files from <span className="font-mono text-slate-700">{rootPath}</span>.
          Reference them in components as <span className="font-mono text-slate-700">{urlPrefix}/&lt;file&gt;</span>.
        </p>

        <div className="flex flex-wrap items-end gap-2">
          <div className="flex min-w-[14rem] flex-1 flex-col gap-[2px]">
            <label className="ps-[4px] text-xs font-semibold uppercase tracking-wider text-slate-600">Search</label>
            <UiInput
              size="sm"
              value={search}
              placeholder="File name or path"
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <input
            ref={uploadInputRef}
            type="file"
            className="hidden"
            accept=".png,.jpg,.jpeg,.gif,.svg,.webp,.ico,.woff,.woff2,.ttf,.eot"
            onChange={(event) => {
              void handleUpload(event.target.files);
              event.target.value = '';
            }}
          />
          <AppButton
            intent="utility"
            disabled={isUploading}
            onClick={() => uploadInputRef.current?.click()}
          >
            {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Upload
          </AppButton>
        </div>

        <div className="max-h-[420px] overflow-auto rounded-md border border-slate-200">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading workspace assets...
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-500">
              No files in the workspace assets folder yet. Upload a file to use it in components and packages.
            </div>
          ) : (
            <table className={cn(APP_TABLE_GRID_TABLE_CLASS, 'border-collapse')}>
              <thead className="sticky top-0 border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className={cn(APP_TABLE_GRID_HEADER_CELL_CLASS, 'w-10 py-2')} />
                  <th className={cn(APP_TABLE_GRID_HEADER_CELL_CLASS, 'py-2')}>File</th>
                  <th className={cn(APP_TABLE_GRID_HEADER_CELL_CLASS, 'py-2 w-[120px]')}>Size</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.map((asset) => (
                  <tr key={asset.path} className={APP_TABLE_GRID_ROW_CLASS}>
                    <td className="px-2 py-1.5">
                      <UiCheckbox
                        checked={Boolean(checkedPaths[asset.path])}
                        onChange={(event) => {
                          setCheckedPaths((current) => ({ ...current, [asset.path]: event.target.checked }));
                        }}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="font-medium text-slate-800">{asset.name}</div>
                      <div className="font-mono text-[11px] text-slate-500">{`${urlPrefix}/${asset.path}`}</div>
                    </td>
                    <td className="px-2 py-1.5 text-xs text-slate-600">
                      {Math.max(1, Math.round(asset.sizeBytes / 1024))} KB
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </CreateEditModalShell>
  );
};
