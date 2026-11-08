export function normalizePhoneDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}

/**
 * Builds tel: and WhatsApp (wa.me) URLs from a display phone string.
 * Iraqi mobiles (07xxxxxxxxx) map to +9647xxxxxxxxx.
 */
export function resolvePhoneContactLinks(raw: string): { tel: string; whatsapp: string } | null {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) {
    return null;
  }

  let digits = normalizePhoneDigits(trimmed);
  if (digits.length < 7) {
    return null;
  }

  if (trimmed.startsWith('+')) {
    return {
      tel: `tel:+${digits}`,
      whatsapp: `https://wa.me/${digits}`,
    };
  }

  if (digits.startsWith('00') && digits.length > 2) {
    digits = digits.slice(2);
    return {
      tel: `tel:+${digits}`,
      whatsapp: `https://wa.me/${digits}`,
    };
  }

  if (/^07\d{9}$/.test(digits)) {
    const intl = `964${digits.slice(1)}`;
    return {
      tel: `tel:+${intl}`,
      whatsapp: `https://wa.me/${intl}`,
    };
  }

  if (/^7\d{9}$/.test(digits)) {
    const intl = `964${digits}`;
    return {
      tel: `tel:+${intl}`,
      whatsapp: `https://wa.me/${intl}`,
    };
  }

  if (digits.length >= 10) {
    return {
      tel: `tel:+${digits}`,
      whatsapp: `https://wa.me/${digits}`,
    };
  }

  return {
    tel: `tel:${digits}`,
    whatsapp: `https://wa.me/${digits}`,
  };
}

export function isDesignerPhoneMaskPreset(maskPreset?: string | null): boolean {
  const preset = maskPreset?.trim();
  return preset === 'phone-intl' || preset === 'phone-ir-mobile' || preset === 'phone-ir-landline';
}
