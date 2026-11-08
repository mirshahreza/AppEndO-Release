import React, { useState } from 'react';
import { NativeButton } from '../../../shared/ui';
import {
  MODELER_INSPECTOR_LIST_PREVIEW_COUNT,
  MODELER_INSPECTOR_MORE_LINK_CLASS,
} from '../lib/modelerChipStyles';
import {
  modelerInspectorMoreLinkAriaLabel,
  modelerInspectorMoreLinkLabel,
  sliceModelerInspectorList,
} from '../lib/modelerInspectorListPreview';

export type ModelerInspectorListPreviewProps<T> = {
  items: readonly T[];
  previewCount?: number;
  children: (visible: readonly T[]) => React.ReactNode;
};

export function ModelerInspectorListPreview<T>({
  items,
  previewCount = MODELER_INSPECTOR_LIST_PREVIEW_COUNT,
  children,
}: ModelerInspectorListPreviewProps<T>): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const { visible, hiddenCount } = sliceModelerInspectorList(items, expanded, previewCount);

  return (
    <div className="flex flex-col gap-1.5">
      {children(visible)}
      {hiddenCount > 0 ? (
        <NativeButton
          type="button"
          className={MODELER_INSPECTOR_MORE_LINK_CLASS}
          aria-expanded={expanded}
          aria-label={modelerInspectorMoreLinkAriaLabel(hiddenCount, expanded)}
          title={modelerInspectorMoreLinkAriaLabel(hiddenCount, expanded)}
          onClick={() => setExpanded((open) => !open)}
        >
          {modelerInspectorMoreLinkLabel(hiddenCount, expanded)}
        </NativeButton>
      ) : null}
    </div>
  );
}
