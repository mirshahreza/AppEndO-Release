import * as React from 'react';

const WORKSPACE_ASSET_UPLOAD_ENDPOINT = '/api/packages/builder/workspace-assets/upload';
const WORKSPACE_ASSET_URL_PREFIX = '/assets/workspace';
const WORKSPACE_ASSET_ALLOWED_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
]);

type RuntimeFileUploadItem = {
  id: string;
  name: string;
  size: number;
  previewUrl?: string;
  assetUrl?: string;
  status: 'uploading' | 'uploaded' | 'error';
  message?: string;
};

export type DesignerRuntimeFileUploadProps = React.HTMLAttributes<HTMLDivElement> & {
  accept?: string;
  multiple?: boolean;
  maxFileSizeMb?: number;
  maxFiles?: number;
  showPreview?: boolean;
  dragDropZone?: boolean;
  uploadDestination?: string;
  invalidTypeMessage?: string;
  invalidSizeMessage?: string;
  invalidCountMessage?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
};

const readBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const readNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const getFileExtension = (fileName: string): string => {
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : '';
};

const parseAcceptTokens = (accept: string | undefined): string[] =>
  (accept ?? '')
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length > 0);

const matchesAcceptToken = (file: File, token: string): boolean => {
  if (token === '*/*') {
    return true;
  }
  if (token.startsWith('.')) {
    return getFileExtension(file.name) === token;
  }
  if (token.endsWith('/*')) {
    const major = token.slice(0, -2);
    return file.type.toLowerCase().startsWith(`${major}/`);
  }
  return file.type.toLowerCase() === token;
};

const isWorkspaceAssetUploadDestination = (uploadDestination: string | undefined): boolean =>
  (uploadDestination ?? '').trim() === WORKSPACE_ASSET_UPLOAD_ENDPOINT;

const isAllowedByWorkspaceAssets = (file: File): boolean =>
  WORKSPACE_ASSET_ALLOWED_EXTENSIONS.has(getFileExtension(file.name));

const isAllowedByAccept = (file: File, accept: string | undefined): boolean => {
  const tokens = parseAcceptTokens(accept);
  if (tokens.length === 0) {
    return true;
  }
  return tokens.some((token) => matchesAcceptToken(file, token));
};

const isPreviewableImage = (file: File): boolean =>
  file.type.startsWith('image/') || /\.(png|jpe?g|gif|svg|webp|ico)$/i.test(file.name);

const formatFileSize = (size: number): string => {
  if (size < 1024) {
    return `${size} B`;
  }
  const kb = size / 1024;
  if (kb < 1024) {
    return `${Math.max(1, Math.round(kb))} KB`;
  }
  return `${(kb / 1024).toFixed(1)} MB`;
};

const fileUploadZoneBaseClass =
  'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-default-300 bg-default-50 p-6 text-center';

