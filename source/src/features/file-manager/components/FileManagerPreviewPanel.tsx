import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { File, FileImage, FolderOpen, Pencil, Save } from 'lucide-react';
import { MonacoEditorPanel } from '../../server-functions/components/MonacoEditorPanel';
import { buildFileManagerRawUrl } from '../../../shared/api/queries/file-manager';
import { AppButton, LoadingSpinner, QueryErrorPanel } from '../../../shared/ui';
import { ImageEditorSaveDialog } from '../../../shared/ui/image-editor/ImageEditorSaveDialog';
import { formatFileManagerBytes } from '../constants';
import type { FileManagerPageModel } from '../hooks/useFileManagerPage';
import { resolveFileManagerImageExportFormat } from '../imageEditorExport';
import { isFileManagerMarkdownLanguage } from '../markdownPreview';
import {
  isFileManagerPlainTextLanguage,
  resolveFileManagerPreviewDirection,
  type FileManagerPreviewDirectionOverride,
} from '../textPreview';
import { FileManagerMarkdownPreview } from './FileManagerMarkdownPreview';
import { FileManagerPreviewDirectionControl } from './FileManagerPreviewDirectionControl';
import { FileManagerPreviewHeader } from './FileManagerPreviewHeader';
import { FileManagerPreviewZoomControl } from './FileManagerPreviewZoomControl';
import { FileManagerZipEditorPanel, shouldShowZipEditor } from './FileManagerZipEditorPanel';
import {
  fileManagerPreviewMonacoFontSize,
  fileManagerPreviewPlainTextFontSize,
  fileManagerPreviewZoomFactor,
} from '../previewZoom';
type FileManagerPreviewPanelProps = {
  page: FileManagerPageModel;
};

type FileManagerImagePreviewProps = {
  page: FileManagerPageModel;
  fileName: string;
  sizeBytes: number;
  imageSrc: string;
  imageZoom: number;
  exportFormat: ReturnType<typeof resolveFileManagerImageExportFormat>;
};

