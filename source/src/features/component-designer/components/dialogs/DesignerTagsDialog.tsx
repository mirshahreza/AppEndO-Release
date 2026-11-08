import * as React from 'react';
import { Tags } from 'lucide-react';
import { DesignerDialog, DESIGNER_DIALOG_BODY_CLASS } from './DesignerDialog';
import { CatalogTagsField, type CatalogTagsFieldHandle } from '../../../../shared/ui';

export type DesignerTagsDialogProps = {
  open: boolean;
  error: string | null;
  componentName: string;
  tags: string[];
  suggestions?: readonly string[];
  onTagsChange: (tags: string[]) => void;
  onClose: () => void;
};

export const DesignerTagsDialog: React.FC<DesignerTagsDialogProps> = ({
  open,
  error,
  componentName,
  tags,
  suggestions = [],
  onTagsChange,
  onClose,
}) => {
  const tagsFieldRef = React.useRef<CatalogTagsFieldHandle>(null);

  const handleClose = React.useCallback(() => {
    tagsFieldRef.current?.flush();
    onClose();
  }, [onClose]);

  return (
    <DesignerDialog
      title="Tags"
      titleExtra={componentName ? (
        <span className="min-w-0 truncate text-sm font-semibold text-indigo-700" title={componentName}>
          {componentName}
        </span>
      ) : null}
      titleIcon={<Tags className="h-4 w-4 text-indigo-600" />}
      open={open}
      onClose={handleClose}
      band="Type a tag and press Enter to create it. Changes save as you add or remove a tag."
      surfaceClassName="flex max-w-4xl min-h-[32rem] flex-col"
      bodyClassName={`${DESIGNER_DIALOG_BODY_CLASS} flex-1`}
    >
      {open ? (
        <div className="flex h-full min-h-[26rem] flex-col bg-white p-[15px]">
          <CatalogTagsField
            ref={tagsFieldRef}
            label=""
            ariaLabel="Tags"
            value={tags}
            onChange={onTagsChange}
            suggestions={suggestions}
          />
          {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p> : null}
        </div>
      ) : null}
    </DesignerDialog>
  );
};
