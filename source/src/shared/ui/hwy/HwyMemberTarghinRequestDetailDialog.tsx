import React from 'react';

import { MountGridDateText } from '../../../app/platform/MountGridDateText';
import { useCulture } from '../../../core/culture/CultureContext';
import {
  HWY_MEMBER_TARGHIN_NOTE_BODY_CLASS,
} from '../../../domain/hwy/hwyMemberTarghinAdminLayout';
import { AppButton, CreateEditModalShell } from '..';
import { DialogBody, DialogFooter } from '../dialog';

export type HwyMemberTarghinRequestDetailDialogProps = {
  open: boolean;
  onClose: () => void;
  createdAt: string;
  requestReasonCodeTitle?: string | null;
  requestNote?: string | null;
};

export const HwyMemberTarghinRequestDetailDialog: React.FC<HwyMemberTarghinRequestDetailDialogProps> = ({
  open,
  onClose,
  createdAt,
  requestReasonCodeTitle,
  requestNote,
}) => {
  const culture = useCulture();
  const t = (key: string, fallback: string) => {
    const value = culture.t(key, { missing: 'silent' });
    return value && value !== key ? value : fallback;
  };

  const reason = requestReasonCodeTitle?.trim();
  const note = requestNote?.trim();

  if (!open) {
    return null;
  }

  return (
    <CreateEditModalShell
      title={t('hwy.targhinAdmin.request.detailTitle', 'Request details')}
      onClose={onClose}
      size="md"
      showStudioToolsMenu={false}
      showFeedbackButton={false}
      footer={(
        <DialogFooter>
          <AppButton intent="secondary" size="sm" onClick={onClose}>
            {t('hwy.targhinAdmin.request.close', 'Close')}
          </AppButton>
        </DialogFooter>
      )}
    >
      <DialogBody className="space-y-3 text-start">
        <div className="text-xs font-semibold text-slate-800">
          <MountGridDateText value={createdAt} align="start" />
        </div>
        {reason ? (
          <div className="text-sm font-semibold leading-snug text-rose-700">{reason}</div>
        ) : null}
        {note ? (
          <p className={HWY_MEMBER_TARGHIN_NOTE_BODY_CLASS}>{note}</p>
        ) : (
          <p className="text-sm text-slate-500">{t('hwy.targhinAdmin.request.noNote', 'No request note.')}</p>
        )}
      </DialogBody>
    </CreateEditModalShell>
  );
};
