import React, { useEffect, useState } from 'react';
import { cn } from '../../../lib/utils';

const SIZE_CLASS = {
  xs: 'h-5 w-5 text-[9px]',
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-9 w-9 text-xs',
} as const;

type OrgGeoPersonAvatarProps = {
  src: string | null | undefined;
  label: string;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
};

/** Compact avatar matching Users grid chrome; initials when `src` is missing/broken. */
export const OrgGeoPersonAvatar: React.FC<OrgGeoPersonAvatarProps> = ({
  src,
  label,
  size = 'sm',
  className,
}) => {
  const [failed, setFailed] = useState(false);
  const fallback = (label.trim() || '?').slice(0, 1).toUpperCase();

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const showImage = Boolean(src) && !failed;

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-100 font-bold leading-none text-slate-500',
        SIZE_CLASS[size],
        className,
      )}
    >
      {showImage ? (
        <img
          key={src!}
          src={src!}
          alt=""
          loading="eager"
          decoding="async"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{fallback}</span>
      )}
    </span>
  );
};
