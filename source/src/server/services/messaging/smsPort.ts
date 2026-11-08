/** Legacy `MessagingUtils.CalculatePortNumber` parity (Iraq mobile prefixes). */
export const resolveSmsGatewayPort = (phoneNumber: string): string | null => {
  const trimmed = phoneNumber.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('075')) return '4';
  return '1';
};

export const normalizeSmsDestination = (phoneNumber: string): string => phoneNumber.trim();
