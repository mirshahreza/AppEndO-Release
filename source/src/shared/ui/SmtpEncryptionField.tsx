import React from 'react';
import { Lock, ShieldCheck } from 'lucide-react';
import {
  SMTP_ENCRYPTION_OPTIONS,
  smtpEncryptionToSecure,
  smtpSecureToEncryption,
} from '../api/contracts/settings/smtpEncryption';
import { UiOptionCardGroup } from './UiOptionCardGroup';

const SMTP_ENCRYPTION_ICONS = {
  starttls: ShieldCheck,
  implicitTls: Lock,
} as const;

export type SmtpEncryptionFieldProps = {
  value: boolean;
  onChange: (next: { secure: boolean; port: number }) => void;
  className?: string;
  disabled?: boolean;
  density?: 'default' | 'compact';
  /** When false, the field label is omitted (wrap with an external inline label). */
  showLabel?: boolean;
  /** Highlight the selected card border (wizard emerald, settings indigo). */
  accentClassName?: string;
  /** Selected option title icon color (pairs with accentClassName). */
  accentIconClassName?: string;
};

export const SmtpEncryptionField: React.FC<SmtpEncryptionFieldProps> = ({
  value,
  onChange,
  className,
  disabled = false,
  density = 'default',
  showLabel = true,
  accentClassName = 'border-rose-300 bg-rose-50/50',
  accentIconClassName = 'text-rose-700',
}) => {
  const mode = smtpSecureToEncryption(value);

  const selectOption = (next: string) => {
    const option = SMTP_ENCRYPTION_OPTIONS.find((item) => item.value === next);
    if (!option) return;
    onChange({
      secure: smtpEncryptionToSecure(option.value),
      port: option.typicalPort,
    });
  };

  return (
    <UiOptionCardGroup
      value={mode}
      onChange={selectOption}
      ariaLabel="SMTP encryption"
      label={showLabel ? 'Encryption' : undefined}
      disabled={disabled}
      density={density}
      columns={2}
      className={className}
      accentClassName={accentClassName}
      accentIconClassName={accentIconClassName}
      options={SMTP_ENCRYPTION_OPTIONS.map((option) => ({
        value: option.value,
        title: option.title,
        description: option.description,
        shortDescription: option.shortDescription,
        meta: `Typical port: ${option.typicalPort}`,
        icon: SMTP_ENCRYPTION_ICONS[option.value],
      }))}
    />
  );
};
