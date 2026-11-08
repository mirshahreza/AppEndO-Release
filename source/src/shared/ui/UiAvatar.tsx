import React from 'react';
import { Avatar } from '@heroui/react';

const HeroAvatar = Avatar as any;

export type UiAvatarSize = 'sm' | 'md' | 'lg';
export type UiAvatarColor = 'default' | 'accent' | 'success' | 'warning' | 'danger';

export type UiAvatarProps = {
  src?: string;
  alt?: string;
  /** Shown while the image loads/fails, or when no `src` is given (usually initials). */
  fallback: React.ReactNode;
  size?: UiAvatarSize;
  color?: UiAvatarColor;
  className?: string;
};

/** Thin wrapper over HeroUI's `Avatar` compound API (`Image`/`Fallback`). */
export const UiAvatar: React.FC<UiAvatarProps> = ({ src, alt, fallback, size, color, className }) => (
  <HeroAvatar size={size} color={color} className={className}>
    {src ? <HeroAvatar.Image src={src} alt={alt ?? ''} /> : null}
    <HeroAvatar.Fallback color={color}>{fallback}</HeroAvatar.Fallback>
  </HeroAvatar>
);