const FileManagerImagePreview: React.FC<FileManagerImagePreviewProps> = ({
  page,
  fileName,
  sizeBytes,
  imageSrc,
  imageZoom,
  exportFormat,
}) => {
  const [editorOpen, setEditorOpen] = useState(false);

  useEffect(() => {
    setEditorOpen(false);
  }, [imageSrc]);

  const handleEditorSave = useCallback(async (file: File) => {
    await page.handleSaveImage(file);
  }, [page]);

  return (
    <>
      <div className="flex h-full min-h-0 flex-1 flex-col bg-slate-50">
        <FileManagerPreviewHeader
          title={fileName}
          subtitle={formatFileManagerBytes(sizeBytes)}
          actions={(
            <>
              <FileManagerPreviewZoomControl
                value={page.previewZoom}
                onChange={page.setPreviewZoom}
              />
              <AppButton
                intent="utility"
                size="sm"
                disabled={page.isSavingImage}
                onClick={() => setEditorOpen(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </AppButton>
            </>
          )}
        />
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-6">
          <img
            src={imageSrc}
            alt={fileName}
            className="max-h-full max-w-full object-contain transition-transform"
            style={{ transform: `scale(${imageZoom})` }}
          />
        </div>
      </div>

      <ImageEditorSaveDialog
        open={editorOpen}
        title={`Edit ${fileName}`}
        initialSrc={imageSrc}
        initialFileName={fileName}
        exportFormat={exportFormat}
        onClose={() => setEditorOpen(false)}
        onSave={handleEditorSave}
      />
    </>
  );
};

type FileManagerTextContentProps = {
  page: FileManagerPageModel;
  fileName: string;
  language: string;
  sizeBytes: number;
  contentPath: string;
  textContent: string;
};

const FileManagerTextContent: React.FC<FileManagerTextContentProps> = ({
  page,
  fileName,
  language,
  sizeBytes,
  contentPath,
  textContent,
}) => {
  const isPlainText = isFileManagerPlainTextLanguage(language);
  const isMarkdown = isFileManagerMarkdownLanguage(language);
  const showDirectionControl = !page.isTextEditing && (isPlainText || isMarkdown);
  const [directionOverride, setDirectionOverride] = useState<FileManagerPreviewDirectionOverride>('auto');

  useEffect(() => {
    setDirectionOverride('auto');
  }, [contentPath]);

  const previewDirection = useMemo(
    () => resolveFileManagerPreviewDirection(textContent, directionOverride),
    [directionOverride, textContent],
  );

  const handleEnterEdit = () => {
    if (!page.isTextEditing) {
      page.enterTextEditMode();
    }
  };

  const previewSubtitle = page.isTextEditing
    ? page.isDirty ? 'Unsaved changes' : 'Editing'
    : 'Preview — double-click to edit';

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-white">
      <FileManagerPreviewHeader
        title={fileName}
        subtitle={`${formatFileManagerBytes(sizeBytes)} · ${previewSubtitle}`}
        actions={(
          <>
            <FileManagerPreviewZoomControl
              value={page.previewZoom}
              onChange={page.setPreviewZoom}
            />
            {showDirectionControl ? (
              <FileManagerPreviewDirectionControl
                value={directionOverride}
                onChange={setDirectionOverride}
              />
            ) : null}
            {page.isTextEditing && page.isDirty ? (
              <AppButton intent="primary" size="sm" disabled={page.isSaving} onClick={() => { void page.handleSave(); }}>
                <Save className="h-3.5 w-3.5" />
                Save
              </AppButton>
            ) : null}
          </>
        )}
      />

      {page.isTextEditing ? (
        <div className="min-h-0 flex-1">
          <MonacoEditorPanel
            documentKey={`${page.scope}:${contentPath}:edit`}
            language={language}
            value={page.editorValue}
            onChange={page.handleEditorChange}
            options={{
              readOnly: false,
              minimap: { enabled: false },
              fontSize: fileManagerPreviewMonacoFontSize(page.previewZoom),
              wordWrap: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        </div>
      ) : isMarkdown ? (
        <FileManagerMarkdownPreview
          content={textContent}
          direction={previewDirection}
          zoomPercent={page.previewZoom}
          onEnterEdit={handleEnterEdit}
        />
      ) : isPlainText ? (
        <pre
          dir={previewDirection}
          className="min-h-0 flex-1 cursor-text overflow-auto whitespace-pre-wrap break-words bg-slate-50 p-4 font-sans leading-relaxed text-slate-800"
          style={{ fontSize: fileManagerPreviewPlainTextFontSize(page.previewZoom) }}
          onDoubleClick={handleEnterEdit}
        >
          {textContent || ' '}
        </pre>
      ) : (
        <div className="min-h-0 flex-1 cursor-text" onDoubleClick={handleEnterEdit}>
          <MonacoEditorPanel
            documentKey={`${page.scope}:${contentPath}:preview`}
            language={language}
            value={textContent}
            onChange={() => {}}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: fileManagerPreviewMonacoFontSize(page.previewZoom),
              wordWrap: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        </div>
      )}
    </div>
  );
};

export const FileManagerPreviewPanel: React.FC<FileManagerPreviewPanelProps> = ({ page }) => {
  const content = page.contentQuery.data;
  const showZipEditor = shouldShowZipEditor(page);

  const imageSrc = useMemo(() => {
    if (!content || content.kind !== 'image' || !page.selectedPath) {
      return null;
    }

    if (content.encoding === 'base64' && content.content && content.mimeType) {
      return `data:${content.mimeType};base64,${content.content}`;
    }

    return buildFileManagerRawUrl(page.selectedPath, page.scope);
  }, [content, page.scope, page.selectedPath]);

  if (showZipEditor) {
    return <FileManagerZipEditorPanel page={page} />;
  }

  if (!page.selectedEntry) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center bg-slate-50 text-sm text-slate-500">
        Select a file or folder to preview.
      </div>
    );
  }

  if (page.selectedEntry.kind === 'directory') {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-slate-50 px-6 text-center">
        <FolderOpen className="h-10 w-10 text-sky-600" />
        <div>
          <p className="text-sm font-semibold text-slate-800">{page.selectedEntry.name}</p>
          <p className="mt-1 text-xs text-slate-500">Folder selected — choose a file to preview its contents.</p>
        </div>
      </div>
    );
  }

  if (page.contentQuery.isLoading) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center bg-white">
        <LoadingSpinner />
      </div>
    );
  }

  if (page.contentQuery.isError) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center bg-white p-4">
        <QueryErrorPanel message={page.contentQuery.error?.message ?? 'Failed to load preview.'} />
      </div>
    );
  }

  if (!content) {
    return null;
  }

  if (content.kind === 'image' && imageSrc) {
    const imageZoom = fileManagerPreviewZoomFactor(page.previewZoom);
    const imageExportFormat = resolveFileManagerImageExportFormat(
      page.selectedEntry.extension,
      content.mimeType,
    );

    return (
      <FileManagerImagePreview
        page={page}
        fileName={page.selectedEntry.name}
        sizeBytes={content.sizeBytes}
        imageSrc={imageSrc}
        imageZoom={imageZoom}
        exportFormat={imageExportFormat}
      />
    );
  }

  if (content.kind === 'text' || content.kind === 'empty') {
    return (
      <FileManagerTextContent
        page={page}
        fileName={page.selectedEntry.name}
        language={content.language ?? 'plaintext'}
        sizeBytes={content.sizeBytes}
        contentPath={content.path}
        textContent={page.isTextEditing ? page.editorValue : (content.content ?? '')}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-slate-50 px-6 text-center">
      {content.kind === 'binary' ? (
        <FileImage className="h-10 w-10 text-slate-500" />
      ) : (
        <File className="h-10 w-10 text-slate-500" />
      )}
      <div>
        <p className="text-sm font-semibold text-slate-800">{page.selectedEntry.name}</p>
        <p className="mt-1 text-xs text-slate-500">
          {formatFileManagerBytes(content.sizeBytes)} · Preview is not available for this file type.
        </p>
      </div>
    </div>
  );
};
