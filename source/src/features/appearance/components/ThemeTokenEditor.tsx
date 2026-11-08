import React, { useMemo } from 'react';
import { Redo2, RotateCcw, Undo2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  buildGradientCss,
  resolveGradientDefinitionFromCss,
} from '../../../shared/lib/gradientDefinition';
import {
  resolveRgbDefinitionFromCss,
} from '../../../shared/lib/rgbDefinition';
import {
  createBorderShadowDefinitionFromShadowCss,
} from '../../../shared/lib/borderShadowDefinition';
import {
  AppButton,
  FormField,
  UiBorderShadowPicker,
  UiGradientPicker,
  UiInput,
  UiSwitch,
  UiVariableColorPicker,
} from '../../../shared/ui';
import { useListPageToolbarScroll } from '../../../shared/lib/useListPageToolbarScroll';
import { ListPageToolbarScrollHost } from '../../../shared/ui/list-page/listPageToolbarChrome';
import {
  atmosphereGeometryTokenValue,
  isAtmosphereGeometryOn,
} from '../../../shared/theme/atmosphereGeometry';
import {
  formatChromeOpacityToken,
  parseChromeOpacityToken,
} from '../../../shared/theme/chromeFinish';
import {
  THEME_TOKEN_CATEGORIES,
  type ThemeTokenDefinition,
} from '../../../shared/theme/themeTokenCatalog';
import { pageGuideLocalProps } from '../../../shared/ui/shell/pageGuide/pageGuideChrome';
import {
  bakeThemeGradientCssForDesigner,
  bakeThemeShadowCssForDesigner,
  resolveThemeTokenCSSValue,
  shouldUseThemeGradientPicker,
  shouldUseThemeVariableColorPicker,
  shouldUseThemeShadowPicker,
} from '../../../shared/theme/themeTokenCssResolver';
import {
  hexToRgbToken,
  rgbTokenToHex,
  type ThemeTokenMap,
} from '../../../shared/theme/themePresetUtils';

export type ThemeTokenEditorProps = {
  tokens: ThemeTokenMap;
  onTokenChange: (key: string, value: string) => void;
  onRegenerateFromBase: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
};

const usesColorPicker = (
  token: ThemeTokenDefinition,
  tokens: ThemeTokenMap,
): boolean => {
  if (token.valueKind !== 'hex' && token.valueKind !== 'rgb') {
    return false;
  }
  return !shouldUseThemeGradientPicker(token, tokens);
};

const usesSpecializedPicker = (
  token: ThemeTokenDefinition,
  tokens: ThemeTokenMap,
): boolean => (
  shouldUseThemeGradientPicker(token, tokens)
  || shouldUseThemeShadowPicker(token, tokens)
  || shouldUseThemeVariableColorPicker(token, tokens)
);

const THEME_COMPACT_TOKEN_CARD_MIN_HEIGHT_CLASS = 'min-h-[42px]';

const THEME_TOKEN_SWATCH_INSET_CLASS = 'inset-1';

const THEME_TOKEN_SWATCH_CHECKER_CLASS = [
  'bg-[length:8px_8px]',
  'bg-[linear-gradient(45deg,#e2e8f0_25%,transparent_25%,transparent_75%,#e2e8f0_75%,#e2e8f0),linear-gradient(45deg,#e2e8f0_25%,transparent_25%,transparent_75%,#e2e8f0_75%,#e2e8f0)]',
  'bg-[position:0_0,4px_4px]',
].join(' ');

const THEME_CATEGORY_LABEL_CLASS: Record<string, string> = {
  brand: 'text-primary-700',
  surfaces: 'text-slate-700',
  borders: 'text-amber-800',
  atmosphere: 'text-cyan-800',
  logo: 'text-violet-800',
  nav: 'text-indigo-800',
  effects: 'text-emerald-800',
  interaction: 'text-sky-800',
};

