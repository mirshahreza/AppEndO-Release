import type { DesignerNode } from './types';
import type { TsxBindingRenderContext } from './bindingCodegen';
import {
  renderDesignerItemsMapperExpression,
  resolveContentBoundAttributeForProp,
  resolveNodeOptionItemsDataExpression,
  resolveNodePropertyBindingExpression,
} from './bindingCodegen';
import { isContentDataBoundNode } from './bindingContentEngine';
import { readBoolean, readNumber, readString } from './runtimeShared';
import {
  MOCK_BLOG_POSTS_JSON,
  MOCK_DESCRIPTION_LIST_JSON,
  MOCK_FAQ_ITEMS_JSON,
  MOCK_FEATURE_GRID_JSON,
  MOCK_PRICING_TIERS_JSON,
  MOCK_TEAM_MEMBERS_JSON,
  MOCK_TESTIMONIALS_JSON,
} from './universalMockFixtures';
import { buildNodeJsxAttributesWithBindings, jsxAttributeStringValue, renderNodeJsxAttributes } from './tsxPropMapper';
import { isUniversalStructuralNode } from './designerUniversalRuntime';
import { parseDesignerAutocompleteItems } from './designerAutocompleteItems';
import { DESIGNER_STORE_VAR } from './bindingStoreCodegen';
import { buildRepeaterScopeExpression } from './tsxLogicRenderer';

const UNIVERSAL_IMPORT_SOURCE = '@/domain/component-designer/DesignerRuntimeUniversalWidgets';

const toJsxAttr = (value: string): string => jsxAttributeStringValue(value);

const renderTimeDateTimeConstraintAttrs = (node: DesignerNode, includeTimeZone = false): string => {
  const min = readString(node.props.min);
  const max = readString(node.props.max);
  const step = readNumber(node.props.step, Number.NaN);
  const granularity = readString(node.props.granularity);
  const hourCycle = readString(node.props.hourCycle);
  const timeZone = readString(node.props.timeZone);
  const isRequired = readBoolean(node.props.isRequired) || readBoolean(node.props.required);
  const isDisabled = readBoolean(node.props.isDisabled) || readBoolean(node.props.disabled);
  const isInvalid = readBoolean(node.props.isInvalid);
  const errorMessage = readString(node.props.errorMessage);

  return [
    min.trim().length > 0 ? ` min=${toJsxAttr(min.trim())}` : '',
    max.trim().length > 0 ? ` max=${toJsxAttr(max.trim())}` : '',
    Number.isFinite(step) && step > 0 ? ` step={${step}}` : '',
    granularity.trim().length > 0 ? ` granularity=${toJsxAttr(granularity.trim())}` : '',
    hourCycle.trim().length > 0 ? ` hourCycle=${toJsxAttr(hourCycle.trim())}` : '',
    includeTimeZone && timeZone.trim().length > 0 ? ` timeZone=${toJsxAttr(timeZone.trim())}` : '',
    isRequired ? ' isRequired' : '',
    isDisabled ? ' isDisabled' : '',
    isInvalid ? ' isInvalid' : '',
    errorMessage.trim().length > 0 ? ` errorMessage=${toJsxAttr(errorMessage.trim())}` : '',
  ].join('');
};

const renderAttrs = (
  node: DesignerNode,
  bindingContext: TsxBindingRenderContext | undefined,
  excludeKeys: ReadonlySet<string>,
): string => (bindingContext
  ? buildNodeJsxAttributesWithBindings(node, bindingContext, { excludeKeys })
  : renderNodeJsxAttributes(node, { excludeKeys }));

const renderSelfClosing = (
  componentName: string,
  node: DesignerNode,
  bindingContext: TsxBindingRenderContext | undefined,
  propLiterals: string,
  excludeKeys: string[],
): string => {
  const attrs = renderAttrs(node, bindingContext, new Set(excludeKeys));
  return `<${componentName}${attrs}${propLiterals} />`;
};

