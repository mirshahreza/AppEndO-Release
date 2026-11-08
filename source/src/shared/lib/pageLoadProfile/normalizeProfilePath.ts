export const normalizeProfilePath = (path: string): string => {
  const trimmed = path.trim();
  if (!trimmed) {
    return '/';
  }
  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  if (withSlash.length > 1 && withSlash.endsWith('/')) {
    return withSlash.slice(0, -1);
  }
  return withSlash;
};
