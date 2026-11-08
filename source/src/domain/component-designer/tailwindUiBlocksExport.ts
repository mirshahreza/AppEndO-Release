import {
  renderBoundJsxTextExpression,
  resolveNodePropertyBindingExpression,
} from './bindingCodegen';
import { escapeJsxTextContent, jsxAttributeStringValue } from './tsxPropMapper';
import type { DesignerNode } from './types';
import type { TsxBindingRenderContext } from './bindingCodegen';
import { readBoolean, readString } from './runtimeShared';

const parseCommaList = (value: string): string[] =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

const resolveTextContent = (
  node: DesignerNode,
  prop: string,
  bindingContext: TsxBindingRenderContext | undefined,
): string => {
  const literal = readString(node.props[prop]);
  const bindingExpr = bindingContext
    ? resolveNodePropertyBindingExpression(node.id, prop, bindingContext)
    : null;
  if (bindingExpr) {
    return renderBoundJsxTextExpression(bindingExpr, literal);
  }
  return escapeJsxTextContent(literal);
};

const hasTextContent = (
  node: DesignerNode,
  prop: string,
  bindingContext: TsxBindingRenderContext | undefined,
): boolean => {
  if (bindingContext && resolveNodePropertyBindingExpression(node.id, prop, bindingContext)) {
    return true;
  }
  return readString(node.props[prop]).length > 0;
};

