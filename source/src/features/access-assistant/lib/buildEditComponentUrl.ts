import {
  isClientComponentEditSlug,
} from '../../../shared/lib/clientComponentEditSlug';

export { isClientComponentEditSlug } from '../../../shared/lib/clientComponentEditSlug';

export function resolveStudioMountPrefix(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  const studioIndex = segments.lastIndexOf('studio');
  if (studioIndex >= 0) {
    return `/${segments.slice(0, studioIndex + 1).join('/')}`;
  }
  return '/studio';
}

export function buildEditComponentUrl(pathname: string, componentSlug: string): string | null {
  const prefix = resolveStudioMountPrefix(pathname).replace(/\/+$/, '');
  const slug = componentSlug.trim();
  if (!isClientComponentEditSlug(slug)) {
    return null;
  }
  return `${prefix}/client-components/edit/${slug}`;
}
