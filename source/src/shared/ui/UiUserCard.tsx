import React from 'react';
import { cn } from '../../lib/utils';
import { UiAvatar, type UiAvatarColor, type UiAvatarSize } from './UiAvatar';

export type UiUserCardProps = {
  name: string;
  description?: string;
  src?: string;
  fallback?: string;
  size?: UiAvatarSize;
  color?: UiAvatarColor;
  className?: string;
};

const initialsFromName = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase();
};

/** Avatar + name + short description as one identity block. */
export const UiUserCard: React.FC<UiUserCardProps> = ({
  name,
  description,
  src,
  fallback,
  size = 'md',
  color = 'accent',
  className,
}) => (
  <div className={cn('inline-flex min-w-0 items-center gap-3', className)}>
    <UiAvatar
      src={src}
      alt={name}
      fallback={fallback?.trim() || initialsFromName(name)}
      size={size}
      color={color}
    />
    <div className="min-w-0">
      <p className="truncate text-sm font-medium text-slate-800">{name}</p>
      {description ? <p className="truncate text-xs text-slate-500">{description}</p> : null}
    </div>
  </div>
);
