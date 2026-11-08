import * as React from 'react';
import { cn } from '../../../lib/utils';
import {
  LANDING_APP_WIDGET_IDS,
  LANDING_WIDGET_CATALOG,
  LANDING_WIDGET_FIXTURES,
  LANDING_WIDGET_IDS,
  LandingWidgetRenderer,
  type LandingTarget,
  type LandingWidgetId,
} from '../../../shared/ui';
import {
  CreativeCheckbox,
  CreativeDiagnostics,
  CreativeSelect,
  CreativeWorkspace,
} from '../creative/CreativeWorkspacePrimitives';

export type LandingWidgetsGalleryConfig = {
  widgetId: LandingWidgetId;
  variant: 'default' | 'compact' | 'editorial';
  target: LandingTarget;
  viewport: 'desktop' | 'tablet' | 'phone';
  fallback: 'runtime' | 'static';
  reducedMotion: boolean;
  saveData: boolean;
};

export const DEFAULT_LANDING_WIDGETS_GALLERY_CONFIG: LandingWidgetsGalleryConfig = {
  widgetId: 'landing-hero-split',
  variant: 'default',
  target: 'site',
  viewport: 'desktop',
  fallback: 'runtime',
  reducedMotion: false,
  saveData: false,
};

export function getLandingWidgetIds(target: LandingTarget): readonly LandingWidgetId[] {
  return target === 'site'
    ? LANDING_WIDGET_IDS
    : LANDING_WIDGET_IDS.filter((id) => LANDING_APP_WIDGET_IDS.has(id));
}

export function normalizeLandingWidgetsConfig(
  config: LandingWidgetsGalleryConfig,
): LandingWidgetsGalleryConfig {
  const ids = getLandingWidgetIds(config.target);
  const widgetId = ids.includes(config.widgetId) ? config.widgetId : ids[0];
  const meta = LANDING_WIDGET_CATALOG[widgetId];
  const runtimeActive = config.fallback === 'runtime';
  return {
    ...config,
    widgetId,
    fallback: meta.runtimeEngine === 'static' ? 'static' : config.fallback,
    reducedMotion: runtimeActive && meta.runtimeEngine !== 'static' && config.reducedMotion,
    saveData: runtimeActive && meta.costTier !== 'low' && config.saveData,
  };
}

export function exportLandingWidgetsGalleryConfig(config: LandingWidgetsGalleryConfig) {
  const normalized = normalizeLandingWidgetsConfig(config);
  const meta = LANDING_WIDGET_CATALOG[normalized.widgetId];
  return {
    public: {
      target: normalized.target,
      viewport: normalized.viewport,
      fallback: normalized.fallback,
    },
    composition: {
      widgetId: normalized.widgetId,
      variant: normalized.variant,
      props: LANDING_WIDGET_FIXTURES[normalized.widgetId].props,
    },
    demo: {
      fixtures: { fixtureId: normalized.widgetId },
      scenarios: {
        reducedMotion: normalized.reducedMotion,
        saveData: normalized.saveData,
        runtimeEngine: meta.runtimeEngine,
      },
    },
  };
}

const widthClass = {
  desktop: 'max-w-none',
  tablet: 'mx-auto max-w-[44rem]',
  phone: 'mx-auto max-w-[22rem]',
} as const;

const variantClass = {
  default: '',
  compact: '[&>div]:text-sm',
  editorial: '[&>div]:font-serif',
} as const;

export const LandingWidgetsBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = React.useState(DEFAULT_LANDING_WIDGETS_GALLERY_CONFIG);
  const normalized = normalizeLandingWidgetsConfig(config);
  const meta = LANDING_WIDGET_CATALOG[normalized.widgetId];
  const ids = getLandingWidgetIds(normalized.target);
  const runtimeActive = normalized.fallback === 'runtime';
  const showReducedMotion = runtimeActive && meta.runtimeEngine !== 'static';
  const showSaveData = runtimeActive && meta.costTier !== 'low';
  const effectiveFallback =
    normalized.fallback === 'static' || normalized.reducedMotion || normalized.saveData;
  const exported = exportLandingWidgetsGalleryConfig(normalized);

  const update = <K extends keyof LandingWidgetsGalleryConfig>(
    key: K,
    value: LandingWidgetsGalleryConfig[K],
  ) => setConfig((current) => normalizeLandingWidgetsConfig({ ...current, [key]: value }));

  return (
    <CreativeWorkspace
      sectionId="landing-widgets"
      json={JSON.stringify(exported, null, 2)}
      onReset={() => setConfig(DEFAULT_LANDING_WIDGETS_GALLERY_CONFIG)}
      primaryControls={(
        <>
          <CreativeSelect label="Widget" value={normalized.widgetId} options={ids} onChange={(value) => update('widgetId', value)} />
          <CreativeSelect label="Variant" value={normalized.variant} options={['default', 'compact', 'editorial']} onChange={(value) => update('variant', value)} />
          <CreativeSelect label="Experience" value={normalized.target} options={['site', 'app']} onChange={(value) => update('target', value)} />
          <CreativeSelect label="Viewport" value={normalized.viewport} options={['desktop', 'tablet', 'phone']} onChange={(value) => update('viewport', value)} />
        </>
      )}
      fallbackControls={(
        <>
          {meta.runtimeEngine !== 'static' ? <CreativeSelect label="Engine fallback" value={normalized.fallback} options={['runtime', 'static']} onChange={(value) => update('fallback', value)} /> : null}
          {showReducedMotion ? <CreativeCheckbox label="Reduced motion" checked={normalized.reducedMotion} onChange={(value) => update('reducedMotion', value)} /> : null}
          {showSaveData ? <CreativeCheckbox label="Save-Data" checked={normalized.saveData} onChange={(value) => update('saveData', value)} /> : null}
        </>
      )}
    >
      <CreativeDiagnostics entries={[
        { label: 'Export', value: meta.componentName },
        { label: 'Engine', value: meta.runtimeEngine },
        { label: 'Cost', value: meta.costTier },
        { label: 'Projection', value: effectiveFallback ? meta.fallback : 'runtime' },
      ]} />
      <div
        className={cn(
          'w-full overflow-hidden rounded-xl border border-slate-200 bg-white',
          widthClass[normalized.viewport],
          variantClass[normalized.variant],
        )}
        data-creative-fallback={effectiveFallback || undefined}
      >
        <LandingWidgetRenderer
          config={LANDING_WIDGET_FIXTURES[normalized.widgetId]}
          target={normalized.target}
          invalidFallback={<p className="p-6 text-sm text-slate-600">The selected widget is not compatible with this experience.</p>}
        />
      </div>
    </CreativeWorkspace>
  );
};
