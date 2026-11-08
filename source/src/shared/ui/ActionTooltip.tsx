import React from 'react';
import { cn } from '../../lib/utils';

export type ActionTooltipProps = {
  content: string;
  children: React.ReactElement;
  triggerClassName?: string;
};

/**
 * Dense-grid action hint only — native `title` to avoid mounting HeroUI Tooltip trees per row.
 * For field/label operator hints use `FieldHintTooltip` / `FormField hint` (see ui-core.md).
 */
export const ActionTooltip: React.FC<ActionTooltipProps> = ({ content, children, triggerClassName }) => {
  if (!React.isValidElement(children)) {
    return children;
  }

  const childProps = children.props as { className?: string; title?: string };
  const nextClassName = triggerClassName
    ? cn(childProps.className, triggerClassName)
    : childProps.className;

  return React.cloneElement(children, {
    title: content,
    ...(nextClassName ? { className: nextClassName } : {}),
  });
};
