import React from 'react';
import { cn } from '../../lib/utils';
import { pageGuideLocalProps } from './shell/pageGuide/pageGuideChrome';
import { UiCheckboxChoice } from './FormChoiceFields';
import {
  PAGE_TOOLBAR_FILTER_CHECKBOX_ITEM_CLASS,
  PAGE_TOOLBAR_FILTER_CHECKBOX_LABEL_CLASS,
} from './surfaceClasses';

export type ToolbarFilterCheckboxProps = {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
  isDisabled?: boolean;
  className?: string;
  /** Page-guide hint. Defaults to a show/hide sentence from the label. */
  hint?: string;
};

const firstText = (node: React.ReactNode): string => {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node).trim();
  }
  if (!React.isValidElement(node)) {
    if (Array.isArray(node)) {
      for (const child of node) {
        const text = firstText(child);
        if (text) return text;
      }
    }
    return '';
  }
  return firstText((node.props as { children?: React.ReactNode }).children);
};

/** Bordered toolbar filter toggle — place after search/select controls in PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS. */
export const ToolbarFilterCheckbox: React.FC<ToolbarFilterCheckboxProps> = ({
  id,
  checked,
  onChange,
  children,
  isDisabled = false,
  className,
  hint,
}) => {
  const label = firstText(children);
  const guideHint = hint?.trim()
    || (label ? `Shows or hides ${label.toLowerCase()} in this list.` : '');
  return (
    <span
      className="inline-flex"
      {...(label && guideHint ? pageGuideLocalProps(label, guideHint, 22) : {})}
    >
      <UiCheckboxChoice
        id={id}
        checked={checked}
        onChange={onChange}
        disabled={isDisabled}
        className={cn(PAGE_TOOLBAR_FILTER_CHECKBOX_LABEL_CLASS, className)}
      >
        {children}
      </UiCheckboxChoice>
    </span>
  );
};

/** Checkbox row inside PAGE_TOOLBAR_FILTER_CHECKBOX_GROUP_CLASS — content width only. */
export const ToolbarFilterCheckboxGroupItem: React.FC<ToolbarFilterCheckboxProps> = ({
  id,
  checked,
  onChange,
  children,
  isDisabled = false,
  className,
}) => (
  <UiCheckboxChoice
    id={id}
    checked={checked}
    onChange={onChange}
    disabled={isDisabled}
    className={cn(PAGE_TOOLBAR_FILTER_CHECKBOX_ITEM_CLASS, className)}
  >
    {children}
  </UiCheckboxChoice>
);