const hexRelativeLuminance = (hex: string): number => {
  const normalized = hex.replace('#', '').trim();
  if (normalized.length !== 6) {
    return 0.5;
  }
  const channel = (pair: string) => {
    const value = parseInt(pair, 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const r = channel(normalized.slice(0, 2));
  const g = channel(normalized.slice(2, 4));
  const b = channel(normalized.slice(4, 6));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const formatTokenHexLabel = (hex: string): string => (
  hex.startsWith('#') ? hex.toUpperCase() : hex
);

const TokenValueCaption: React.FC<{ value: string }> = ({ value }) => (
  <div className="truncate font-mono text-[10px] font-medium tabular-nums text-slate-500" title={value}>
    {value}
  </div>
);

const THEME_PERCENT_RANGE_CLASS = [
  'absolute inset-0 z-[1] h-full w-full cursor-pointer appearance-none bg-transparent',
  '[&::-webkit-slider-thumb]:size-0 [&::-webkit-slider-thumb]:appearance-none',
  '[&::-moz-range-thumb]:size-0 [&::-moz-range-thumb]:border-0',
].join(' ');

const ThemeTokenSwatchSlot: React.FC<{
  children: React.ReactNode;
  title?: string;
}> = ({ children, title }) => (
  <div
    className={cn(
      'relative w-10 shrink-0 self-stretch overflow-hidden border-s border-slate-200',
      THEME_TOKEN_SWATCH_CHECKER_CLASS,
      THEME_COMPACT_TOKEN_CARD_MIN_HEIGHT_CLASS,
    )}
    title={title}
  >
    <div className={cn('absolute overflow-hidden rounded-[2px]', THEME_TOKEN_SWATCH_INSET_CLASS)}>
      {children}
    </div>
  </div>
);

const tokenCardSpanClass = (
  token: ThemeTokenDefinition,
  tokens: ThemeTokenMap,
): string => {
  if (token.valueKind === 'percent') {
    return 'col-span-2';
  }
  if (token.valueKind === 'css' && !usesSpecializedPicker(token, tokens)) {
    return 'col-span-full';
  }
  return '';
};

const ToggleTokenCard: React.FC<{
  token: ThemeTokenDefinition;
  tokens: ThemeTokenMap;
  onChange: (value: string) => void;
}> = ({ token, tokens, onChange }) => {
  const enabled = isAtmosphereGeometryOn(tokens[token.key]);

  return (
    <div
      title={token.description}
      className={cn(
        'relative flex items-stretch overflow-hidden rounded-lg border border-slate-200 bg-white',
        THEME_COMPACT_TOKEN_CARD_MIN_HEIGHT_CLASS,
      )}
      {...pageGuideLocalProps(token.label, token.description, 20)}
    >
      <div className="flex min-w-0 flex-1 items-center px-2 py-1 pe-2">
        <div className="truncate text-[11px] font-semibold text-slate-800">{token.label}</div>
      </div>
      <div className="flex shrink-0 items-center pe-2">
        <UiSwitch
          isSelected={enabled}
          onChange={(selected) => onChange(atmosphereGeometryTokenValue(selected))}
          aria-label={token.label}
        />
      </div>
    </div>
  );
};

const PercentTokenCard: React.FC<{
  token: ThemeTokenDefinition;
  tokens: ThemeTokenMap;
  onChange: (value: string) => void;
}> = ({ token, tokens, onChange }) => {
  const percent = parseChromeOpacityToken(tokens[token.key]);

  return (
    <div
      title={token.description}
      className={cn(
        'relative flex items-stretch overflow-hidden rounded-lg border border-slate-200 bg-white',
        THEME_COMPACT_TOKEN_CARD_MIN_HEIGHT_CLASS,
      )}
      {...pageGuideLocalProps(token.label, token.description, 20)}
    >
      <div className="flex min-w-0 flex-1 items-center px-2 py-1 pe-2">
        <div className="truncate text-[11px] font-semibold text-slate-800">{token.label}</div>
      </div>
      <div className="flex w-[8.5rem] shrink-0 items-center gap-2 pe-2">
        <div className="relative h-2 min-w-0 flex-1 rounded-full bg-slate-200/90">
          <div
            className="absolute inset-y-0 start-0 rounded-full bg-gradient-to-r from-primary-500 to-primary-600"
            style={{ width: `${percent}%` }}
          />
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={percent}
            aria-label={token.label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-valuetext={`${percent}%`}
            onChange={(event) => onChange(formatChromeOpacityToken(Number(event.target.value)))}
            className={THEME_PERCENT_RANGE_CLASS}
          />
          <div
            className="pointer-events-none absolute top-1/2 z-[2] h-4 w-2.5 -translate-y-1/2 rounded border border-slate-200 bg-white shadow-sm"
            style={{ insetInlineStart: `calc(${percent}% - 5px)` }}
          />
        </div>
        <span className="w-8 shrink-0 text-end text-[10px] font-semibold tabular-nums text-slate-500">
          {percent}%
        </span>
      </div>
    </div>
  );
};

const resolvePickerHex = (
  token: ThemeTokenDefinition,
  tokens: ThemeTokenMap,
): string => {
  const resolved = resolveThemeTokenCSSValue(tokens, token.key);
  if (token.valueKind === 'rgb') {
    return rgbTokenToHex(resolved);
  }
  return resolved.startsWith('#') ? resolved : '#00A28A';
};

const ColorTokenCard: React.FC<{
  token: ThemeTokenDefinition;
  tokens: ThemeTokenMap;
  onChange: (value: string) => void;
}> = ({ token, tokens, onChange }) => {
  const resolved = resolveThemeTokenCSSValue(tokens, token.key);
  const hex = resolvePickerHex(token, tokens);
  const pickerTitle = token.valueKind === 'rgb' ? (resolved.trim() || hex) : hex;

  const handleChange = (nextHex: string) => {
    if (token.valueKind === 'rgb') {
      onChange(hexToRgbToken(nextHex));
      return;
    }
    onChange(nextHex.toUpperCase());
  };

  return (
    <div
      title={token.description}
      className={cn(
        'relative flex items-stretch overflow-hidden rounded-lg border border-slate-200 bg-white',
        THEME_COMPACT_TOKEN_CARD_MIN_HEIGHT_CLASS,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col justify-center px-2 py-1 pe-2">
        <div className="truncate text-[11px] font-semibold text-slate-800">{token.label}</div>
        <TokenValueCaption value={formatTokenHexLabel(hex)} />
      </div>
      <ThemeTokenSwatchSlot title={pickerTitle}>
        <label className="relative block h-full w-full cursor-pointer">
          <span
            className={cn(
              'absolute inset-0 rounded-[2px]',
              hexRelativeLuminance(hex) > 0.9 && 'ring-1 ring-inset ring-slate-300',
            )}
            style={{ backgroundColor: hex }}
            aria-hidden
          />
          <input
            type="color"
            value={hex}
            onChange={(event) => handleChange(event.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label={`${token.label} color picker`}
          />
        </label>
      </ThemeTokenSwatchSlot>
    </div>
  );
};

const VariableColorTokenCard: React.FC<{
  token: ThemeTokenDefinition;
  tokens: ThemeTokenMap;
  onChange: (value: string) => void;
}> = ({ token, tokens, onChange }) => {
  const rawValue = tokens[token.key] ?? '';
  const definition = useMemo(
    () => resolveRgbDefinitionFromCss(rawValue),
    [rawValue],
  );

  return (
    <div
      title={token.description}
      className={cn(
        'relative flex items-stretch overflow-hidden rounded-lg border border-slate-200 bg-white',
        THEME_COMPACT_TOKEN_CARD_MIN_HEIGHT_CLASS,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col justify-center px-2 py-1 pe-2">
        <div className="truncate text-[11px] font-semibold text-slate-800">{token.label}</div>
        <TokenValueCaption value={rawValue.trim() || '—'} />
      </div>
      <ThemeTokenSwatchSlot>
        <UiVariableColorPicker
          variant="popover"
          size="sm"
          compact
          value={definition}
          onChange={(_, css) => onChange(css)}
          showCssOutput={false}
          showPresets
          showSourceSelector
          showTriggerCss={false}
          className="h-full w-full"
          ariaLabel={`${token.label} variable color picker`}
        />
      </ThemeTokenSwatchSlot>
    </div>
  );
};

const GradientTokenCard: React.FC<{
  token: ThemeTokenDefinition;
  tokens: ThemeTokenMap;
  onChange: (value: string) => void;
}> = ({ token, tokens, onChange }) => {
  const resolvedValue = useMemo(
    () => bakeThemeGradientCssForDesigner(resolveThemeTokenCSSValue(tokens, token.key), tokens),
    [token.key, tokens],
  );
  const definition = useMemo(
    () => resolveGradientDefinitionFromCss(resolvedValue),
    [resolvedValue],
  );
  const swatchBackground = resolvedValue.trim() || buildGradientCss(definition);

  return (
    <div
      title={token.description}
      className={cn(
        'relative flex items-stretch overflow-hidden rounded-lg border border-slate-200 bg-white',
        THEME_COMPACT_TOKEN_CARD_MIN_HEIGHT_CLASS,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col justify-center px-2 py-1 pe-2">
        <div className="truncate text-[11px] font-semibold text-slate-800">{token.label}</div>
        <TokenValueCaption value="Gradient" />
      </div>
      <ThemeTokenSwatchSlot>
        <UiGradientPicker
          variant="popover"
          size="sm"
          compact
          value={definition}
          onChange={(_, css) => onChange(css)}
          showCssOutput={false}
          showPresets
          showTypeSelector
          showReverse
          showTriggerCss={false}
          triggerBackground={swatchBackground}
          className="h-full w-full"
          ariaLabel={`${token.label} gradient picker`}
        />
      </ThemeTokenSwatchSlot>
    </div>
  );
};

const ShadowTokenCard: React.FC<{
  token: ThemeTokenDefinition;
  tokens: ThemeTokenMap;
  onChange: (value: string) => void;
}> = ({ token, tokens, onChange }) => {
  const resolvedValue = useMemo(
    () => bakeThemeShadowCssForDesigner(resolveThemeTokenCSSValue(tokens, token.key), tokens),
    [token.key, tokens],
  );
  const definition = useMemo(
    () => createBorderShadowDefinitionFromShadowCss(resolvedValue),
    [resolvedValue],
  );

  return (
    <div
      title={token.description}
      className={cn(
        'relative flex items-stretch overflow-hidden rounded-lg border border-slate-200 bg-white',
        THEME_COMPACT_TOKEN_CARD_MIN_HEIGHT_CLASS,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col justify-center px-2 py-1 pe-2">
        <div className="truncate text-[11px] font-semibold text-slate-800">{token.label}</div>
        <TokenValueCaption value={resolvedValue.trim() || 'Shadow'} />
      </div>
      <ThemeTokenSwatchSlot>
        <UiBorderShadowPicker
          variant="popover"
          size="sm"
          compact
          value={definition}
          onChange={(_, css) => onChange(css.shadow)}
          showCssOutput={false}
          showPresets
          showReverse
          showTriggerCss={false}
          className="h-full w-full"
          ariaLabel={`${token.label} border and shadow picker`}
        />
      </ThemeTokenSwatchSlot>
    </div>
  );
};

export const ThemeTokenEditor: React.FC<ThemeTokenEditorProps> = ({
  tokens,
  onTokenChange,
  onRegenerateFromBase,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}) => {
  const { listToolbarCollapsed, handleGridScroll } = useListPageToolbarScroll();

  return (
  <div className="flex min-h-0 min-w-0 flex-1 flex-col" id="appearance-atmosphere-tokens">
    <p className="border-b border-slate-200 bg-white px-4 py-2 text-xs text-slate-600">
      Frost, textures, washes, and nav chrome for your accent. Changes save with your theme preset automatically.
    </p>
    <ListPageToolbarScrollHost collapsed={listToolbarCollapsed}>
    <div
      className={cn(
        'flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2')}
    >
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <AppButton intent="utility" size="sm" onClick={onRegenerateFromBase}>
          <RotateCcw className="h-3.5 w-3.5 text-rose-600" />
          Reset atmosphere to catalog
        </AppButton>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <AppButton
          intent="utility"
          size="icon-sm"
          aria-label="Undo"
          title="Undo"
          onClick={onUndo}
          disabled={!canUndo}
        >
          <Undo2 className="h-3.5 w-3.5" />
        </AppButton>
        <AppButton
          intent="utility"
          size="icon-sm"
          aria-label="Redo"
          title="Redo"
          onClick={onRedo}
          disabled={!canRedo}
        >
          <Redo2 className="h-3.5 w-3.5" />
        </AppButton>
      </div>
    </div>
    </ListPageToolbarScrollHost>

    <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-5" onScroll={handleGridScroll}>
      {THEME_TOKEN_CATEGORIES.map((category) => (
        <section key={category.id} className="min-w-0 max-w-full">
          <div className="mb-2">
            <h3 className={cn(
              'text-xs font-bold uppercase tracking-[0.08em]',
              THEME_CATEGORY_LABEL_CLASS[category.id] ?? 'text-slate-600',
            )}
            >
              {category.label}
            </h3>
            <p className="text-[11px] text-slate-500">{category.description}</p>
          </div>
          <div className="grid min-w-0 max-w-full grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5">
            {category.tokens.map((token) => {
              if (token.valueKind === 'toggle') {
                return (
                  <div key={token.key} className={tokenCardSpanClass(token, tokens)}>
                    <ToggleTokenCard
                      token={token}
                      tokens={tokens}
                      onChange={(next) => onTokenChange(token.key, next)}
                    />
                  </div>
                );
              }

              if (token.valueKind === 'percent') {
                return (
                  <div key={token.key} className={tokenCardSpanClass(token, tokens)}>
                    <PercentTokenCard
                      token={token}
                      tokens={tokens}
                      onChange={(next) => onTokenChange(token.key, next)}
                    />
                  </div>
                );
              }

              if (shouldUseThemeGradientPicker(token, tokens)) {
                return (
                  <div key={token.key} className={tokenCardSpanClass(token, tokens)}>
                    <GradientTokenCard
                      token={token}
                      tokens={tokens}
                      onChange={(next) => onTokenChange(token.key, next)}
                    />
                  </div>
                );
              }

              if (shouldUseThemeShadowPicker(token, tokens)) {
                return (
                  <div key={token.key} className={tokenCardSpanClass(token, tokens)}>
                    <ShadowTokenCard
                      token={token}
                      tokens={tokens}
                      onChange={(next) => onTokenChange(token.key, next)}
                    />
                  </div>
                );
              }

              if (shouldUseThemeVariableColorPicker(token, tokens)) {
                return (
                  <div key={token.key} className={tokenCardSpanClass(token, tokens)}>
                    <VariableColorTokenCard
                      token={token}
                      tokens={tokens}
                      onChange={(next) => onTokenChange(token.key, next)}
                    />
                  </div>
                );
              }

              if (usesColorPicker(token, tokens)) {
                return (
                  <div key={token.key} className={tokenCardSpanClass(token, tokens)}>
                    <ColorTokenCard
                      token={token}
                      tokens={tokens}
                      onChange={(next) => onTokenChange(token.key, next)}
                    />
                  </div>
                );
              }

              return (
                <div
                  key={token.key}
                  title={token.description}
                  className={cn(
                    'flex min-w-0 flex-col gap-2 rounded-lg border border-slate-200 bg-white p-2.5',
                    tokenCardSpanClass(token, tokens),
                  )}
                >
                  <div className="min-w-0">
                    <div className="truncate text-[11px] font-semibold text-slate-800">{token.label}</div>
                    <div className="truncate font-mono text-[10px] text-slate-500">{token.key}</div>
                  </div>
                  <FormField label="CSS value">
                    <UiInput
                      size="sm"
                      value={tokens[token.key] ?? ''}
                      onChange={(event) => onTokenChange(token.key, event.target.value)}
                      aria-label={token.label}
                      className="font-mono text-xs"
                    />
                  </FormField>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  </div>
  );
};
