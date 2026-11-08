export const STUDIO_MOUNT_PREFIX = '/studio';

export function studioPath(relativePath = ''): string {
  const trimmed = relativePath.replace(/^\/+/, '').replace(/\/+$/, '');
  if (!trimmed) {
    return STUDIO_MOUNT_PREFIX;
  }

  return `${STUDIO_MOUNT_PREFIX}/${trimmed}`;
}
