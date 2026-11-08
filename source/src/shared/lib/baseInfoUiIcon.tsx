import React from 'react';
import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

const parseLucideIconName = (uiHtml?: string | null): string | null => {
  if (!uiHtml?.trim()) return null;
  const match = uiHtml.match(/data-lucide=["']([^"']+)["']/i);
  return match?.[1] ?? null;
};

export const resolveLucideIconNameFromUiHtml = parseLucideIconName;

const toPascalCase = (name: string): string =>
  name
    .split('-')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('');

const resolveLucideIcon = (name: string): LucideIcon | null => {
  const pascal = toPascalCase(name);
  const icon = (LucideIcons as Record<string, LucideIcon | undefined>)[pascal];
  return icon ?? null;
};

export type BaseInfoUiIconProps = {
  uiHtml?: string | null;
  label?: string;
  className?: string;
};

export const BaseInfoUiIcon: React.FC<BaseInfoUiIconProps> = ({ uiHtml, label, className }) => {
  const iconName = parseLucideIconName(uiHtml);
  if (!iconName) return null;

  const Icon = resolveLucideIcon(iconName);
  if (!Icon) return null;

  return (
    <Icon
      className={cn('h-3.5 w-3.5 shrink-0', className)}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      title={label}
    />
  );
};
