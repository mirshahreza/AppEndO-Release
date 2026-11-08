import * as React from 'react';
import { Phone } from 'lucide-react';
import { cn } from '../../lib/utils';
import { PHONE_NUMBER_DISPLAY_DIGIT_GLYPH_CLASS } from '../lib/fieldNumericDateAlign';
import { resolvePhoneContactLinks } from '../lib/phoneContactLinks';
import { showAppFeedbackToast } from './appFeedbackToast';

export const PhoneWhatsAppGlyph: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden
    className={cn('shrink-0', className)}
    fill="currentColor"
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

/** Outer pill — digits and action circles share one badge chrome (single row). */
export const PHONE_CONTACT_BADGE_SHELL_CLASS =
  'inline-flex shrink-0 flex-nowrap items-center gap-0.5 rounded-full border border-slate-200/45 bg-white p-0.5 shadow-xs';

/** Inline readouts size to content; field layout overrides with `w-full`. */
export const PHONE_CONTACT_BADGE_INLINE_LAYOUT_CLASS = 'w-max max-w-none';

/** Full field width — digits and actions stay on one row inside narrow RTL form columns. */
export const PHONE_CONTACT_BADGE_FIELD_LAYOUT_CLASS =
  'flex w-full min-w-0 flex-nowrap justify-between gap-1';

const BADGE_CIRCLE_CLASS: Record<PhoneContactBadgeSize, string> = {
  inline: 'inline-flex size-[1.35em] shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/70',
  field: 'inline-flex size-6 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/70',
  compact: 'inline-flex size-5 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-300/70',
};

const BADGE_ICON_CLASS: Record<PhoneContactBadgeSize, string> = {
  inline: 'size-[0.85em]',
  field: 'size-3.5',
  compact: 'size-3',
};

const PHONE_DIGIT_PADDING_CLASS: Record<PhoneContactBadgeSize, string> = {
  inline: 'px-2 py-0.5',
  field: 'px-2 py-0.5 text-sm',
  compact: 'px-1.5 py-0 text-[11px] leading-tight',
};

export type PhoneContactBadgeSize = 'inline' | 'field' | 'compact';

type PhoneContactCirclesProps = {
  phone: string;
  size: PhoneContactBadgeSize;
  callAriaLabel?: string;
  whatsAppAriaLabel?: string;
};

const PhoneContactCircles: React.FC<PhoneContactCirclesProps> = ({
  phone,
  size,
  callAriaLabel = 'Call',
  whatsAppAriaLabel = 'WhatsApp',
}) => {
  const links = resolvePhoneContactLinks(phone);
  if (!links) {
    return null;
  }

  const circleClass = BADGE_CIRCLE_CLASS[size];
  const iconClass = BADGE_ICON_CLASS[size];

  return (
    <>
      <a
        href={links.tel}
        aria-label={callAriaLabel}
        className={cn(circleClass, 'bg-sky-50 text-sky-600 hover:bg-sky-100 hover:text-sky-700')}
      >
        <Phone className={iconClass} strokeWidth={2.25} aria-hidden />
      </a>
      <a
        href={links.whatsapp}
        aria-label={whatsAppAriaLabel}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(circleClass, 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700')}
      >
        <PhoneWhatsAppGlyph className={iconClass} />
      </a>
    </>
  );
};

export type PhoneContactActionsBadgeProps = {
  phone: string;
  className?: string;
  badgeClassName?: string;
  size?: PhoneContactBadgeSize;
  callAriaLabel?: string;
  whatsAppAriaLabel?: string;
};

/** Dial + WhatsApp circles inside the shared pill (no digit text). */
export const PhoneContactActionsBadge: React.FC<PhoneContactActionsBadgeProps> = ({
  phone,
  className,
  badgeClassName,
  size = 'inline',
  callAriaLabel,
  whatsAppAriaLabel,
}) => {
  const trimmed = String(phone ?? '').trim();
  if (!resolvePhoneContactLinks(trimmed)) {
    return null;
  }

  return (
    <span
      className={cn(
        PHONE_CONTACT_BADGE_SHELL_CLASS,
        PHONE_CONTACT_BADGE_INLINE_LAYOUT_CLASS,
        badgeClassName,
        className,
      )}
    >
      <PhoneContactCircles
        phone={trimmed}
        size={size}
        callAriaLabel={callAriaLabel}
        whatsAppAriaLabel={whatsAppAriaLabel}
      />
    </span>
  );
};

export async function copyPhoneFieldValue(
  phone: string,
  copiedToastMessage?: string,
): Promise<boolean> {
  const trimmed = String(phone ?? '').trim();
  if (!trimmed || !resolvePhoneContactLinks(trimmed)) {
    return false;
  }
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(trimmed);
    } else {
      throw new Error('Clipboard unavailable');
    }
    if (copiedToastMessage) {
      showAppFeedbackToast(copiedToastMessage, { type: 'success' });
    }
    return true;
  } catch {
    return false;
  }
}

