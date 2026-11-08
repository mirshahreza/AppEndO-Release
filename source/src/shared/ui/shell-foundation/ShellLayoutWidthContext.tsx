import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { DesignerDocument } from '../../../domain/component-designer/types';
import { useOptionalShellExperience } from '../../../contexts/ShellExperienceContext';
import { invalidateAppearanceSession, saveUserShellExperience } from '../../api/queries/appearance';
import {
  isShellLayoutWidth,
  readShellLayoutWidth,
  readShellLayoutWidthUserControl,
  type ShellLayoutWidth,
} from './shellLayoutWidth';
import { resolveLayoutWidthChromeFromAppearance } from './shellLayoutWidthAppearance';

const storageKey = (shellKey: string) => `appendo:shell-page-width-expanded:${shellKey.trim()}`;

export type ShellLayoutWidthContextValue = {
  document: DesignerDocument;
  defaultWidth: ShellLayoutWidth;
  activeWidth: ShellLayoutWidth;
  canUserToggle: boolean;
  /** Studio admin header — show control unless metadata opts out (culture-independent). */
  headerControlVisible: boolean;
  isExpanded: boolean;
  toggle: () => void;
};

const ShellLayoutWidthContext = React.createContext<ShellLayoutWidthContextValue | null>(null);

export function useOptionalShellLayoutWidth(): ShellLayoutWidthContextValue | null {
  return React.useContext(ShellLayoutWidthContext);
}

export function useShellLayoutWidth(): ShellLayoutWidthContextValue {
  const value = useOptionalShellLayoutWidth();
  if (!value) {
    throw new Error('useShellLayoutWidth requires ShellLayoutWidthProvider.');
  }
  return value;
}

export function useResolvedShellLayoutWidth(document: DesignerDocument): ShellLayoutWidth {
  const context = useOptionalShellLayoutWidth();
  return context?.activeWidth ?? readShellLayoutWidth(document);
}

export type ShellLayoutWidthProviderProps = {
  document: DesignerDocument;
  shellKey: string;
  /** Studio `AppShell` uses bounded chrome when the layout draft has no explicit width metadata. */
  appShellChrome?: boolean;
  children: React.ReactNode;
};

export const ShellLayoutWidthProvider: React.FC<ShellLayoutWidthProviderProps> = ({
  document,
  shellKey,
  appShellChrome = false,
  children,
}) => {
  const queryClient = useQueryClient();
  const shellExperience = useOptionalShellExperience();
  const appearanceSession = shellExperience?.ready ? shellExperience.session : null;

  const metadataWidth = document.metadata.shellLayoutWidth;
  const documentDefaultWidth: ShellLayoutWidth = appShellChrome
    ? (isShellLayoutWidth(metadataWidth) ? metadataWidth : 'bounded')
    : readShellLayoutWidth(document);
  const documentCanUserToggle = appShellChrome
    ? document.metadata.shellLayoutWidthUserControl !== false
    : readShellLayoutWidthUserControl(document);

  const appearanceChrome = appearanceSession
    ? resolveLayoutWidthChromeFromAppearance(appearanceSession)
    : null;

  const defaultWidth = appearanceChrome?.defaultWidth ?? documentDefaultWidth;
  const canUserToggle = appearanceChrome?.canUserToggle ?? documentCanUserToggle;
  const layoutWidthUserControlAllowed = appearanceSession
    ? appearanceSession.effective.layoutWidthUserControl
    : documentCanUserToggle;
  /** Studio admin header shortcut — same gate as Appearance “Page width” user control. */
  const headerControlVisible = appShellChrome
    ? layoutWidthUserControlAllowed
    : canUserToggle;

  const readSessionExpanded = () => {
    if (appearanceChrome) {
      return appearanceChrome.expanded;
    }
    if (!canUserToggle || defaultWidth !== 'bounded') {
      return false;
    }
    try {
      return sessionStorage.getItem(storageKey(shellKey)) === 'true';
    } catch {
      return false;
    }
  };

  const [expanded, setExpanded] = React.useState(readSessionExpanded);

  React.useEffect(() => {
    setExpanded(readSessionExpanded());
  }, [
    appearanceChrome?.expanded,
    appearanceSession?.effective.layoutWidth,
    canUserToggle,
    defaultWidth,
    document.metadata.updatedAt,
    shellKey,
  ]);

  const activeWidth: ShellLayoutWidth = appearanceChrome?.activeWidth
    ?? (canUserToggle && defaultWidth === 'bounded' && expanded ? 'fluid' : defaultWidth);

  const toggle = React.useCallback(() => {
    if (appShellChrome) {
      if (!layoutWidthUserControlAllowed) {
        return;
      }
      if (shellExperience?.ready && appearanceSession) {
        const layoutWidth: ShellLayoutWidth = activeWidth === 'bounded' ? 'fluid' : 'bounded';
        void saveUserShellExperience({
          version: 1,
          layoutWidth,
        })
          .then(() => invalidateAppearanceSession(queryClient, shellExperience.mountId))
          .catch(() => undefined);
        return;
      }
    }

    if (!canUserToggle || defaultWidth !== 'bounded') {
      return;
    }
    setExpanded((current) => {
      const next = !current;
      const layoutWidth: ShellLayoutWidth = next ? 'fluid' : 'bounded';
      if (shellExperience?.ready) {
        void saveUserShellExperience({
          version: 1,
          layoutWidth,
        })
          .then(() => invalidateAppearanceSession(queryClient, shellExperience.mountId))
          .catch(() => undefined);
      }
      try {
        if (next) {
          sessionStorage.setItem(storageKey(shellKey), 'true');
        } else {
          sessionStorage.removeItem(storageKey(shellKey));
        }
      } catch {
        // ignore storage failures
      }
      return next;
    });
  }, [
    activeWidth,
    appearanceSession,
    appShellChrome,
    canUserToggle,
    defaultWidth,
    layoutWidthUserControlAllowed,
    queryClient,
    shellExperience?.mountId,
    shellExperience?.ready,
    shellKey,
  ]);

  const value = React.useMemo<ShellLayoutWidthContextValue>(() => ({
    document,
    defaultWidth,
    activeWidth,
    canUserToggle,
    headerControlVisible,
    isExpanded: activeWidth === 'fluid',
    toggle,
  }), [activeWidth, canUserToggle, defaultWidth, document, expanded, headerControlVisible, toggle]);

  return (
    <ShellLayoutWidthContext.Provider value={value}>
      {children}
    </ShellLayoutWidthContext.Provider>
  );
};
