import * as React from 'react';
import { FileImage, FileUp, RotateCw, Trash2, UploadCloud, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { AppButton } from '../AppButton';
import { UiImageUploadField } from '../UiImageUploadField';

export type FileMediaInputPreset = 'button' | 'drop-zone' | 'image' | 'avatar' | 'queue';
export type FileMediaInputState =
  | 'default'
  | 'dragging'
  | 'rejected'
  | 'uploading'
  | 'success'
  | 'error';
export type FileMediaQueueAction = 'retry' | 'cancel' | 'remove';

export type FileMediaInputProps = {
  preset: FileMediaInputPreset;
  files: File[];
  onFilesChange: (files: File[]) => void;
  state?: FileMediaInputState;
  onStateChange?: (state: FileMediaInputState) => void;
  multiple?: boolean;
  accept?: string;
  maxCount?: number;
  maxSizeMb?: number;
  showPreview?: boolean;
  queueActions?: readonly FileMediaQueueAction[];
  enableImageEditor?: boolean;
  enableAiPanel?: boolean;
  openEditorOnPick?: boolean;
};

const matchesAccept = (file: File, accept?: string): boolean => {
  if (!accept || accept === '*/*') return true;
  return accept.split(',').some((rule) => {
    const normalized = rule.trim().toLowerCase();
    if (normalized.endsWith('/*')) return file.type.toLowerCase().startsWith(normalized.slice(0, -1));
    if (normalized.startsWith('.')) return file.name.toLowerCase().endsWith(normalized);
    return file.type.toLowerCase() === normalized;
  });
};

export const normalizeFileMediaSelection = (
  incoming: readonly File[],
  options: { multiple: boolean; accept?: string; maxCount: number; maxSizeMb: number },
): { files: File[]; rejected: boolean } => {
  const maxBytes = options.maxSizeMb * 1024 * 1024;
  const accepted = incoming.filter((file) => matchesAccept(file, options.accept) && file.size <= maxBytes);
  const maxCount = options.multiple ? options.maxCount : 1;
  return {
    files: accepted.slice(0, maxCount),
    rejected: accepted.length !== incoming.length || accepted.length > maxCount,
  };
};

const FileMediaInputImagePreset: React.FC<FileMediaInputProps> = ({
  preset,
  files,
  onFilesChange,
  onStateChange,
  accept,
  maxSizeMb = 10,
  enableImageEditor = true,
  enableAiPanel = true,
  openEditorOnPick = false,
}) => (
  <UiImageUploadField
    value={files[0] ?? null}
    onChange={(file) => {
      onFilesChange(file ? [file] : []);
      onStateChange?.(file ? 'success' : 'default');
    }}
    accept={accept ?? 'image/*'}
    shape={preset === 'avatar' ? 'circle' : 'rectangle'}
    maxSizeMb={maxSizeMb}
    enableImageEditor={enableImageEditor}
    enableAiPanel={enableAiPanel}
    openEditorOnPick={openEditorOnPick}
    onError={() => onStateChange?.('rejected')}
  />
);

const FileMediaInputCore: React.FC<FileMediaInputProps> = ({
  preset,
  files,
  onFilesChange,
  state = 'default',
  onStateChange,
  multiple = false,
  accept,
  maxCount = 5,
  maxSizeMb = 10,
  showPreview = true,
  queueActions = ['remove'],
}) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string>();

  React.useEffect(() => {
    const image = files.find((file) => file.type.startsWith('image/'));
    if (!image) {
      setPreviewUrl(undefined);
      return undefined;
    }
    const url = URL.createObjectURL(image);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [files]);

  React.useEffect(() => {
    const normalized = normalizeFileMediaSelection(files, {
      multiple,
      accept,
      maxCount,
      maxSizeMb,
    });
    const changed = normalized.files.length !== files.length
      || normalized.files.some((file, index) => file !== files[index]);
    if (changed) {
      onFilesChange(normalized.files);
      onStateChange?.('rejected');
    }
  }, [accept, files, maxCount, maxSizeMb, multiple, onFilesChange, onStateChange]);

  const receiveFiles = (incoming: FileList | readonly File[] | null) => {
    if (!incoming) return;
    const result = normalizeFileMediaSelection(Array.from(incoming), {
      multiple,
      accept,
      maxCount,
      maxSizeMb,
    });
    onFilesChange(result.files);
    onStateChange?.(result.rejected ? 'rejected' : 'success');
  };

  const removeFile = (file: File) => {
    onFilesChange(files.filter((candidate) => candidate !== file));
    onStateChange?.('default');
  };

  const chooseButton = (
    <AppButton intent="primary" size="sm" onClick={() => inputRef.current?.click()}>
      <FileUp className="h-3.5 w-3.5" /> Choose files
    </AppButton>
  );

  return (
    <div className="w-full max-w-2xl" data-file-media-input={preset}>
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        multiple={multiple}
        accept={accept}
        onChange={(event) => {
          receiveFiles(event.target.files);
          event.target.value = '';
        }}
        aria-label="Choose local files"
      />

      {preset === 'button' ? (
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4">
          {chooseButton}
          <span className="text-xs text-slate-500">
            {files.length ? `${files.length} selected` : `Up to ${maxCount} files, ${maxSizeMb} MB each`}
          </span>
        </div>
      ) : (
        <section
          className={cn(
            'rounded-xl border-2 border-dashed bg-white p-6 text-center',
            state === 'dragging' ? 'border-emerald-500 bg-emerald-50/40' : 'border-emerald-300',
            (state === 'rejected' || state === 'error') && 'border-rose-300 bg-rose-50/30',
            state === 'success' && 'border-emerald-400',
          )}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            receiveFiles(event.dataTransfer.files);
          }}
        >
          {showPreview && previewUrl ? (
            <img
              src={previewUrl}
              alt="Selected local file preview"
              className="mx-auto mb-4 h-32 w-48 rounded-lg object-cover"
            />
          ) : (
            <UploadCloud className="mx-auto mb-3 h-9 w-9 text-emerald-600" />
          )}
          <h2 className="text-base font-bold text-slate-900">
            {state === 'rejected'
              ? 'Some files were rejected'
              : state === 'uploading'
                ? 'Upload in progress'
                : state === 'error'
                  ? 'Upload failed'
                  : 'Choose files for this record'}
          </h2>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
            Files stay in this browser preview. Nothing is uploaded. Maximum {maxCount} files, {maxSizeMb} MB each.
          </p>
          <div className="mt-4">{chooseButton}</div>
        </section>
      )}

      {preset === 'queue' && files.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-500">
          No files selected
        </div>
      ) : null}

      {files.length > 0 ? (
        <div className="mt-3 space-y-2">
          {files.map((file, index) => (
            <div key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <FileImage className="h-5 w-5 text-emerald-600" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">{file.name}</p>
                <p className="text-xs text-slate-500">{Math.max(1, Math.round(file.size / 1024))} KB · {state}</p>
              </div>
              {queueActions.includes('retry') ? (
                <AppButton aria-label="Retry file" intent="utility" size="sm" onClick={() => onStateChange?.('uploading')}>
                  <RotateCw className="h-3.5 w-3.5" />
                </AppButton>
              ) : null}
              {queueActions.includes('cancel') ? (
                <AppButton aria-label="Cancel file" intent="utility" size="sm" onClick={() => removeFile(file)}>
                  <X className="h-3.5 w-3.5" />
                </AppButton>
              ) : null}
              {queueActions.includes('remove') ? (
                <AppButton aria-label="Remove file" intent="destructive-soft" size="sm" onClick={() => removeFile(file)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </AppButton>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export const FileMediaInput: React.FC<FileMediaInputProps> = (props) => {
  if (props.preset === 'image' || props.preset === 'avatar') {
    return <FileMediaInputImagePreset {...props} />;
  }
  return <FileMediaInputCore {...props} />;
};
