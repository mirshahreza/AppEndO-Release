import React, { useMemo, useState } from 'react';
import { Code2, Download, Loader2 } from 'lucide-react';
import type { DataSourceRecord } from '../../../shared/api/contracts/data-sources/types';
import { AppButton, CreateEditModalShell, QueryErrorPanel } from '../../../shared/ui';
import { formatDbEnrichmentError, useDbEnrichmentDocumentationQuery } from '../../../shared/api/queries/dbEnrichment';
import {
  buildDbDocumentationFilename,
  buildDbDocumentationHtml,
  buildDbDocumentationMarkdown,
  downloadTextFile,
} from '../utils/dbDocumentationBuilder';

type GenerateDocumentationModalProps = {
  dataSource: DataSourceRecord | null;
  onClose: () => void;
};

type PreviewFormat = 'html' | 'markdown';

export const GenerateDocumentationModal: React.FC<GenerateDocumentationModalProps> = ({
  dataSource,
  onClose,
}) => {
  const dataSourceId = dataSource?.id ?? '';
  const open = Boolean(dataSource);
  const [format, setFormat] = useState<PreviewFormat>('html');

  const documentationQuery = useDbEnrichmentDocumentationQuery(dataSourceId, { enabled: open });
  const documentation = documentationQuery.data;

  const html = useMemo(() => (documentation ? buildDbDocumentationHtml(documentation) : ''), [documentation]);
  const markdown = useMemo(() => (documentation ? buildDbDocumentationMarkdown(documentation) : ''), [documentation]);

  if (!open || !dataSource) {
    return null;
  }

  const handleDownloadHtml = () => {
    if (!documentation) return;
    downloadTextFile(html, buildDbDocumentationFilename(documentation, 'html'), 'text/html;charset=utf-8');
  };

  const handleDownloadMarkdown = () => {
    if (!documentation) return;
    downloadTextFile(markdown, buildDbDocumentationFilename(documentation, 'md'), 'text/markdown;charset=utf-8');
  };

  return (
    <CreateEditModalShell
      size="maximized"
      title={<span className="truncate">{`Documentation — "${dataSource.name}"`}</span>}
      ariaLabel={`Documentation for ${dataSource.name}`}
      gradient={false}
      onClose={onClose}
      onBackdropClick={onClose}
      bodyOuterClassName="flex min-h-0 flex-1 flex-col"
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
      headerExtra={documentation ? (
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          <button
            type="button"
            onClick={() => setFormat('html')}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${format === 'html' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            HTML preview
          </button>
          <button
            type="button"
            onClick={() => setFormat('markdown')}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${format === 'markdown' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Markdown
          </button>
        </div>
      ) : null}
      footer={(
        <div className="flex items-center gap-2">
          <AppButton intent="cancel" size="sm" onClick={onClose}>
            Close
          </AppButton>
          <AppButton
            intent="secondary"
            size="sm"
            disabled={!documentation}
            onClick={handleDownloadMarkdown}
          >
            <Code2 className="h-3.5 w-3.5" />
            Save as Markdown
          </AppButton>
          <AppButton
            intent="primary"
            size="sm"
            disabled={!documentation}
            onClick={handleDownloadHtml}
          >
            <Download className="h-3.5 w-3.5" />
            Save as HTML
          </AppButton>
        </div>
      )}
    >
      {documentationQuery.isLoading ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
          Gathering schema knowledge and building the documentation…
        </div>
      ) : documentationQuery.isError ? (
        <div className="p-4">
          <QueryErrorPanel
            message="Failed to build documentation."
            detail={formatDbEnrichmentError(documentationQuery.error)}
            onRetry={() => { void documentationQuery.refetch(); }}
            isRetrying={documentationQuery.isFetching}
          />
        </div>
      ) : format === 'html' ? (
        <iframe
          title={`Documentation preview for ${dataSource.name}`}
          srcDoc={html}
          sandbox="allow-scripts"
          className="h-full min-h-0 w-full flex-1 border-0"
        />
      ) : (
        <pre className="h-full min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-700">
          {markdown}
        </pre>
      )}
    </CreateEditModalShell>
  );
};