export const DesignerRuntimeFileUpload: React.FC<DesignerRuntimeFileUploadProps> = ({
  accept,
  multiple,
  maxFileSizeMb,
  maxFiles,
  showPreview = true,
  dragDropZone = true,
  uploadDestination = WORKSPACE_ASSET_UPLOAD_ENDPOINT,
  invalidTypeMessage = 'Selected file type is not allowed for this upload destination.',
  invalidSizeMessage = 'Selected file exceeds the allowed size limit.',
  invalidCountMessage = 'Too many files were selected.',
  className,
  style,
  onChange,
  ...divProps
}) => {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [items, setItems] = React.useState<RuntimeFileUploadItem[]>([]);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isDragActive, setIsDragActive] = React.useState(false);

  React.useEffect(() => () => {
    for (const item of items) {
      if (item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
    }
  }, [items]);

  const appendItems = React.useCallback((nextItems: RuntimeFileUploadItem[]) => {
    setItems((current) => {
      if (current.length === 0) {
        return nextItems;
      }
      return multiple ? [...current, ...nextItems] : nextItems;
    });
  }, [multiple]);

  const uploadSingleFile = React.useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(uploadDestination, {
      method: 'POST',
      body: formData,
    });
    const data = await response.json().catch(() => null) as {
      success?: boolean;
      error?: string;
      asset?: { path?: string };
    } | null;
    if (!response.ok || !data?.success) {
      throw new Error(data?.error || 'Failed to upload file.');
    }
    const assetPath = typeof data.asset?.path === 'string' ? data.asset.path.trim() : '';
    return assetPath.length > 0 ? `${WORKSPACE_ASSET_URL_PREFIX}/${assetPath}` : undefined;
  }, [uploadDestination]);

  const processFiles = React.useCallback(async (fileList: FileList | File[]) => {
    const selectedFiles = Array.from(fileList);
    if (selectedFiles.length === 0) {
      return;
    }

    const effectiveFiles = multiple ? selectedFiles : selectedFiles.slice(0, 1);
    const currentCount = multiple ? items.length : 0;
    if (typeof maxFiles === 'number' && maxFiles > 0 && currentCount + effectiveFiles.length > maxFiles) {
      setErrorMessage(invalidCountMessage);
      return;
    }

    for (const file of effectiveFiles) {
      if (!isAllowedByAccept(file, accept) || (isWorkspaceAssetUploadDestination(uploadDestination) && !isAllowedByWorkspaceAssets(file))) {
        setErrorMessage(invalidTypeMessage);
        return;
      }
      if (typeof maxFileSizeMb === 'number' && maxFileSizeMb > 0 && file.size > maxFileSizeMb * 1024 * 1024) {
        setErrorMessage(invalidSizeMessage);
        return;
      }
    }

    setErrorMessage(null);

    const nextItems = effectiveFiles.map<RuntimeFileUploadItem>((file, index) => ({
      id: `${Date.now()}-${index}-${file.name}`,
      name: file.name,
      size: file.size,
      previewUrl: showPreview && isPreviewableImage(file) ? URL.createObjectURL(file) : undefined,
      status: uploadDestination.trim().length > 0 ? 'uploading' : 'uploaded',
    }));
    appendItems(nextItems);

    if (uploadDestination.trim().length === 0) {
      return;
    }

    for (const [index, file] of effectiveFiles.entries()) {
      try {
        const assetUrl = await uploadSingleFile(file);
        setItems((current) => current.map((item) => (
          item.id === nextItems[index]?.id
            ? { ...item, status: 'uploaded', assetUrl, message: assetUrl ? 'Uploaded to workspace assets.' : undefined }
            : item
        )));
      } catch (error) {
        setItems((current) => current.map((item) => (
          item.id === nextItems[index]?.id
            ? { ...item, status: 'error', message: (error as Error).message || 'Failed to upload file.' }
            : item
        )));
      }
    }
  }, [
    accept,
    appendItems,
    invalidCountMessage,
    invalidSizeMessage,
    invalidTypeMessage,
    items.length,
    maxFileSizeMb,
    maxFiles,
    multiple,
    showPreview,
    uploadDestination,
    uploadSingleFile,
  ]);

  const handleInputChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(event);
    if (event.target.files) {
      void processFiles(event.target.files);
    }
    event.target.value = '';
  }, [onChange, processFiles]);

  return (
    <div {...divProps} className={className} style={style} data-designer-component="html.file-upload">
      <label
        className={`${fileUploadZoneBaseClass} ${dragDropZone ? 'cursor-pointer' : ''} ${isDragActive ? 'border-sky-400 bg-sky-50/70' : ''}`}
        onClick={() => {
          if (dragDropZone) {
            inputRef.current?.click();
          }
        }}
        onDragEnter={dragDropZone ? (event) => {
          event.preventDefault();
          setIsDragActive(true);
        } : undefined}
        onDragOver={dragDropZone ? (event) => {
          event.preventDefault();
          setIsDragActive(true);
        } : undefined}
        onDragLeave={dragDropZone ? (event) => {
          event.preventDefault();
          setIsDragActive(false);
        } : undefined}
        onDrop={dragDropZone ? (event) => {
          event.preventDefault();
          setIsDragActive(false);
          void processFiles(event.dataTransfer.files);
        } : undefined}
      >
        <svg aria-hidden="true" className="mx-auto h-8 w-8 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M12 16V4m0 0 7 7m-7-7L5 11" />
          <path d="M4 20h16" />
        </svg>
        <span className="mt-2 block text-sm font-medium text-slate-700">
          {dragDropZone ? 'Click to upload or drag and drop' : 'Click to upload'}
        </span>
        <span className="text-xs text-slate-500">
          {typeof maxFileSizeMb === 'number' && maxFileSizeMb > 0
            ? `Maximum file size: ${maxFileSizeMb} MB`
            : 'Files upload when connected to a supported storage endpoint.'}
        </span>
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept={accept}
          multiple={readBoolean(multiple, false)}
          onChange={handleInputChange}
        />
      </label>
      {errorMessage ? (
        <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {errorMessage}
        </div>
      ) : null}
      {readBoolean(showPreview, true) && items.length > 0 ? (
        <div className="mt-2 flex flex-col gap-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs">
              {item.previewUrl ? (
                <img src={item.previewUrl} alt={item.name} className="h-10 w-10 rounded border border-slate-100 object-cover" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded border border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase text-slate-400">
                  File
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-slate-700">{item.name}</div>
                <div className="text-slate-500">{formatFileSize(item.size)}</div>
                {item.assetUrl ? (
                  <div className="truncate font-mono text-[10px] text-slate-500">{item.assetUrl}</div>
                ) : null}
                {item.message ? (
                  <div className={item.status === 'error' ? 'text-rose-600' : 'text-emerald-600'}>{item.message}</div>
                ) : null}
              </div>
              <span className={item.status === 'error' ? 'text-rose-600' : item.status === 'uploading' ? 'text-sky-600' : 'text-emerald-600'}>
                {item.status === 'uploading' ? 'Uploading…' : item.status === 'uploaded' ? 'Ready' : 'Error'}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export const resolveRuntimeFileUploadProps = (
  props: Record<string, unknown>,
): DesignerRuntimeFileUploadProps => ({
  accept: typeof props.accept === 'string' ? props.accept : undefined,
  multiple: readBoolean(props.multiple, false),
  maxFileSizeMb: readNumber(props.maxFileSizeMb),
  maxFiles: readNumber(props.maxFiles),
  showPreview: readBoolean(props.showPreview, true),
  dragDropZone: readBoolean(props.dragDropZone, true),
  uploadDestination: typeof props.uploadDestination === 'string' ? props.uploadDestination : WORKSPACE_ASSET_UPLOAD_ENDPOINT,
  invalidTypeMessage: typeof props.invalidTypeMessage === 'string' ? props.invalidTypeMessage : undefined,
  invalidSizeMessage: typeof props.invalidSizeMessage === 'string' ? props.invalidSizeMessage : undefined,
  invalidCountMessage: typeof props.invalidCountMessage === 'string' ? props.invalidCountMessage : undefined,
});
