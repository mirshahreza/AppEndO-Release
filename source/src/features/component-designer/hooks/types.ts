export type DesignerCodeTab = 'tsx' | 'outline';

export const DESIGNER_CODE_TAB_ORDER: DesignerCodeTab[] = ['tsx', 'outline'];

export type DesignerDialogFlags = {
  draftDialogMode: import('../dialogs/types').DesignerDialogMode;
  isPreviewDialogOpen: boolean;
};
