import React from 'react';

import { cn } from '../../../lib/utils';
import { NativeButton } from '../NativeButton';
import { HWY_MEMBER_FACE_SUBTLE_HOVER_CLASS } from './hwyMemberFaceInteraction';

export const HWY_TARGHIN_DOSSIER_FACE_LINK_CLASS = cn(
  'flex w-full min-w-0 items-stretch text-start',
  HWY_MEMBER_FACE_SUBTLE_HOVER_CLASS,
);

export type HwyTarghinDossierFaceLinkProps = {
  /** Control-plane `hwy_members.id`. When empty, children render without a link. */
  dossierMemberId?: string | null;
  onOpenDossier?: (memberId: string) => void;
  dir?: 'ltr' | 'rtl';
  className?: string;
  children: React.ReactNode;
};

export const HwyTarghinDossierFaceLink: React.FC<HwyTarghinDossierFaceLinkProps> = ({
  dossierMemberId,
  onOpenDossier,
  dir,
  className,
  children,
}) => {
  const memberId = String(dossierMemberId ?? '').trim();
  if (!memberId || !onOpenDossier) {
    return <div className={cn('w-full min-w-0 text-start', className)}>{children}</div>;
  }
  return (
    <NativeButton
      type="button"
      dir={dir}
      className={cn(HWY_TARGHIN_DOSSIER_FACE_LINK_CLASS, className)}
      onClick={(event) => {
        event.stopPropagation();
        onOpenDossier(memberId);
      }}
    >
      {children}
    </NativeButton>
  );
};
