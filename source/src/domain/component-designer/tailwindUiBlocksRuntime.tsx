import * as React from 'react';
import { readBoolean, readString } from './runtimeShared';
import type { DesignerNode } from './types';

export type TailwindBlockPreviewBindings = {
  resolveTextProp?: (node: DesignerNode, prop: string, fallback?: string) => string;
};

type TailwindBlockRenderOptions = {
  node: DesignerNode;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  previewBindings?: TailwindBlockPreviewBindings;
};

const resolveProp = (
  node: DesignerNode,
  prop: string,
  fallback = '',
  previewBindings?: TailwindBlockPreviewBindings,
): string => {
  if (previewBindings?.resolveTextProp) {
    return previewBindings.resolveTextProp(node, prop, fallback);
  }
  return readString(node.props[prop], fallback);
};

const parseCommaList = (value: string): string[] =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

const variantToneClass: Record<string, string> = {
  info: 'border-sky-200 bg-sky-50 text-sky-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  danger: 'border-rose-200 bg-rose-50 text-rose-900',
};

export const renderTailwindStatBlockContent = ({
  node,
  previewBindings,
}: Pick<TailwindBlockRenderOptions, 'node' | 'previewBindings'>): React.ReactNode => {
  const label = resolveProp(node, 'label', '', previewBindings);
  const value = resolveProp(node, 'value', '', previewBindings);
  const trend = resolveProp(node, 'trend', '', previewBindings);
  const trendDirection = resolveProp(node, 'trendDirection', 'up', previewBindings);
  if (!label && !value && !trend) {
    return null;
  }
  return (
    <>
      {label ? <p className="text-xs font-medium uppercase tracking-wide text-default-500">{label}</p> : null}
      {value ? <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p> : null}
      {trend ? (
        <p className={`mt-1 text-sm font-medium ${trendDirection === 'down' ? 'text-danger' : 'text-success'}`}>
          {trend}
        </p>
      ) : null}
    </>
  );
};

export const renderTailwindPricingBlockContent = ({
  node,
  previewBindings,
}: Pick<TailwindBlockRenderOptions, 'node' | 'previewBindings'>): React.ReactNode => {
  const planName = resolveProp(node, 'planName', '', previewBindings);
  const price = resolveProp(node, 'price', '', previewBindings);
  const billingPeriod = resolveProp(node, 'billingPeriod', '', previewBindings);
  const featuresRaw = resolveProp(node, 'features', '', previewBindings);
  const ctaLabel = resolveProp(node, 'ctaLabel', '', previewBindings);
  const isHighlighted = previewBindings?.resolveTextProp
    ? previewBindings.resolveTextProp(node, 'isHighlighted', String(node.props.isHighlighted === true)) === 'true'
    : readBoolean(node.props.isHighlighted);
  const features = parseCommaList(featuresRaw);
  if (!planName && !price && features.length === 0 && !ctaLabel) {
    return null;
  }
  return (
    <>
      {isHighlighted ? (
        <span className="inline-flex w-fit rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
          Featured
        </span>
      ) : null}
      {planName ? <p className={`text-lg font-semibold text-foreground ${isHighlighted ? 'mt-3' : ''}`}>{planName}</p> : null}
      {price ? (
        <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">
          {price}
          {billingPeriod ? <span className="text-base font-normal text-default-500">{billingPeriod}</span> : null}
        </p>
      ) : null}
      {features.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1 ps-5 text-sm text-default-700">
          {features.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
      ) : null}
      {ctaLabel ? (
        <span className="mt-4 inline-flex rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
          {ctaLabel}
        </span>
      ) : null}
    </>
  );
};

export const TailwindAlertBlockContent: React.FC<{
  node: DesignerNode;
  previewBindings?: TailwindBlockPreviewBindings;
}> = ({ node, previewBindings }) => {
  const [dismissed, setDismissed] = React.useState(false);
  const title = resolveProp(node, 'title', '', previewBindings);
  const message = resolveProp(node, 'message', '', previewBindings);
  const variant = resolveProp(node, 'variant', 'warning', previewBindings);
  const dismissible = previewBindings?.resolveTextProp
    ? previewBindings.resolveTextProp(node, 'dismissible', String(node.props.dismissible === true)) === 'true'
    : readBoolean(node.props.dismissible);

  if (dismissed || (!title && !message)) {
    return null;
  }

  return (
    <div className={`relative rounded-lg border px-4 py-3 ${variantToneClass[variant] ?? variantToneClass.warning}`}>
      {dismissible ? (
        <button
          type="button"
          aria-label="Dismiss alert"
          className="absolute end-2 top-2 rounded p-1 text-xs opacity-70 hover:opacity-100"
          onClick={() => setDismissed(true)}
        >
          ×
        </button>
      ) : null}
      {title ? <p className="pe-6 text-sm font-semibold">{title}</p> : null}
      {message ? <p className="mt-1 pe-6 text-sm opacity-90">{message}</p> : null}
    </div>
  );
};

