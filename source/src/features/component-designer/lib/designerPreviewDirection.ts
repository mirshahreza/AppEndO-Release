export const DESIGNER_PREVIEW_DIRECTION_MESSAGE = 'appendo:designer-preview-direction' as const;

export type DesignerPreviewDirectionMode = 'culture' | 'ltr' | 'rtl';

export type DesignerPreviewDirectionMessage = {
  type: typeof DESIGNER_PREVIEW_DIRECTION_MESSAGE;
  direction: DesignerPreviewDirectionMode;
};

export const isDesignerPreviewDirectionMessage = (
  value: unknown,
): value is DesignerPreviewDirectionMessage =>
  typeof value === 'object'
  && value !== null
  && (value as DesignerPreviewDirectionMessage).type === DESIGNER_PREVIEW_DIRECTION_MESSAGE
  && (
    (value as DesignerPreviewDirectionMessage).direction === 'culture'
    || (value as DesignerPreviewDirectionMessage).direction === 'ltr'
    || (value as DesignerPreviewDirectionMessage).direction === 'rtl'
  );

export const postDesignerPreviewDirection = (
  targetWindow: Window | null | undefined,
  direction: DesignerPreviewDirectionMode,
): void => {
  if (!targetWindow) {
    return;
  }

  const message: DesignerPreviewDirectionMessage = {
    type: DESIGNER_PREVIEW_DIRECTION_MESSAGE,
    direction,
  };

  targetWindow.postMessage(message, window.location.origin);
};

export const resolveEffectivePreviewDirection = (
  cultureDirection: 'ltr' | 'rtl',
  override: 'ltr' | 'rtl' | null,
): 'ltr' | 'rtl' => override ?? cultureDirection;
