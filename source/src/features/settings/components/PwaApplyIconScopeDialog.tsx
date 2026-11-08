import React from 'react';
import { ImageIcon, Loader2, X } from 'lucide-react';
import { AppButton, ConfirmDialogShell } from '../../../shared/ui';
import type { PwaIconSlot } from '../../../shared/lib/pwaAssets';
import { useSettingsFormT } from '../hooks/useSettingsFormT';

export type PwaApplyIconScope = 'all' | 'single';

const SLOT_LABEL_KEYS: Record<PwaIconSlot, string> = {
  '32': 'settings.forms.pwa.favicon32',
  '192': 'settings.forms.pwa.icon192',
  '512': 'settings.forms.pwa.icon512',
  maskable: 'settings.forms.pwa.maskable512',
};

type PwaApplyIconScopeDialogProps = {
  open: boolean;
  slot: PwaIconSlot;
  isApplying?: boolean;
  onClose: () => void;
  onChoose: (scope: PwaApplyIconScope) => void;
};

export const PwaApplyIconScopeDialog: React.FC<PwaApplyIconScopeDialogProps> = ({
  open,
  slot,
  isApplying = false,
  onClose,
  onChoose,
}) => {
  const t = useSettingsFormT();
  const slotLabel = t(SLOT_LABEL_KEYS[slot]);

  return (
    <ConfirmDialogShell
      open={open}
      title={t('settings.forms.pwa.applyScope.title')}
      icon={<ImageIcon className="h-4 w-4 text-indigo-600" />}
      iconToneClassName="text-indigo-600"
      tone="default"
      hideCancel
      hideConfirm
      onClose={onClose}
      onBackdropClick={isApplying ? undefined : onClose}
      closeOnEscape={!isApplying}
      footer={(
        <div className="flex w-full flex-wrap justify-end gap-2">
          <AppButton intent="cancel" size="sm" onClick={onClose} disabled={isApplying}>
            <X className="h-3.5 w-3.5" />
            {t('actions.cancel')}
          </AppButton>
          <AppButton intent="secondary" size="sm" onClick={() => onChoose('single')} disabled={isApplying}>
            <ImageIcon className="h-3.5 w-3.5" />
            {t('settings.ui.thisSizeOnly')}
          </AppButton>
          <AppButton intent="primary" size="sm" onClick={() => onChoose('all')} disabled={isApplying}>
            {isApplying ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t('settings.ui.applying')}
              </>
            ) : (
              t('settings.ui.allSizes')
            )}
          </AppButton>
        </div>
      )}
    >
      <p className="text-sm text-slate-600">
        {t('settings.forms.pwa.applyScope.body', { slot: slotLabel })}
      </p>
    </ConfirmDialogShell>
  );
};