/**
 * Bug found (all 26 Universal/Content palette items): every scalar Inspector field on these
 * widgets gets the generic Property Binding "Bind" toggle (InspectorPropFields.tsx's
 * `isBindableField` matches by field type only, not by palette id), and `renderAttrs`'s own
 * bound-attribute pass (`buildNodeJsxAttributesWithBindings`) already emits the correct
 * ` prop={boundExpr}` for it unconditionally. But this function only ever checked the
 * *different*, Dual-Mode "bind to data source" mechanism (`isContentDataBoundNode`) — when a
 * field was bound via the generic mechanism instead (the far more common case), this still fell
 * through to the static literal, producing two `prop=` attributes on one JSX tag (`title={expr}
 * title="literal"`), and JS object-literal semantics make the later, static one win — silently
 * discarding the binding in every exported/published build.
 *
 * Dual-Mode is checked first (unchanged from before this fix) since `resolveContentBoundAttributeForProp`
 * builds a prop-specific expression (e.g. `data`/`slides`/`steps`/`options` get wrapped in
 * `JSON.stringify(Array.isArray(...))`) that the generic `resolveNodePropertyBindingExpression`
 * fallback below does NOT reproduce exactly (it has its own, differently-shaped special case for
 * those same list props) — checking generic-first would have silently swapped in the wrong
 * expression shape for Dual-Mode-bound list props.
 */
const contentBoundOrLiteral = (
  node: DesignerNode,
  bindingContext: TsxBindingRenderContext | undefined,
  prop: string,
  fallbackLiteral: string,
): string => {
  if (bindingContext && isContentDataBoundNode(node)) {
    const bound = resolveContentBoundAttributeForProp(node.id, prop, bindingContext, fallbackLiteral);
    if (bound) {
      return bound;
    }
  }
  if (bindingContext && resolveNodePropertyBindingExpression(node.id, prop, bindingContext)) {
    return '';
  }
  return ` ${prop}=${toJsxAttr(fallbackLiteral)}`;
};

/**
 * Bug found: form.rating/form.otp-input/form.time-input/form.datetime-input all baked `value`
 * in as a static literal only — a configured property binding on `value` was silently ignored
 * in exported code even though the canvas preview resolved it correctly. When `value` IS bound,
 * `renderAttrs`'s own bound-attribute pass already emits it unconditionally (as `defaultValue=`,
 * since `value` is one of `isDefaultValueCandidate`'s renamed props — matching the components'
 * real `defaultValue` prop, added alongside this fix); returning '' here avoids a duplicate
 * attribute. `literalAttr` must be a full ` defaultValue={...}"` string, used only when unbound.
 *
 * Bug found (parity audit item 16, recurred): `content.stepper`'s `activeStep`,
 * `form.rating`'s `label`/`max`, `form.otp-input`'s `label`/`length`, and
 * `form.time-input`/`form.datetime-input`'s `label` were all still baked in as raw literals below
 * (this function is generic — it isn't specific to `value`/`defaultValue` despite the doc comment
 * above; any prop/literal pair works), so the exact same duplicate-attribute bug already fixed for
 * `value` applied to these fields too — the generic bound-attribute pass appended the real bound
 * expression, then the static literal (written second, so it wins under JSX's last-attribute-wins
 * rule) silently overrode it. Wrapped in this same helper below.
 */
const boundOrDefaultValueLiteral = (
  node: DesignerNode,
  bindingContext: TsxBindingRenderContext | undefined,
  prop: string,
  literalAttr: string,
): string => {
  if (bindingContext && resolveNodePropertyBindingExpression(node.id, prop, bindingContext)) {
    return '';
  }
  return literalAttr;
};

