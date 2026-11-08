/** Browser-safe random password generator (mirrors server usersHelpers.generateRandomPassword). */
export const generateRandomPassword = (length = 18): string => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const raw = btoa(String.fromCharCode(...bytes));
  const safe = raw.replace(/[^A-Za-z0-9]/g, '');
  return safe.slice(0, Math.max(12, length));
};
