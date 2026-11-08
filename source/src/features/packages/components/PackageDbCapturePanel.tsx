import React, { useEffect, useState } from 'react';
import { FileCode2, Loader2, Package, Table2 } from 'lucide-react';
import { AppButton, FormField, UiCheckbox, UiInput, UiSelect, UiTextarea } from '../../../shared/ui';
import { useDataSourcesQuery } from '../../../shared/api/queries/data-sources';
import {
  captureSeedInserts,
  captureCmsModule,
  fetchCapturableSqlFileContent,
  fetchCapturableSqlFiles,
  type CapturableSqlFile,
  type CaptureSeedBlob,
  type CaptureHidRow,
  type CaptureCmsModuleResult,
} from '../lib/packageDbCaptureClient';
import { cmsModuleCaptureSummary } from '../lib/packageCmsModuleCapture';

type CapturePanelMode = 'none' | 'sql-file' | 'seed-data';

type PackageDbCapturePanelProps = {
  /** "Load SQL file" appends into whichever editor this panel instance sits above (Install or Uninstall step). */
  onLoadSqlFile: (sql: string) => void;
  /** "Capture seed data" always nets INSERT statements into the Install Scripts editor, regardless of which step triggered it. */
  onCaptureSeedInstall: (sql: string) => void;
  /** "Capture seed data" always nets the matching DELETE statement into the Uninstall Scripts editor. */
  onCaptureSeedUninstall: (sql: string) => void;
  /** Binary columns are packed as ZIP files, not as SQL literals. */
  onCaptureBlobs?: (blobs: CaptureSeedBlob[]) => void;
  /** Base Info ids captured for install-time HID rewrite. */
  onCaptureHidRows?: (rows: CaptureHidRow[]) => void;
  includeOptionalRecords?: boolean;
  onPackCmsModule?: (result: CaptureCmsModuleResult) => void;
};