export const renderUniversalPaletteJsx = (
  paletteItemId: string,
  node: DesignerNode,
  bindingContext: TsxBindingRenderContext | undefined,
  renderedChildren: string[],
): string | null => {
  const childrenBlock = renderedChildren.length > 0
    ? `\n${renderedChildren.join('\n')}\n`
    : '';

  switch (paletteItemId) {
    // Bug found: layout.separator/spacer, feedback.alert/banner/empty-state/result all baked
    // their fields in as bare static literals with no binding awareness at all (not even the
    // duplicate-attribute pattern fixed above — a bound field here was ALWAYS just the static
    // default, never the bound value). Routed through contentBoundOrLiteral/
    // boundOrDefaultValueLiteral like every other item in this file.
    case 'layout.separator':
      return renderSelfClosing('DesignerUniversalSeparator', node, bindingContext, contentBoundOrLiteral(node, bindingContext, 'orientation', readString(node.props.orientation, 'horizontal')), ['orientation']);
    case 'layout.spacer':
      return renderSelfClosing('DesignerUniversalSpacer', node, bindingContext, `${boundOrDefaultValueLiteral(node, bindingContext, 'size', ` size={${readNumber(node.props.size, 24)}}`)}${contentBoundOrLiteral(node, bindingContext, 'axis', readString(node.props.axis, 'vertical'))}`, ['size', 'axis']);
    case 'feedback.alert':
      return renderSelfClosing('DesignerUniversalAlert', node, bindingContext, `${contentBoundOrLiteral(node, bindingContext, 'title', readString(node.props.title))}${contentBoundOrLiteral(node, bindingContext, 'message', readString(node.props.message))}${contentBoundOrLiteral(node, bindingContext, 'variant', readString(node.props.variant, 'info'))}`, ['title', 'message', 'variant']);
    case 'feedback.banner':
      return renderSelfClosing('DesignerUniversalBanner', node, bindingContext, `${contentBoundOrLiteral(node, bindingContext, 'title', readString(node.props.title))}${contentBoundOrLiteral(node, bindingContext, 'message', readString(node.props.message))}${contentBoundOrLiteral(node, bindingContext, 'variant', readString(node.props.variant, 'info'))}`, ['title', 'message', 'variant']);
    case 'feedback.empty-state':
      return renderSelfClosing('DesignerUniversalEmptyState', node, bindingContext, `${contentBoundOrLiteral(node, bindingContext, 'title', readString(node.props.title))}${contentBoundOrLiteral(node, bindingContext, 'description', readString(node.props.description))}${contentBoundOrLiteral(node, bindingContext, 'actionLabel', readString(node.props.actionLabel))}`, ['title', 'description', 'actionLabel']);
    case 'feedback.result':
      return renderSelfClosing('DesignerUniversalResult', node, bindingContext, `${contentBoundOrLiteral(node, bindingContext, 'title', readString(node.props.title))}${contentBoundOrLiteral(node, bindingContext, 'description', readString(node.props.description))}${contentBoundOrLiteral(node, bindingContext, 'status', readString(node.props.status, 'success'))}`, ['title', 'description', 'status']);
    case 'content.stepper':
      return renderSelfClosing(
        'DesignerUniversalStepper',
        node,
        bindingContext,
        `${contentBoundOrLiteral(node, bindingContext, 'steps', readString(node.props.steps, 'Step 1,Step 2,Step 3'))}${boundOrDefaultValueLiteral(node, bindingContext, 'activeStep', ` activeStep={${readNumber(node.props.activeStep, 0)}}`)}`,
        ['steps', 'activeStep', 'contentDataMode'],
      );
    case 'content.carousel':
      return renderSelfClosing(
        'DesignerUniversalCarousel',
        node,
        bindingContext,
        `${contentBoundOrLiteral(node, bindingContext, 'title', readString(node.props.title))}${contentBoundOrLiteral(node, bindingContext, 'slides', readString(node.props.slides ?? node.props.data, MOCK_TESTIMONIALS_JSON))}`,
        ['title', 'slides', 'data', 'contentDataMode'],
      );
    case 'content.icon':
      return renderSelfClosing(
        'DesignerUniversalIcon',
        node,
        bindingContext,
        `${contentBoundOrLiteral(node, bindingContext, 'iconName', readString(node.props.iconName, 'Sparkles'))}${boundOrDefaultValueLiteral(node, bindingContext, 'size', ` size={${readNumber(node.props.size, 24)}}`)}`,
        ['iconName', 'size', 'contentDataMode'],
      );
    case 'form.rating':
      return renderSelfClosing(
        'DesignerUniversalRating',
        node,
        bindingContext,
        `${boundOrDefaultValueLiteral(node, bindingContext, 'label', ` label=${toJsxAttr(readString(node.props.label))}`)}${boundOrDefaultValueLiteral(node, bindingContext, 'value', ` defaultValue={${readNumber(node.props.value, 4)}}`)}${boundOrDefaultValueLiteral(node, bindingContext, 'max', ` max={${readNumber(node.props.max, 5)}}`)}`,
        ['label', 'value', 'max'],
      );
    case 'form.otp-input':
      return renderSelfClosing(
        'DesignerUniversalOtpInput',
        node,
        bindingContext,
        `${boundOrDefaultValueLiteral(node, bindingContext, 'label', ` label=${toJsxAttr(readString(node.props.label))}`)}${boundOrDefaultValueLiteral(node, bindingContext, 'length', ` length={${readNumber(node.props.length, 6)}}`)}${boundOrDefaultValueLiteral(node, bindingContext, 'value', ` defaultValue=${toJsxAttr(readString(node.props.value))}`)}`,
        ['label', 'length', 'value'],
      );
    case 'form.time-input':
      return renderSelfClosing(
        'DesignerUniversalTimeInput',
        node,
        bindingContext,
        `${boundOrDefaultValueLiteral(node, bindingContext, 'label', ` label=${toJsxAttr(readString(node.props.label))}`)}${boundOrDefaultValueLiteral(node, bindingContext, 'value', ` defaultValue=${toJsxAttr(readString(node.props.value, '09:30'))}`)}${renderTimeDateTimeConstraintAttrs(node)}`,
        ['label', 'value', 'min', 'max', 'step', 'granularity', 'hourCycle', 'isRequired', 'required', 'isDisabled', 'disabled', 'isInvalid', 'errorMessage'],
      );
    case 'form.datetime-input':
      return renderSelfClosing(
        'DesignerUniversalDateTimeInput',
        node,
        bindingContext,
        `${boundOrDefaultValueLiteral(node, bindingContext, 'label', ` label=${toJsxAttr(readString(node.props.label))}`)}${boundOrDefaultValueLiteral(node, bindingContext, 'value', ` defaultValue=${toJsxAttr(readString(node.props.value, '2026-07-07T09:30'))}`)}${renderTimeDateTimeConstraintAttrs(node, true)}`,
        ['label', 'value', 'min', 'max', 'step', 'granularity', 'hourCycle', 'timeZone', 'isRequired', 'required', 'isDisabled', 'disabled', 'isInvalid', 'errorMessage'],
      );
    case 'content.description-list':
      return renderSelfClosing(
        'DesignerUniversalDescriptionList',
        node,
        bindingContext,
        `${contentBoundOrLiteral(node, bindingContext, 'title', readString(node.props.title))}${contentBoundOrLiteral(node, bindingContext, 'data', readString(node.props.data, MOCK_DESCRIPTION_LIST_JSON))}`,
        ['title', 'data', 'contentDataMode'],
      );
    case 'content.stat-trend':
      return renderSelfClosing(
        'DesignerUniversalStatTrend',
        node,
        bindingContext,
        `${contentBoundOrLiteral(node, bindingContext, 'label', readString(node.props.label))}${contentBoundOrLiteral(node, bindingContext, 'value', readString(node.props.value))}${contentBoundOrLiteral(node, bindingContext, 'trend', readString(node.props.trend))}${contentBoundOrLiteral(node, bindingContext, 'trendDirection', readString(node.props.trendDirection, 'up'))}`,
        ['label', 'value', 'trend', 'trendDirection', 'contentDataMode'],
      );
    case 'content.segmented-control': {
      const itemsBinding = bindingContext
        ? resolveNodeOptionItemsDataExpression(node.id, bindingContext)
        : null;
      const selectedAttr = contentBoundOrLiteral(node, bindingContext, 'selected', readString(node.props.selected, 'Week'));
      if (itemsBinding && bindingContext) {
        const mappedItems = renderDesignerItemsMapperExpression(itemsBinding, node.id, bindingContext);
        return renderSelfClosing(
          'DesignerUniversalSegmentedControl',
          node,
          bindingContext,
          ` items={${mappedItems}}${selectedAttr}`,
          ['options', 'selected', 'items', 'contentDataMode'],
        );
      }
      if (bindingContext && isContentDataBoundNode(node)) {
        const optionsBound = resolveContentBoundAttributeForProp(
          node.id,
          'options',
          bindingContext,
          readString(node.props.options, 'Day,Week,Month'),
        );
        if (optionsBound) {
          return renderSelfClosing(
            'DesignerUniversalSegmentedControl',
            node,
            bindingContext,
            `${optionsBound}${selectedAttr}`,
            ['options', 'selected', 'items', 'contentDataMode'],
          );
        }
      }
      const hasExplicitItems = typeof node.props.items === 'string' && node.props.items.trim().length > 0;
      if (hasExplicitItems) {
        const staticItems = parseDesignerAutocompleteItems(node.props.items);
        return renderSelfClosing(
          'DesignerUniversalSegmentedControl',
          node,
          bindingContext,
          ` items={${JSON.stringify(staticItems)}}${selectedAttr}`,
          ['options', 'selected', 'items', 'contentDataMode'],
        );
      }
      return renderSelfClosing(
        'DesignerUniversalSegmentedControl',
        node,
        bindingContext,
        `${contentBoundOrLiteral(node, bindingContext, 'options', readString(node.props.options, 'Day,Week,Month'))}${selectedAttr}`,
        ['options', 'selected', 'items', 'contentDataMode'],
      );
    }
    case 'marketing.faq-accordion':
      return renderSelfClosing(
        'DesignerUniversalFaqAccordion',
        node,
        bindingContext,
        `${contentBoundOrLiteral(node, bindingContext, 'title', readString(node.props.title))}${contentBoundOrLiteral(node, bindingContext, 'data', readString(node.props.data, MOCK_FAQ_ITEMS_JSON))}`,
        ['title', 'data', 'contentDataMode'],
      );
    case 'marketing.testimonial-carousel':
      return renderSelfClosing(
        'DesignerUniversalTestimonialCarousel',
        node,
        bindingContext,
        `${contentBoundOrLiteral(node, bindingContext, 'title', readString(node.props.title))}${contentBoundOrLiteral(node, bindingContext, 'data', readString(node.props.data, MOCK_TESTIMONIALS_JSON))}`,
        ['title', 'data', 'contentDataMode'],
      );
    case 'marketing.pricing-table':
      return renderSelfClosing(
        'DesignerUniversalPricingTable',
        node,
        bindingContext,
        `${contentBoundOrLiteral(node, bindingContext, 'title', readString(node.props.title))}${contentBoundOrLiteral(node, bindingContext, 'data', readString(node.props.data, MOCK_PRICING_TIERS_JSON))}`,
        ['title', 'data', 'contentDataMode'],
      );
    case 'marketing.hero-cta':
      return renderSelfClosing(
        'DesignerUniversalHeroCta',
        node,
        bindingContext,
        `${contentBoundOrLiteral(node, bindingContext, 'title', readString(node.props.title))}${contentBoundOrLiteral(node, bindingContext, 'subtitle', readString(node.props.subtitle))}${contentBoundOrLiteral(node, bindingContext, 'primaryCta', readString(node.props.primaryCta))}${contentBoundOrLiteral(node, bindingContext, 'secondaryCta', readString(node.props.secondaryCta))}`,
        ['title', 'subtitle', 'primaryCta', 'secondaryCta', 'contentDataMode'],
      );
    case 'content.feature-grid':
      return renderSelfClosing(
        'DesignerUniversalFeatureGrid',
        node,
        bindingContext,
        `${contentBoundOrLiteral(node, bindingContext, 'title', readString(node.props.title))}${contentBoundOrLiteral(node, bindingContext, 'data', readString(node.props.data, MOCK_FEATURE_GRID_JSON))}`,
        ['title', 'data', 'contentDataMode'],
      );
    case 'content.blog-card':
      return renderSelfClosing(
        'DesignerUniversalBlogCardList',
        node,
        bindingContext,
        `${contentBoundOrLiteral(node, bindingContext, 'title', readString(node.props.title))}${contentBoundOrLiteral(node, bindingContext, 'data', readString(node.props.data, MOCK_BLOG_POSTS_JSON))}`,
        ['title', 'data', 'contentDataMode'],
      );
    case 'content.team-member':
      return renderSelfClosing(
        'DesignerUniversalTeamGrid',
        node,
        bindingContext,
        `${contentBoundOrLiteral(node, bindingContext, 'title', readString(node.props.title))}${contentBoundOrLiteral(node, bindingContext, 'data', readString(node.props.data, MOCK_TEAM_MEMBERS_JSON))}`,
        ['title', 'data', 'contentDataMode'],
      );
    case 'content.contact-form-block':
      return renderSelfClosing('DesignerUniversalContactFormBlock', node, bindingContext, `${contentBoundOrLiteral(node, bindingContext, 'title', readString(node.props.title))}${contentBoundOrLiteral(node, bindingContext, 'submitLabel', readString(node.props.submitLabel, 'Send message'))}`, ['title', 'submitLabel']);
    case 'marketing.newsletter-signup':
      return renderSelfClosing(
        'DesignerUniversalNewsletterSignup',
        node,
        bindingContext,
        `${contentBoundOrLiteral(node, bindingContext, 'title', readString(node.props.title))}${contentBoundOrLiteral(node, bindingContext, 'placeholder', readString(node.props.placeholder, 'you@company.com'))}${contentBoundOrLiteral(node, bindingContext, 'buttonLabel', readString(node.props.buttonLabel, 'Subscribe'))}`,
        ['title', 'placeholder', 'buttonLabel', 'contentDataMode'],
      );
    case 'content.cta-banner':
      return renderSelfClosing(
        'DesignerUniversalCtaBanner',
        node,
        bindingContext,
        `${contentBoundOrLiteral(node, bindingContext, 'title', readString(node.props.title))}${contentBoundOrLiteral(node, bindingContext, 'description', readString(node.props.description))}${contentBoundOrLiteral(node, bindingContext, 'actionLabel', readString(node.props.actionLabel))}`,
        ['title', 'description', 'actionLabel', 'contentDataMode'],
      );
    case 'layout.aspect-ratio': {
      const attrs = renderAttrs(node, bindingContext, new Set(['ratio']));
      return `<DesignerUniversalAspectRatio${attrs}${contentBoundOrLiteral(node, bindingContext, 'ratio', readString(node.props.ratio, '16/9'))}>${childrenBlock}</DesignerUniversalAspectRatio>`;
    }
    case 'layout.sticky': {
      const attrs = renderAttrs(node, bindingContext, new Set(['offset']));
      return `<DesignerUniversalStickyContainer${attrs}${boundOrDefaultValueLiteral(node, bindingContext, 'offset', ` offset={${readNumber(node.props.offset, 0)}}`)}>${childrenBlock}</DesignerUniversalStickyContainer>`;
    }
    case 'layout.overlay': {
      const attrs = renderAttrs(node, bindingContext, new Set(['overlayLabel']));
      return `<DesignerUniversalOverlayContainer${attrs}${contentBoundOrLiteral(node, bindingContext, 'overlayLabel', readString(node.props.overlayLabel, 'Overlay'))}>${childrenBlock}</DesignerUniversalOverlayContainer>`;
    }
    case 'logic.visibility-container': {
      const attrs = renderAttrs(node, bindingContext, new Set(['visibleCondition']));
      const condition = readString(node.props.visibleCondition, "store.ui.showPanel === true");
      // Component evaluates visibleCondition itself at runtime (see DesignerRuntimeUniversalWidgets.tsx);
      // it needs the same designerStore/dataContext identifiers the rest of the generated component uses.
      const storeContextAttrs = bindingContext
        ? ` designerStore={${DESIGNER_STORE_VAR}} dataContext={${bindingContext.dataContextVar}}`
        : '';
      // Bug found (parity audit item 18): when nested inside a `logic.repeater`, no `scope` was
      // ever passed to the component at all — an `item.<field>`-scoped condition always saw
      // `item` as undefined and stayed permanently hidden in the exported bundle too, mirroring
      // the exact same gap in the live/interactive preview. Mirrors the generic show/hide
      // wrapper's already-correct `repeaterScope` handling (tsxLogicRenderer.ts).
      const scopeAttr = bindingContext?.repeaterScope
        ? ` scope={${buildRepeaterScopeExpression(bindingContext.repeaterScope)}}`
        : '';
      return `<DesignerUniversalVisibilityContainer${attrs}${contentBoundOrLiteral(node, bindingContext, 'visibleCondition', condition)}${storeContextAttrs}${scopeAttr}>${childrenBlock}</DesignerUniversalVisibilityContainer>`;
    }
    case 'content.split-media': {
      const attrs = renderAttrs(node, bindingContext, new Set(['title', 'mediaSide', 'mediaSrc', 'mediaType', 'contentDataMode']));
      return `<DesignerUniversalSplitMedia${attrs}${contentBoundOrLiteral(node, bindingContext, 'title', readString(node.props.title))}${contentBoundOrLiteral(node, bindingContext, 'mediaSide', readString(node.props.mediaSide, 'right'))}${contentBoundOrLiteral(node, bindingContext, 'mediaType', readString(node.props.mediaType, 'image'))}${contentBoundOrLiteral(node, bindingContext, 'mediaSrc', readString(node.props.mediaSrc))}>${childrenBlock}</DesignerUniversalSplitMedia>`;
    }
    case 'content.video-player': {
      const attrs = renderAttrs(node, bindingContext, new Set([
        'src', 'poster', 'autoplay', 'loop', 'muted', 'controls', 'showCaptions', 'captionsSrc', 'aspectRatio', 'contentDataMode',
      ]));
      const boolAttr = (key: string, fallback = false) =>
        ` ${key}={${readBoolean(node.props[key]) || fallback}}`;
      return `<DesignerVideoPlayer${attrs}${contentBoundOrLiteral(node, bindingContext, 'src', readString(node.props.src))}${contentBoundOrLiteral(node, bindingContext, 'poster', readString(node.props.poster))}${contentBoundOrLiteral(node, bindingContext, 'aspectRatio', readString(node.props.aspectRatio, '16 / 9'))}${contentBoundOrLiteral(node, bindingContext, 'captionsSrc', readString(node.props.captionsSrc))}${boolAttr('autoplay')}${boolAttr('loop')}${boolAttr('muted')}${` controls={${node.props.controls === false ? 'false' : 'true'}}`}${boolAttr('showCaptions')} />`;
    }
    case 'content.audio-player': {
      const attrs = renderAttrs(node, bindingContext, new Set([
        'src', 'autoplay', 'loop', 'showWaveform', 'playbackSpeedControl', 'contentDataMode',
      ]));
      return `<DesignerAudioPlayer${attrs}${contentBoundOrLiteral(node, bindingContext, 'src', readString(node.props.src))}${` autoplay={${readBoolean(node.props.autoplay)}}`}${` loop={${readBoolean(node.props.loop)}}`}${` showWaveform={${readBoolean(node.props.showWaveform)}}`}${` playbackSpeedControl={${node.props.playbackSpeedControl === false ? 'false' : 'true'}}`} />`;
    }
    case 'content.qr-code': {
      const attrs = renderAttrs(node, bindingContext, new Set([
        'value', 'size', 'errorCorrectionLevel', 'logoOverlay', 'downloadable', 'contentDataMode',
      ]));
      return `<DesignerQrCode${attrs}${contentBoundOrLiteral(node, bindingContext, 'value', readString(node.props.value))}${` size={${readNumber(node.props.size, 160)}}`}${contentBoundOrLiteral(node, bindingContext, 'errorCorrectionLevel', readString(node.props.errorCorrectionLevel, 'M'))}${contentBoundOrLiteral(node, bindingContext, 'logoOverlay', readString(node.props.logoOverlay))}${` downloadable={${readBoolean(node.props.downloadable)}}`} />`;
    }
    case 'content.barcode': {
      const attrs = renderAttrs(node, bindingContext, new Set([
        'value', 'format', 'showValue', 'size', 'contentDataMode',
      ]));
      return `<DesignerBarcode${attrs}${contentBoundOrLiteral(node, bindingContext, 'value', readString(node.props.value))}${contentBoundOrLiteral(node, bindingContext, 'format', readString(node.props.format, 'CODE128'))}${` showValue={${node.props.showValue === false ? 'false' : 'true'}}`}${` size={${readNumber(node.props.size, 2)}}`} />`;
    }
    default:
      return null;
  }
};

