import React from 'react';
import { CreateEditModalShell } from '../../../shared/ui';
import type { PersonalInboxItem } from '../../../shared/api/contracts/personal-inbox/types';
import { useCultureT } from '../../../core/culture/CultureContext';
import { resolveCultureLabel } from '../../../core/culture/cultureShellKeys';
import { resolveInboxItemTitle } from '../../../shared/lib/shellInboxCultureLabels';
import { PersonalInboxEnvelopeDetailView } from '../../../shared/personal-inbox/PersonalInboxEnvelopeDetailView';

export type PersonalInboxAlertDetailDialogProps = {
  item: PersonalInboxItem | null;
  onClose: () => void;
  onCorrespondenceCompleted?: () => void;
};

export const PersonalInboxAlertDetailDialog: React.FC<PersonalInboxAlertDetailDialogProps> = ({
  item,
  onClose,
  onCorrespondenceCompleted,
}) => {
  const t = useCultureT();
  const detailErrorLabel = resolveCultureLabel(
    t,
    'shell.inbox.alertDetail.loadError',
    'Failed to load alert details.',
  );

  if (!item || item.kind !== 'alert') {
    return null;
  }

  return (
    <CreateEditModalShell title={resolveInboxItemTitle(t, item.title)} size="maximized" onClose={onClose}>
      <PersonalInboxEnvelopeDetailView
        item={item}
        loadErrorLabel={detailErrorLabel}
        onOpenRelated={onClose}
        onCorrespondenceCompleted={onCorrespondenceCompleted}
      />
    </CreateEditModalShell>
  );
};
