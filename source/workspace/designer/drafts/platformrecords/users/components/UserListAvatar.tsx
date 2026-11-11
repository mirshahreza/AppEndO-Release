import React, { useEffect, useState } from 'react';

type UserListAvatarProps = {
  userId: number;
  src: string | null;
  alt: string;
  fallbackLabel: string;
};

export const UserListAvatar: React.FC<UserListAvatarProps> = ({
  userId,
  src,
  alt,
  fallbackLabel,
}) => {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [userId, src]);

  const showImage = Boolean(src) && !imageFailed;

  return (
    <div className="mx-auto flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-100">
      {showImage ? (
        <img
          src={src!}
          alt={alt}
          loading="eager"
          decoding="async"
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className="text-[10px] font-bold leading-none text-slate-500">
          {fallbackLabel}
        </span>
      )}
    </div>
  );
};