export const resolveUniversalImportSymbol = (paletteItemId: string): string | null => {
  const map: Record<string, string> = {
    'layout.separator': 'DesignerUniversalSeparator',
    'layout.spacer': 'DesignerUniversalSpacer',
    'feedback.alert': 'DesignerUniversalAlert',
    'feedback.banner': 'DesignerUniversalBanner',
    'feedback.empty-state': 'DesignerUniversalEmptyState',
    'feedback.result': 'DesignerUniversalResult',
    'content.stepper': 'DesignerUniversalStepper',
    'content.carousel': 'DesignerUniversalCarousel',
    'content.icon': 'DesignerUniversalIcon',
    'form.rating': 'DesignerUniversalRating',
    'form.otp-input': 'DesignerUniversalOtpInput',
    'form.time-input': 'DesignerUniversalTimeInput',
    'form.datetime-input': 'DesignerUniversalDateTimeInput',
    'content.description-list': 'DesignerUniversalDescriptionList',
    'content.stat-trend': 'DesignerUniversalStatTrend',
    'layout.aspect-ratio': 'DesignerUniversalAspectRatio',
    'layout.sticky': 'DesignerUniversalStickyContainer',
    'layout.overlay': 'DesignerUniversalOverlayContainer',
    'content.segmented-control': 'DesignerUniversalSegmentedControl',
    'marketing.faq-accordion': 'DesignerUniversalFaqAccordion',
    'marketing.testimonial-carousel': 'DesignerUniversalTestimonialCarousel',
    'marketing.pricing-table': 'DesignerUniversalPricingTable',
    'logic.visibility-container': 'DesignerUniversalVisibilityContainer',
    'marketing.hero-cta': 'DesignerUniversalHeroCta',
    'content.feature-grid': 'DesignerUniversalFeatureGrid',
    'content.blog-card': 'DesignerUniversalBlogCardList',
    'content.team-member': 'DesignerUniversalTeamGrid',
    'content.contact-form-block': 'DesignerUniversalContactFormBlock',
    'content.split-media': 'DesignerUniversalSplitMedia',
    'content.video-player': 'DesignerVideoPlayer',
    'content.audio-player': 'DesignerAudioPlayer',
    'content.qr-code': 'DesignerQrCode',
    'content.barcode': 'DesignerBarcode',
    'marketing.newsletter-signup': 'DesignerUniversalNewsletterSignup',
    'content.cta-banner': 'DesignerUniversalCtaBanner',
  };
  return map[paletteItemId] ?? null;
};

const MEDIA_IMPORT_SOURCE = '@/domain/component-designer/DesignerRuntimeMedia';

export const resolveUniversalImportSource = (paletteItemId?: string): string => {
  if (
    paletteItemId === 'content.video-player'
    || paletteItemId === 'content.audio-player'
    || paletteItemId === 'content.qr-code'
    || paletteItemId === 'content.barcode'
  ) {
    return MEDIA_IMPORT_SOURCE;
  }
  return UNIVERSAL_IMPORT_SOURCE;
};

export const isUniversalPaletteStructural = (paletteItemId: string): boolean =>
  isUniversalStructuralNode(paletteItemId);