export const PhoneFieldCopyableValue: React.FC<{
  phone: string;
  children: React.ReactNode;
  className?: string;
  copyAriaLabel?: string;
  copiedToastMessage?: string;
}> = ({ phone, children, className, copyAriaLabel, copiedToastMessage }) => {
  const onCopy = React.useCallback(() => {
    void copyPhoneFieldValue(phone, copiedToastMessage);
  }, [copiedToastMessage, phone]);

  return (
    <button
      type="button"
      className={cn(
        'cursor-pointer border-0 bg-transparent text-inherit transition-colors',
        'rounded-s-full hover:bg-slate-50/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-300/70',
        className,
      )}
      aria-label={copyAriaLabel}
      onClick={onCopy}
    >
      {children}
    </button>
  );
};

export type PhoneContactBadgeLayout = 'inline' | 'field';

export type PhoneNumberDisplayProps = {
  phone: string;
  className?: string;
  textClassName?: string;
  badgeSize?: PhoneContactBadgeSize;
  /** `field` stretches the pill to the control width (readonly form fields, dossier). */
  badgeLayout?: PhoneContactBadgeLayout;
  callAriaLabel?: string;
  whatsAppAriaLabel?: string;
  fallback?: React.ReactNode;
  /** Badge only — no digit text (e.g. trailing field chrome). */
  actionsOnly?: boolean;
  copyAriaLabel?: string;
  copiedToastMessage?: string;
  /** Extra circle actions grouped at the end of the contact pill (e.g. dossier workflow). */
  trailingBadgeActions?: React.ReactNode;
};

/** Circle control matching dial / WhatsApp chrome inside {@link PhoneNumberDisplay}. */
export const PhoneBadgeCircleButton: React.FC<{
  'aria-label': string;
  onClick: () => void;
  size?: PhoneContactBadgeSize;
  className?: string;
  children: React.ReactNode;
}> = ({ 'aria-label': ariaLabel, onClick, size = 'field', className, children }) => (
  <button
    type="button"
    aria-label={ariaLabel}
    onClick={onClick}
    className={cn(
      BADGE_CIRCLE_CLASS[size],
      'border-0 bg-violet-50 text-violet-700 hover:bg-violet-100 hover:text-violet-800',
      className,
    )}
  >
    {children}
  </button>
);

const DEFAULT_PHONE_TEXT_CLASS = 'text-sm leading-snug text-slate-800';

const resolvePhoneDigitClass = (
  badgeSize: PhoneContactBadgeSize,
  textClassName?: string,
): string => cn(
  PHONE_NUMBER_DISPLAY_DIGIT_GLYPH_CLASS,
  PHONE_DIGIT_PADDING_CLASS[badgeSize],
  textClassName ?? DEFAULT_PHONE_TEXT_CLASS,
);

