import React from 'react';
import type { ComponentViewportVisibility } from '../../lib/viewportVisibility';
import { useComponentViewportVisible } from '../../lib/useComponentViewportVisible';
import { PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS } from '../surfaceClasses';
import { ListFilterButton, type ListFilterButtonProps } from './ListFilterButton';

export type ListFilterToolbarControlProps = {
  filterButtonProps: ListFilterButtonProps;
  /** Vertical rule before Filter when other controls already sit in the filters cluster. */
  separatorBefore?: boolean;
  /**
   * When to show the where-builder entry control.
   * Default `hide-phone`: inline toolbar filters are enough on the narrowest tier; open the dialog from tablet+ or summary band.
   */
  visibility?: ComponentViewportVisibility;
};

/** Where-builder Filter at the end of `PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS` (after search / selects / checkboxes). */
export const ListFilterToolbarControl: React.FC<ListFilterToolbarControlProps> = ({
  filterButtonProps,
  separatorBefore = false,
  visibility = 'hide-phone',
}) => {
  const visible = useComponentViewportVisible(visibility);
  if (!visible) {
    return null;
  }

  return (
    <>
      {separatorBefore ? (
        <span className={PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS} aria-hidden="true" />
      ) : null}
      <ListFilterButton {...filterButtonProps} />
    </>
  );
};
