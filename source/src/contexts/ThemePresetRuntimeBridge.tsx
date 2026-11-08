import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAccentTheme } from './AccentThemeContext';
import { useAuth } from './AuthContext';
import { useClientContext } from './ClientContextContext';
import { resolveActiveAppearanceSwatchId } from '../features/appearance/lib/appearanceRoute';
import { useThemePresetQuery } from '../shared/api/queries/appearance-presets';
import { isLoginPath } from '../shared/theme/accentThemePreference';
import {
  applyThemeTokenMapToDocument,
  persistThemeTokenMap,
  reconcileNeutralChromeTokens,
} from '../shared/theme/themePresetUtils';
import {
  getAppearanceLivePreviewTokens,
  subscribeAppearanceLivePreview,
} from '../shared/theme/appearanceLivePreview';
import {
  THEME_PRESETS_CONTEXT_KEY,
  getUserThemePresetTokens,
} from '../shared/theme/userThemePresets';

/**
 * Applies the logged-in user's Theme Designer tokens (or the public catalog
 * fallback) whenever the active accent swatch changes.
 */
export const ThemePresetRuntimeBridge = (): null => {
  const { pathname } = useLocation();
  const { accentHex } = useAccentTheme();
  const { isAuthenticated } = useAuth();
  const { clientContext } = useClientContext();
  const swatchId = useMemo(
    () => resolveActiveAppearanceSwatchId(accentHex),
    [accentHex],
  );
  const userTokens = useMemo(
    () => getUserThemePresetTokens(clientContext[THEME_PRESETS_CONTEXT_KEY], swatchId),
    [clientContext, swatchId],
  );
  const presetQuery = useThemePresetQuery(swatchId, {
    enabled: isAuthenticated && !isLoginPath(pathname),
  });
  const [livePreviewTokens, setLivePreviewTokens] = useState(
    () => getAppearanceLivePreviewTokens(),
  );

  useEffect(() => subscribeAppearanceLivePreview(() => {
    setLivePreviewTokens(getAppearanceLivePreviewTokens());
  }), []);

  useEffect(() => {
    if (isLoginPath(pathname) || !isAuthenticated) {
      return;
    }

    const previewTokens = getAppearanceLivePreviewTokens();
    if (previewTokens) {
      applyThemeTokenMapToDocument(previewTokens);
      return;
    }

    const preset = presetQuery.data;
    if (preset?.tokens) {
      const tokens = reconcileNeutralChromeTokens(preset.tokens, preset.baseHex, preset.source);
      applyThemeTokenMapToDocument(tokens);
      persistThemeTokenMap(tokens);
      return;
    }

    if (userTokens) {
      applyThemeTokenMapToDocument(userTokens);
      persistThemeTokenMap(userTokens);
    }
  }, [isAuthenticated, livePreviewTokens, pathname, presetQuery.data, swatchId, userTokens]);

  return null;
};