export const renderTailwindHeroBlockContent = ({
  node,
  previewBindings,
}: Pick<TailwindBlockRenderOptions, 'node' | 'previewBindings'>): React.ReactNode => {
  const heading = resolveProp(node, 'heading', '', previewBindings);
  const subheading = resolveProp(node, 'subheading', '', previewBindings);
  const primaryCta = resolveProp(node, 'primaryCta', '', previewBindings);
  const secondaryCta = resolveProp(node, 'secondaryCta', '', previewBindings);
  const backgroundImage = resolveProp(node, 'backgroundImage', '', previewBindings);
  if (!heading && !subheading && !primaryCta && !secondaryCta && !backgroundImage) {
    return null;
  }
  return (
    <div
      className="relative overflow-hidden rounded-[inherit]"
      style={backgroundImage ? {
        backgroundImage: `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      } : undefined}
    >
      <div className="relative z-[1]">
        {heading ? <h2 className="text-2xl font-bold tracking-tight">{heading}</h2> : null}
        {subheading ? <p className="mt-2 max-w-2xl text-sm text-white/90">{subheading}</p> : null}
        {primaryCta || secondaryCta ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {primaryCta ? (
              <span className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-900">{primaryCta}</span>
            ) : null}
            {secondaryCta ? (
              <span className="rounded-lg border border-white/50 px-3 py-2 text-sm font-medium">{secondaryCta}</span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export const renderTailwindImageOverlayContent = ({
  node,
  previewBindings,
}: Pick<TailwindBlockRenderOptions, 'node' | 'previewBindings'>): React.ReactNode => {
  const imageSrc = resolveProp(node, 'imageSrc', '', previewBindings);
  const overlayText = resolveProp(node, 'overlayText', '', previewBindings);
  const opacityRaw = resolveProp(node, 'overlayOpacity', '0.55', previewBindings);
  const overlayOpacity = Number.parseFloat(opacityRaw);
  const safeOpacity = Number.isFinite(overlayOpacity) ? Math.min(1, Math.max(0, overlayOpacity)) : 0.55;
  if (!imageSrc && !overlayText) {
    return null;
  }
  return (
    <div className="relative min-h-[160px] overflow-hidden rounded-[inherit]">
      {imageSrc ? (
        <img src={imageSrc} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : null}
      <div
        className="absolute inset-0 flex items-end p-4"
        style={{ backgroundColor: `rgba(15, 23, 42, ${safeOpacity})` }}
      >
        {overlayText ? <p className="relative z-[1] text-lg font-semibold">{overlayText}</p> : null}
      </div>
    </div>
  );
};

export const renderTailwindCardGlassContent = ({
  node,
  previewBindings,
}: Pick<TailwindBlockRenderOptions, 'node' | 'previewBindings'>): React.ReactNode => {
  const title = resolveProp(node, 'title', '', previewBindings);
  const description = resolveProp(node, 'description', '', previewBindings);
  const imageSrc = resolveProp(node, 'imageSrc', '', previewBindings);
  if (!title && !description && !imageSrc) {
    return null;
  }
  return (
    <>
      {imageSrc ? <img src={imageSrc} alt="" className="mb-3 h-32 w-full rounded-lg object-cover" /> : null}
      {title ? <p className="text-base font-semibold text-foreground">{title}</p> : null}
      {description ? <p className="mt-1 text-sm text-default-600">{description}</p> : null}
    </>
  );
};

export const renderTailwindCardContent = ({
  node,
  previewBindings,
}: Pick<TailwindBlockRenderOptions, 'node' | 'previewBindings'>): React.ReactNode => {
  const title = resolveProp(node, 'title', '', previewBindings);
  const description = resolveProp(node, 'description', '', previewBindings);
  if (!title && !description) {
    return null;
  }
  return (
    <>
      {title ? <p className="text-base font-semibold text-foreground">{title}</p> : null}
      {description ? <p className="mt-1 text-sm text-default-600">{description}</p> : null}
    </>
  );
};

const TAILWIND_BLOCK_CONTENT_RENDERERS: Record<string, (options: TailwindBlockRenderOptions) => React.ReactNode> = {
  'tailwind.card': renderTailwindCardContent,
  'tailwind.card-glass': renderTailwindCardGlassContent,
  'tailwind.stat-block': renderTailwindStatBlockContent,
  'tailwind.pricing': renderTailwindPricingBlockContent,
  'tailwind.hero': renderTailwindHeroBlockContent,
  'tailwind.image-overlay': renderTailwindImageOverlayContent,
};

export const renderTailwindUiBlockContent = (
  paletteItemId: string,
  options: TailwindBlockRenderOptions,
): React.ReactNode => {
  if (paletteItemId === 'tailwind.alert') {
    return <TailwindAlertBlockContent node={options.node} previewBindings={options.previewBindings} />;
  }
  const renderer = TAILWIND_BLOCK_CONTENT_RENDERERS[paletteItemId];
  return renderer ? renderer(options) : null;
};

export const hasTailwindUiBlockContentProps = (paletteItemId: string, node: DesignerNode): boolean => {
  switch (paletteItemId) {
    case 'tailwind.card':
    case 'tailwind.card-glass':
      return Boolean(readString(node.props.title) || readString(node.props.description) || readString(node.props.imageSrc));
    case 'tailwind.stat-block':
      return Boolean(readString(node.props.label) || readString(node.props.value) || readString(node.props.trend));
    case 'tailwind.pricing':
      return Boolean(
        readString(node.props.planName)
        || readString(node.props.price)
        || readString(node.props.features)
        || readString(node.props.ctaLabel),
      );
    case 'tailwind.alert':
      return Boolean(readString(node.props.title) || readString(node.props.message));
    case 'tailwind.hero':
      return Boolean(
        readString(node.props.heading)
        || readString(node.props.subheading)
        || readString(node.props.primaryCta)
        || readString(node.props.backgroundImage),
      );
    case 'tailwind.image-overlay':
      return Boolean(readString(node.props.imageSrc) || readString(node.props.overlayText));
    default:
      return false;
  }
};
