import type { DesignerDocument } from '../../domain/component-designer/types';
import { APPENDO_LOGO_SRC } from '../../components/AppEndLogo';
import { SHELL_CHROME_LOGO } from './shellChromeSlots';

export const SHELL_LOGO_SRC_PROP = 'logoSrc' as const;
export const SHELL_LOGO_ALT_PROP = 'logoAlt' as const;
export const SHELL_LOGO_HREF_PROP = 'logoHref' as const;

export type ShellLogoConfig = {
  src?: string;
  alt?: string;
  href?: string;
};

const readOptionalStringProp = (props: Record<string, unknown>, key: string): string | undefined => {
  const value = props[key];
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const resolveShellLogoConfigFromProps = (
  props?: Record<string, unknown> | null,
): ShellLogoConfig | null => {
  if (!props) {
    return null;
  }

  const src = readOptionalStringProp(props, SHELL_LOGO_SRC_PROP);
  const alt = readOptionalStringProp(props, SHELL_LOGO_ALT_PROP);
  const href = readOptionalStringProp(props, SHELL_LOGO_HREF_PROP);

  if (!src && !alt && !href) {
    return null;
  }

  return { src, alt, href };
};

/** Reads logo settings from the first `core.shell.logo` system-slot in the document. */
export function extractShellLogoConfigFromDocument(
  document: DesignerDocument,
): ShellLogoConfig | null {
  for (const node of Object.values(document.nodes)) {
    if (node.type !== 'system-slot') {
      continue;
    }

    const slotId = typeof node.props.slotId === 'string' ? node.props.slotId.trim() : '';
    if (slotId !== SHELL_CHROME_LOGO) {
      continue;
    }

    return resolveShellLogoConfigFromProps(node.props);
  }

  return null;
}

export const resolveShellLogoImageSrc = (config?: ShellLogoConfig | null): string => {
  const customSrc = config?.src?.trim();
  return customSrc && customSrc.length > 0 ? customSrc : APPENDO_LOGO_SRC;
};

export const resolveShellLogoAltText = (config?: ShellLogoConfig | null): string => {
  const customAlt = config?.alt?.trim();
  return customAlt && customAlt.length > 0 ? customAlt : 'AppEnd';
};

export const resolveShellLogoHref = (config?: ShellLogoConfig | null): string | undefined => {
  const href = config?.href?.trim();
  return href && href.length > 0 ? href : undefined;
};
