import React, { useCallback } from 'react';
import { ImageEditorModal, type ImageEditorModalProps } from './ImageEditorModal';

type ImageEditorSaveDialogProps = Omit<ImageEditorModalProps, 'onConfirm'> & {
  onSave: (file: File) => void | Promise<void>;
};

/**
 * Standard image-editor dialog used by form image fields and File Manager.
 * Keeps the modal open on save failure so ImageEditorModal can show the error inline.
 * Unmounts while closed so each open starts from a clean editor state.
 */
export const ImageEditorSaveDialog: React.FC<ImageEditorSaveDialogProps> = ({
  onSave,
  open,
  ...props
}) => {
  const handleConfirm = useCallback(async (file: File) => {
    await onSave(file);
  }, [onSave]);

  if (!open) {
    return null;
  }

  return (
    <ImageEditorModal
      {...props}
      open={open}
      onConfirm={handleConfirm}
    />
  );
};
