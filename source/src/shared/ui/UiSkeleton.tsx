import React from 'react';
import { Skeleton } from '@heroui/react';

const HeroSkeleton = Skeleton as any;

export type UiSkeletonProps = {
  /** Default `pulse`. */
  animationType?: 'none' | 'pulse' | 'shimmer';
  /** Size/shape via Tailwind classes, e.g. `h-4 w-full rounded`. */
  className?: string;
};

/** Thin wrapper over HeroUI's `Skeleton` — content-loading placeholder blocks. */
export const UiSkeleton: React.FC<UiSkeletonProps> = ({ animationType, className }) => (
  <HeroSkeleton animationType={animationType} className={className} />
);
