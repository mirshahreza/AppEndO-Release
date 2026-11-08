import React, { useMemo } from 'react';
import { renderFileManagerMarkdownHtml } from '../markdownPreview';
import { fileManagerPreviewPlainTextFontSize } from '../previewZoom';

type FileManagerMarkdownPreviewProps = {
  content: string;
  direction: 'ltr' | 'rtl';
  zoomPercent: number;
  onEnterEdit: () => void;
};

export const FileManagerMarkdownPreview: React.FC<FileManagerMarkdownPreviewProps> = ({
  content,
  direction,
  zoomPercent,
  onEnterEdit,
}) => {
  const html = useMemo(
    () => renderFileManagerMarkdownHtml(content),
    [content],
  );

  return (
    <div
      dir={direction}
      className="file-manager-markdown-preview min-h-0 flex-1 cursor-text overflow-auto bg-slate-50 p-4 leading-relaxed text-slate-800 [&_a]:text-sky-700 [&_a]:underline [&_blockquote]:mb-3 [&_blockquote]:border-s-slate-300 [&_blockquote]:border-s-4 [&_blockquote]:ps-3 [&_blockquote]:text-slate-600 [&_code]:rounded [&_code]:bg-slate-200/70 [&_code]:px-1 [&_h1]:mb-3 [&_h1]:mt-1 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-2 [&_h3]:text-base [&_h3]:font-semibold [&_hr]:my-4 [&_hr]:border-slate-200 [&_li]:mb-1 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:ps-5 [&_p]:mb-3 [&_pre]:mb-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-slate-900 [&_pre]:p-3 [&_pre]:text-xs [&_pre]:text-slate-100 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:ps-5"
      style={{ fontSize: fileManagerPreviewPlainTextFontSize(zoomPercent) }}
      onDoubleClick={onEnterEdit}
      dangerouslySetInnerHTML={{ __html: html || '<p>&nbsp;</p>' }}
    />
  );
};