/** Callable phone readout — digits and contact circles in one pill badge. */
export const PhoneNumberDisplay: React.FC<PhoneNumberDisplayProps> = ({
  phone,
  className,
  textClassName,
  badgeSize = 'inline',
  badgeLayout = 'inline',
  callAriaLabel,
  whatsAppAriaLabel,
  fallback = null,
  actionsOnly = false,
  copyAriaLabel,
  copiedToastMessage,
  trailingBadgeActions,
}) => {
  const trimmed = String(phone ?? '').trim();
  const links = resolvePhoneContactLinks(trimmed);

  if (actionsOnly) {
    return (
      <PhoneContactActionsBadge
        phone={trimmed}
        size={badgeSize}
        className={className}
        callAriaLabel={callAriaLabel}
        whatsAppAriaLabel={whatsAppAriaLabel}
      />
    );
  }

  if (!trimmed || !links) {
    return <>{fallback}</>;
  }

  const digitGlyphClass = cn(
    PHONE_NUMBER_DISPLAY_DIGIT_GLYPH_CLASS,
    badgeLayout === 'field' && 'min-w-0 w-auto',
    textClassName ?? DEFAULT_PHONE_TEXT_CLASS,
  );
  const digitClass = resolvePhoneDigitClass(badgeSize, textClassName);
  const badgeLayoutClass =
    badgeLayout === 'field'
      ? PHONE_CONTACT_BADGE_FIELD_LAYOUT_CLASS
      : PHONE_CONTACT_BADGE_INLINE_LAYOUT_CLASS;

  const digitContent = (
    <span className={digitClass}>{trimmed}</span>
  );

  const actionCircles = (
    <span className="inline-flex shrink-0 items-center gap-0.5">
      <PhoneContactCircles
        phone={trimmed}
        size={badgeSize}
        callAriaLabel={callAriaLabel}
        whatsAppAriaLabel={whatsAppAriaLabel}
      />
      {trailingBadgeActions}
    </span>
  );

  return (
    <span
      dir="ltr"
      className={cn(PHONE_CONTACT_BADGE_SHELL_CLASS, badgeLayoutClass, className)}
      title={trimmed}
    >
      {copyAriaLabel ? (
        <PhoneFieldCopyableValue
          phone={trimmed}
          copyAriaLabel={copyAriaLabel}
          copiedToastMessage={copiedToastMessage}
          className={cn(
            'min-w-0 text-start',
            badgeLayout === 'field' ? 'shrink' : 'shrink-0',
            PHONE_DIGIT_PADDING_CLASS[badgeSize],
          )}
        >
          <span className={digitGlyphClass}>{trimmed}</span>
        </PhoneFieldCopyableValue>
      ) : (
        digitContent
      )}
      {actionCircles}
    </span>
  );
};

/** LTR row: value/control + trailing contact badge inside one field chrome. */
export const PhoneFieldInlineShell: React.FC<{
  phone: string;
  children: React.ReactNode;
  className?: string;
  shellClassName?: string;
}> = ({ phone, children, className, shellClassName }) => {
  const links = resolvePhoneContactLinks(phone);
  if (!links) {
    return <div className={cn('w-full min-w-0', className)}>{children}</div>;
  }

  return (
    <div
      dir="ltr"
      className={cn(
        'flex w-full min-w-0 items-stretch overflow-hidden',
        shellClassName,
        className,
      )}
    >
      <div
        className={cn(
          'min-w-0 flex-1',
          '[&_input]:!rounded-none [&_input]:!border-0 [&_input]:!shadow-none',
          '[&_[data-slot=input-wrapper]]:!rounded-none [&_[data-slot=input-wrapper]]:!border-0 [&_[data-slot=input-wrapper]]:!shadow-none',
          '[&_[data-slot=input]]:!rounded-none [&_[data-slot=input]]:!border-0 [&_[data-slot=input]]:!shadow-none',
        )}
      >
        {children}
      </div>
      <div className="flex shrink-0 items-center border-s border-slate-100 px-1.5">
        <PhoneNumberDisplay phone={phone} actionsOnly badgeSize="field" />
      </div>
    </div>
  );
};

/** @deprecated Prefer {@link PhoneFieldInlineShell}. */
export const PhoneFieldActionHost: React.FC<{
  phone: string;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  shellClassName?: string;
}> = ({ phone, children, className, shellClassName }) => (
  <PhoneFieldInlineShell phone={phone} className={className} shellClassName={shellClassName}>
    {children}
  </PhoneFieldInlineShell>
);

export type PhoneFieldContactActionsProps = {
  phone: string;
  className?: string;
  callAriaLabel?: string;
  whatsAppAriaLabel?: string;
  density?: 'field' | 'inline';
};

/** @deprecated Prefer {@link PhoneContactActionsBadge} or {@link PhoneNumberDisplay}. */
export const PhoneFieldContactActions: React.FC<PhoneFieldContactActionsProps> = ({
  phone,
  className,
  callAriaLabel,
  whatsAppAriaLabel,
  density = 'field',
}) => (
  <PhoneNumberDisplay
    phone={phone}
    actionsOnly
    badgeSize={density === 'inline' ? 'inline' : 'field'}
    className={className}
    callAriaLabel={callAriaLabel}
    whatsAppAriaLabel={whatsAppAriaLabel}
  />
);

export type PhoneTextWithContactActionsProps = PhoneNumberDisplayProps;

/** @deprecated Use {@link PhoneNumberDisplay}. */
export const PhoneTextWithContactActions: React.FC<PhoneTextWithContactActionsProps> = (props) => (
  <PhoneNumberDisplay {...props} />
);