export const PackageDbCapturePanel: React.FC<PackageDbCapturePanelProps> = ({
  onLoadSqlFile,
  onCaptureSeedInstall,
  onCaptureSeedUninstall,
  onCaptureBlobs,
  onCaptureHidRows,
  includeOptionalRecords = true,
  onPackCmsModule,
}) => {
  const [openPanel, setOpenPanel] = useState<CapturePanelMode>('none');

  const [sqlFiles, setSqlFiles] = useState<CapturableSqlFile[]>([]);
  const [sqlFilesLoading, setSqlFilesLoading] = useState(false);
  const [sqlFilesError, setSqlFilesError] = useState<string | null>(null);
  const [selectedSqlFile, setSelectedSqlFile] = useState('');
  const [loadingSqlFile, setLoadingSqlFile] = useState(false);

  const dataSourcesQuery = useDataSourcesQuery();
  const dataSources = dataSourcesQuery.data?.items ?? [];
  const [seedDataSourceId, setSeedDataSourceId] = useState('');
  const [seedTableName, setSeedTableName] = useState('');
  const [seedWhere, setSeedWhere] = useState('');
  const [seedOrderBy, setSeedOrderBy] = useState('');
  const [seedRelatedTables, setSeedRelatedTables] = useState('');
  const [seedParentColumn, setSeedParentColumn] = useState('parent_id');
  const [seedIncludeDescendants, setSeedIncludeDescendants] = useState(false);
  const [seedIncludeBinary, setSeedIncludeBinary] = useState(true);
  const [seedLimit, setSeedLimit] = useState('0');
  const [seedCapturing, setSeedCapturing] = useState(false);
  const [cmsPacking, setCmsPacking] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [seedResultSummary, setSeedResultSummary] = useState<string | null>(null);

  useEffect(() => {
    if (dataSources.length > 0 && !seedDataSourceId) {
      const defaultSource = dataSources.find((item) => item.isDefault) ?? dataSources[0];
      if (defaultSource) setSeedDataSourceId(defaultSource.id);
    }
  }, [dataSources, seedDataSourceId]);

  const toggle = (panel: CapturePanelMode) => {
    setOpenPanel((current) => (current === panel ? 'none' : panel));
    if (panel === 'sql-file' && sqlFiles.length === 0 && !sqlFilesLoading) {
      setSqlFilesLoading(true);
      setSqlFilesError(null);
      fetchCapturableSqlFiles()
        .then((files) => setSqlFiles(files))
        .catch((error: unknown) => setSqlFilesError(error instanceof Error ? error.message : 'Failed to list SQL files.'))
        .finally(() => setSqlFilesLoading(false));
    }
  };

  const handleLoadSqlFile = async () => {
    if (!selectedSqlFile) return;
    setLoadingSqlFile(true);
    try {
      const content = await fetchCapturableSqlFileContent(selectedSqlFile);
      onLoadSqlFile(content);
    } catch (error) {
      setSqlFilesError(error instanceof Error ? error.message : 'Failed to load SQL file.');
    } finally {
      setLoadingSqlFile(false);
    }
  };

  const handleCaptureSeed = async () => {
    if (!seedDataSourceId || !seedTableName.trim()) return;
    setSeedCapturing(true);
    setSeedError(null);
    setSeedResultSummary(null);
    try {
      const relatedTables = seedRelatedTables
        .split(/[\s,]+/)
        .map((name) => name.trim())
        .filter(Boolean);
      const result = await captureSeedInserts({
        dataSourceId: seedDataSourceId,
        tableName: seedTableName.trim(),
        relatedTables: relatedTables.length > 0 ? relatedTables : undefined,
        where: seedWhere.trim() || undefined,
        orderBy: seedOrderBy.trim() || undefined,
        limit: Number(seedLimit) || 0,
        includeBinary: seedIncludeBinary,
        includeDescendants: seedIncludeDescendants,
        parentColumn: seedParentColumn.trim() || undefined,
      });
      onCaptureSeedInstall(result.installSql);
      if (result.uninstallSql.trim()) {
        onCaptureSeedUninstall(result.uninstallSql);
      }
      if (result.blobs.length > 0) {
        onCaptureBlobs?.(result.blobs);
      }
      if (result.hidRows.length > 0) {
        onCaptureHidRows?.(result.hidRows);
      }
      const blobNote = result.blobs.length > 0
        ? ` · ${result.blobs.length} file(s) packed into the ZIP`
        : '';
      const warningNote = result.warnings.length > 0 ? ` · ${result.warnings[0]}` : '';
      setSeedResultSummary(
        result.rowCount > 0
          ? `Captured ${result.rowCount} row(s) from ${result.tables.join(', ')} — appended to Install Scripts${result.uninstallSql.trim() ? ' and Uninstall Scripts' : ''}${blobNote}${warningNote}.`
          : 'No rows matched — nothing appended.',
      );
    } catch (error) {
      setSeedError(error instanceof Error ? error.message : 'Failed to capture seed data.');
    } finally {
      setSeedCapturing(false);
    }
  };

  const handlePackCmsModule = async () => {
    if (!seedDataSourceId || !onPackCmsModule) return;
    setCmsPacking(true);
    setSeedError(null);
    setSeedResultSummary(null);
    try {
      const result = await captureCmsModule({
        dataSourceId: seedDataSourceId,
        includeOptionalRecords,
      });
      onPackCmsModule(result);
      setSeedResultSummary(cmsModuleCaptureSummary(result));
    } catch (error) {
      setSeedError(error instanceof Error ? error.message : 'Failed to pack the CMS module.');
    } finally {
      setCmsPacking(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50/70 px-3 py-2">
      <div className="flex items-center gap-2">
        <AppButton intent="utility" size="sm" onClick={() => toggle('sql-file')}>
          <FileCode2 className="h-3.5 w-3.5" />
          Load SQL file…
        </AppButton>
        <AppButton intent="utility" size="sm" onClick={() => toggle('seed-data')}>
          <Table2 className="h-3.5 w-3.5" />
          Capture seed data…
        </AppButton>
        {onPackCmsModule ? (
          <AppButton
            intent="utility"
            size="sm"
            disabled={!seedDataSourceId || cmsPacking}
            onClick={handlePackCmsModule}
          >
            {cmsPacking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Package className="h-3.5 w-3.5" />}
            Pack CMS module
          </AppButton>
        ) : null}
        <span className="text-[11px] text-slate-500">
          Appends to the editor below — it does not replace existing content.
        </span>
      </div>

      {openPanel === 'sql-file' && (
        <div className="flex flex-col gap-2 rounded-md border border-slate-200 bg-white p-2.5">
          <p className="text-[11px] text-slate-500">
            Load an existing hand-written SQL file from <code>scripts/**</code> (e.g. a package's
            <code>db/install/*.sql</code> or <code>db/uninstall/*.sql</code>) instead of retyping DDL.
          </p>
          {sqlFilesLoading ? (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading SQL files…
            </div>
          ) : sqlFilesError ? (
            <p className="text-xs text-rose-600">{sqlFilesError}</p>
          ) : (
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <FormField label="SQL file">
                  <UiSelect
                    value={selectedSqlFile}
                    onChange={(e) => setSelectedSqlFile(e.target.value)}
                    ariaLabel="SQL file"
                  >
                    <option value="">Select a file…</option>
                    {sqlFiles.map((file) => (
                      <option key={file.path} value={file.path}>{file.path}</option>
                    ))}
                  </UiSelect>
                </FormField>
              </div>
              <AppButton
                intent="primary"
                size="sm"
                disabled={!selectedSqlFile || loadingSqlFile}
                onClick={handleLoadSqlFile}
              >
                {loadingSqlFile ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Load
              </AppButton>
            </div>
          )}
        </div>
      )}

      {openPanel === 'seed-data' && (
        <div className="flex flex-col gap-2 rounded-md border border-slate-200 bg-white p-2.5">
          <p className="text-[11px] text-slate-500">
            Runs a read-only query against a real data source and turns matching rows into
            literal <code>INSERT</code> statements. Related tables follow foreign keys.
            Binary columns (<code>file</code>, <code>file_xs</code>, BYTEA) are stored as ZIP
            files and restored on install. Limit <code>0</code> means all matching rows.
          </p>
          <div className="flex flex-wrap gap-1.5">
            <AppButton
              intent="utility"
              size="sm"
              onClick={() => {
                setSeedTableName('base_info');
                setSeedRelatedTables('');
                setSeedParentColumn('parent_id');
                setSeedIncludeDescendants(true);
                setSeedIncludeBinary(false);
                setSeedWhere("title = 'CMS'");
                setSeedLimit('0');
              }}
            >
              CMS vocab
            </AppButton>
            <AppButton
              intent="utility"
              size="sm"
              onClick={() => {
                setSeedTableName('cms_contents');
                setSeedRelatedTables('cms_content_revisions\ncms_content_assets\ncms_content_tags\ncms_content_relations\ncms_settings');
                setSeedParentColumn('parent_content_id');
                setSeedIncludeDescendants(true);
                setSeedIncludeBinary(true);
                setSeedWhere('');
                setSeedLimit('0');
              }}
            >
              CMS content + files
            </AppButton>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <FormField label="Data source">
              <UiSelect
                value={seedDataSourceId}
                onChange={(e) => setSeedDataSourceId(e.target.value)}
                ariaLabel="Data source"
              >
                {dataSources.map((source) => (
                  <option key={source.id} value={source.id}>{source.name} ({source.type})</option>
                ))}
              </UiSelect>
            </FormField>
            <FormField label="Table name">
              <UiInput
                size="sm"
                autoDir={false}
                value={seedTableName}
                onChange={(e) => setSeedTableName(e.target.value)}
                placeholder="base_info"
                ariaLabel="Table name"
              />
            </FormField>
          </div>
          <FormField label="Related tables (optional)">
            <UiTextarea
              value={seedRelatedTables}
              onChange={(e) => setSeedRelatedTables(e.target.value)}
              placeholder="cms_content_assets&#10;cms_content_tags"
              rows={2}
              ariaLabel="Related tables"
            />
          </FormField>
          <FormField label="WHERE (optional)">
            <UiTextarea
              value={seedWhere}
              onChange={(e) => setSeedWhere(e.target.value)}
              placeholder="parent_id = '101' OR id = '101'"
              rows={2}
              ariaLabel="WHERE clause"
            />
          </FormField>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <FormField label="ORDER BY (optional)">
              <UiInput
                size="sm"
                autoDir={false}
                value={seedOrderBy}
                onChange={(e) => setSeedOrderBy(e.target.value)}
                placeholder="view_order ASC"
                ariaLabel="ORDER BY clause"
              />
            </FormField>
            <FormField label="Parent column">
              <UiInput
                size="sm"
                autoDir={false}
                value={seedParentColumn}
                onChange={(e) => setSeedParentColumn(e.target.value)}
                placeholder="parent_id"
                ariaLabel="Parent column"
              />
            </FormField>
            <FormField label="Row limit (0 = all)">
              <UiInput
                size="sm"
                autoDir={false}
                type="number"
                value={seedLimit}
                onChange={(e) => setSeedLimit(e.target.value)}
                ariaLabel="Row limit"
              />
            </FormField>
          </div>
          <div className="flex flex-col gap-1.5">
            <UiCheckbox
              checked={seedIncludeDescendants}
              onChange={(event) => setSeedIncludeDescendants(event.target.checked)}
              ariaLabel="Include descendant rows"
            >
              Include descendant rows
            </UiCheckbox>
            <UiCheckbox
              checked={seedIncludeBinary}
              onChange={(event) => setSeedIncludeBinary(event.target.checked)}
              ariaLabel="Include binary columns"
            >
              Include binary columns (files)
            </UiCheckbox>
          </div>
          {seedError && <p className="text-xs text-rose-600">{seedError}</p>}
          {seedResultSummary && <p className="text-xs text-emerald-600">{seedResultSummary}</p>}
          <div>
            <AppButton
              intent="primary"
              size="sm"
              disabled={!seedDataSourceId || !seedTableName.trim() || seedCapturing}
              onClick={handleCaptureSeed}
            >
              {seedCapturing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Capture
            </AppButton>
          </div>
        </div>
      )}
    </div>
  );
};