export const renderTailwindUiBlockInnerJsx = (
  paletteItemId: string,
  node: DesignerNode,
  bindingContext?: TsxBindingRenderContext,
): string => {
  switch (paletteItemId) {
    case 'tailwind.card': {
      const hasTitle = hasTextContent(node, 'title', bindingContext);
      const hasDescription = hasTextContent(node, 'description', bindingContext);
      if (!hasTitle && !hasDescription) {
        return '';
      }
      return `${hasTitle ? `<p className="text-base font-semibold text-foreground">${resolveTextContent(node, 'title', bindingContext)}</p>` : ''}${hasDescription ? `<p className="mt-1 text-sm text-default-600">${resolveTextContent(node, 'description', bindingContext)}</p>` : ''}`;
    }
    case 'tailwind.card-glass': {
      const imageSrc = readString(node.props.imageSrc);
      const hasTitle = hasTextContent(node, 'title', bindingContext);
      const hasDescription = hasTextContent(node, 'description', bindingContext);
      if (!imageSrc && !hasTitle && !hasDescription) {
        return '';
      }
      return `${imageSrc ? `<img src=${jsxAttributeStringValue(imageSrc)} alt="" className="mb-3 h-32 w-full rounded-lg object-cover" />` : ''}${hasTitle ? `<p className="text-base font-semibold text-foreground">${resolveTextContent(node, 'title', bindingContext)}</p>` : ''}${hasDescription ? `<p className="mt-1 text-sm text-default-600">${resolveTextContent(node, 'description', bindingContext)}</p>` : ''}`;
    }
    case 'tailwind.stat-block': {
      const hasLabel = hasTextContent(node, 'label', bindingContext);
      const hasValue = hasTextContent(node, 'value', bindingContext);
      const hasTrend = hasTextContent(node, 'trend', bindingContext);
      if (!hasLabel && !hasValue && !hasTrend) {
        return '';
      }
      const trendDirection = readString(node.props.trendDirection, 'up');
      const trendClass = trendDirection === 'down'
        ? 'mt-1 text-sm font-medium text-danger'
        : 'mt-1 text-sm font-medium text-success';
      return `${hasLabel ? `<p className="text-xs font-medium uppercase tracking-wide text-default-500">${resolveTextContent(node, 'label', bindingContext)}</p>` : ''}${hasValue ? `<p className="mt-1 text-2xl font-semibold text-foreground">${resolveTextContent(node, 'value', bindingContext)}</p>` : ''}${hasTrend ? `<p className="${trendClass}">${resolveTextContent(node, 'trend', bindingContext)}</p>` : ''}`;
    }
    case 'tailwind.pricing': {
      const hasPlanName = hasTextContent(node, 'planName', bindingContext);
      const hasPrice = hasTextContent(node, 'price', bindingContext);
      const hasBillingPeriod = hasTextContent(node, 'billingPeriod', bindingContext);
      const hasCta = hasTextContent(node, 'ctaLabel', bindingContext);
      const features = parseCommaList(readString(node.props.features));
      const isHighlighted = readBoolean(node.props.isHighlighted);
      if (!hasPlanName && !hasPrice && features.length === 0 && !hasCta) {
        return '';
      }
      const featureItems = features.map((feature) => `<li>${escapeJsxTextContent(feature)}</li>`).join('');
      return `${isHighlighted ? '<span className="inline-flex w-fit rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">Featured</span>' : ''}${hasPlanName ? `<p className="text-lg font-semibold text-foreground">${resolveTextContent(node, 'planName', bindingContext)}</p>` : ''}${hasPrice ? `<p className="mt-2 text-3xl font-bold tracking-tight text-foreground">${resolveTextContent(node, 'price', bindingContext)}${hasBillingPeriod ? `<span className="text-base font-normal text-default-500">${resolveTextContent(node, 'billingPeriod', bindingContext)}</span>` : ''}</p>` : ''}${featureItems ? `<ul className="mt-3 list-disc space-y-1 ps-5 text-sm text-default-700">${featureItems}</ul>` : ''}${hasCta ? `<span className="mt-4 inline-flex rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">${resolveTextContent(node, 'ctaLabel', bindingContext)}</span>` : ''}`;
    }
    case 'tailwind.alert': {
      const hasTitle = hasTextContent(node, 'title', bindingContext);
      const hasMessage = hasTextContent(node, 'message', bindingContext);
      if (!hasTitle && !hasMessage) {
        return '';
      }
      const variant = readString(node.props.variant, 'warning');
      const variantClass = {
        info: 'border-sky-200 bg-sky-50 text-sky-900',
        success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
        warning: 'border-amber-200 bg-amber-50 text-amber-900',
        danger: 'border-rose-200 bg-rose-50 text-rose-900',
      }[variant] ?? 'border-amber-200 bg-amber-50 text-amber-900';
      return `<div className={\`relative rounded-lg border px-4 py-3 ${variantClass}\`} role="alert">${hasTitle ? `<p className="text-sm font-semibold">${resolveTextContent(node, 'title', bindingContext)}</p>` : ''}${hasMessage ? `<p className="mt-1 text-sm opacity-90">${resolveTextContent(node, 'message', bindingContext)}</p>` : ''}</div>`;
    }
    case 'tailwind.hero': {
      const hasHeading = hasTextContent(node, 'heading', bindingContext);
      const hasSubheading = hasTextContent(node, 'subheading', bindingContext);
      const hasPrimaryCta = hasTextContent(node, 'primaryCta', bindingContext);
      const hasSecondaryCta = hasTextContent(node, 'secondaryCta', bindingContext);
      const backgroundImage = readString(node.props.backgroundImage);
      if (!hasHeading && !hasSubheading && !hasPrimaryCta && !hasSecondaryCta && !backgroundImage) {
        return '';
      }
      const bgStyle = backgroundImage
        ? ` style={{ backgroundImage: ${jsxAttributeStringValue(`linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url(${backgroundImage})`)}, backgroundSize: 'cover', backgroundPosition: 'center' }}`
        : '';
      return `<div className="relative overflow-hidden rounded-[inherit]"${bgStyle}>${hasHeading ? `<h2 className="text-2xl font-bold tracking-tight">${resolveTextContent(node, 'heading', bindingContext)}</h2>` : ''}${hasSubheading ? `<p className="mt-2 max-w-2xl text-sm text-white/90">${resolveTextContent(node, 'subheading', bindingContext)}</p>` : ''}${hasPrimaryCta || hasSecondaryCta ? `<div className="mt-4 flex flex-wrap gap-2">${hasPrimaryCta ? `<span className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-900">${resolveTextContent(node, 'primaryCta', bindingContext)}</span>` : ''}${hasSecondaryCta ? `<span className="rounded-lg border border-white/50 px-3 py-2 text-sm font-medium">${resolveTextContent(node, 'secondaryCta', bindingContext)}</span>` : ''}</div>` : ''}</div>`;
    }
    case 'tailwind.image-overlay': {
      const imageSrc = readString(node.props.imageSrc);
      const hasOverlayText = hasTextContent(node, 'overlayText', bindingContext);
      const overlayOpacity = Number.parseFloat(readString(node.props.overlayOpacity, '0.55'));
      const safeOpacity = Number.isFinite(overlayOpacity) ? Math.min(1, Math.max(0, overlayOpacity)) : 0.55;
      if (!imageSrc && !hasOverlayText) {
        return '';
      }
      return `<div className="relative min-h-[160px] overflow-hidden rounded-[inherit]">${imageSrc ? `<img src=${jsxAttributeStringValue(imageSrc)} alt="" className="absolute inset-0 h-full w-full object-cover" />` : ''}<div className="absolute inset-0 flex items-end p-4" style={{ backgroundColor: ${jsxAttributeStringValue(`rgba(15, 23, 42, ${safeOpacity})`)} }}>${hasOverlayText ? `<p className="relative z-[1] text-lg font-semibold">${resolveTextContent(node, 'overlayText', bindingContext)}</p>` : ''}</div></div>`;
    }
    default:
      return '';
  }
};

export const TAILWIND_UI_BLOCK_STRUCTURAL_PROP_KEYS: Record<string, ReadonlySet<string>> = {
  'tailwind.card': new Set(['title', 'description']),
  'tailwind.card-glass': new Set(['title', 'description', 'imageSrc']),
  'tailwind.stat-block': new Set(['label', 'value', 'trend', 'trendDirection']),
  'tailwind.pricing': new Set(['planName', 'price', 'billingPeriod', 'features', 'isHighlighted', 'ctaLabel']),
  'tailwind.alert': new Set(['title', 'message', 'variant', 'dismissible']),
  'tailwind.hero': new Set(['heading', 'subheading', 'primaryCta', 'secondaryCta', 'backgroundImage']),
  'tailwind.image-overlay': new Set(['imageSrc', 'overlayText', 'overlayOpacity']),
};
