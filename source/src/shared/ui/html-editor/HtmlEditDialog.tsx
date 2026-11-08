import React, { useEffect, useState } from 'react';
import { Save, X } from 'lucide-react';
import { sanitizeDesignerHtml } from '../../../domain/component-designer/sanitizeDesignerHtml';
import { AppButton } from '../AppButton';
import { CreateEditModalShell, type CreateEditModalSize } from '../CreateEditModalShell';
import {
  CONTENT_EDITOR_DIALOG_DEFAULT_SIZE,
  resolveContentEditorDialogShellClass,
} from '../surfaceClasses';
import { HtmlEditor } from './HtmlEditor';
import type { HtmlEditorMode, HtmlEditorPreviewDevice } from './types';

export type HtmlEditDialogProps = {
  open: boolean;
  title: string;
  initialValue: string;
  onSave: (value: string) => void;
  onClose: () => void;
  size?: CreateEditModalSize;
  shellClassName?: string;
  placeholder?: string;
  defaultMode?: HtmlEditorMode;
  defaultPreviewDevice?: HtmlEditorPreviewDevice;
};

const HtmlEditDialogBody: React.FC<HtmlEditDialogProps> = ({
  title,
  initialValue,
  onSave,
  onClose,
  size = CONTENT_EDITOR_DIALOG_DEFAULT_SIZE,
  shellClassName,
  placeholder = 'Write HTML…',
  defaultMode = 'visual',
  defaultPreviewDevice = 'fluid',
}) => {
  const [draft, setDraft] = useState(initialValue);

  useEffect(() => {
    setDraft(initialValue);
  }, [initialValue]);

  const handleSave = () => {
    onSave(sanitizeDesignerHtml(draft));
    onClose();
  };

  return (
    <CreateEditModalShell
      size={size}
      title={title}
      gradient={false}
      onClose={onClose}
      onBackdropClick={onClose}
      bodyOuterClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden !p-0"
      shellClassName={resolveContentEditorDialogShellClass(size, shellClassName)}
      footer={(
        <div className="flex justify-end gap-2">
          <AppButton intent="secondary" size="sm" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
            Close
          </AppButton>
          <AppButton intent="primary" size="sm" onClick={handleSave}>
            <Save className="h-3.5 w-3.5" />
            Save
          </AppButton>
        </div>
      )}
    >
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden p-2" data-floating-panel-drag-exclude>
        <HtmlEditor
          value={draft}
          onChange={setDraft}
          editorHeight="100%"
          placeholder={placeholder}
          defaultMode={defaultMode}
          defaultPreviewDevice={defaultPreviewDevice}
          enableCodeBlock
          enableTextDirection
          className="min-h-0 flex-1"
        />
      </div>
    </CreateEditModalShell>
  );
};

export const HtmlEditDialog: React.FC<HtmlEditDialogProps> = (props) => {
  if (!props.open) {
    return null;
  }

  return <HtmlEditDialogBody {...props} />;
};
