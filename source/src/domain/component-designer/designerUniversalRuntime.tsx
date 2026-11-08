import * as React from 'react';
import type { DesignerNode } from './types';
import type { RuntimeRenderOptions } from './runtimeTypes';
import { isUniversalPaletteItemId, isUniversalStructuralPaletteItemId } from './designerUniversalPalette';
import { getNodePaletteItemId, readBoolean, readNumber, readString, wrapDesignerChildSlot } from './runtimeShared';
import { resolveInputValidationProps } from './runtimeNodeProps';
import { triggerPreviewFieldValidation } from './previewFieldValidation';
import { resolveCanvasMockEventProps } from './bindingCanvasResolver';
import { resolveCanvasPreviewEventProps } from './bindingPreviewHandlers';
import {
  DesignerUniversalAlert,
  DesignerUniversalAspectRatio,
  DesignerUniversalBanner,
  DesignerUniversalBlogCardList,
  DesignerUniversalCarousel,
  DesignerUniversalContactFormBlock,
  DesignerUniversalCtaBanner,
  DesignerUniversalDateTimeInput,
  DesignerUniversalDescriptionList,
  DesignerUniversalEmptyState,
  DesignerUniversalFaqAccordion,
  DesignerUniversalFeatureGrid,
  DesignerUniversalHeroCta,
  DesignerUniversalIcon,
  DesignerUniversalNewsletterSignup,
  DesignerUniversalOtpInput,
  DesignerUniversalOverlayContainer,
  DesignerUniversalPricingTable,
  DesignerUniversalRating,
  DesignerUniversalResult,
  DesignerRuntimeSegmentedControl,
  DesignerUniversalSeparator,
  DesignerUniversalSpacer,
  DesignerUniversalSplitMedia,
  DesignerUniversalStatTrend,
  DesignerUniversalStepper,
  DesignerUniversalStickyContainer,
  DesignerUniversalTeamGrid,
  DesignerUniversalTestimonialCarousel,
  DesignerUniversalTimeInput,
  DesignerUniversalVisibilityContainer,
  resolveUniversalPropsFromNode,
} from './DesignerRuntimeUniversalWidgets';
import {
  DesignerAudioPlayer,
  DesignerBarcode,
  DesignerQrCode,
  DesignerVideoPlayer,
} from './DesignerRuntimeMedia';
import {
  MOCK_BLOG_POSTS_JSON,
  MOCK_DESCRIPTION_LIST_JSON,
  MOCK_FAQ_ITEMS_JSON,
  MOCK_FEATURE_GRID_JSON,
  MOCK_PRICING_TIERS_JSON,
  MOCK_TEAM_MEMBERS_JSON,
  MOCK_TESTIMONIALS_JSON,
} from './universalMockFixtures';
import {
  pickContentScalarField,
  resolveContentCsvFromRows,
  resolveContentTargetListProp,
} from './bindingContentEngine';

const styleFromOptions = (options: RuntimeRenderOptions) => options.style;

const resolveBoundUniversalOverrides = (
  paletteItemId: string,
  props: ReturnType<typeof resolveUniversalPropsFromNode>,
  options: RuntimeRenderOptions,
): ReturnType<typeof resolveUniversalPropsFromNode> => {
  if (!options.contentListBound) {
    return props;
  }

  const rows = options.contentRows ?? [];
  const listProp = resolveContentTargetListProp(paletteItemId);
  if (listProp === 'data') {
    return { ...props, data: JSON.stringify(rows) };
  }
  if (listProp === 'slides') {
    return { ...props, slides: JSON.stringify(rows) };
  }
  if (listProp === 'steps') {
    return { ...props, steps: resolveContentCsvFromRows(rows) || props.steps };
  }
  if (listProp === 'options') {
    return { ...props, options: resolveContentCsvFromRows(rows) || props.options };
  }

  const first = rows[0];
  return {
    ...props,
    title: pickContentScalarField(first, 'title') ?? props.title,
    subtitle: pickContentScalarField(first, 'subtitle') ?? props.subtitle,
    description: pickContentScalarField(first, 'description') ?? props.description,
    actionLabel: pickContentScalarField(first, 'actionLabel') ?? props.actionLabel,
    primaryCta: pickContentScalarField(first, 'primaryCta') ?? props.primaryCta,
    secondaryCta: pickContentScalarField(first, 'secondaryCta') ?? props.secondaryCta,
    placeholder: pickContentScalarField(first, 'placeholder') ?? props.placeholder,
    buttonLabel: pickContentScalarField(first, 'buttonLabel') ?? props.buttonLabel,
    label: pickContentScalarField(first, 'label') ?? props.label,
    value: pickContentScalarField(first, 'value') ?? props.value,
    trend: pickContentScalarField(first, 'trend') ?? props.trend,
    trendDirection: pickContentScalarField(first, 'trendDirection') ?? props.trendDirection,
    iconName: pickContentScalarField(first, 'iconName') ?? props.iconName,
    mediaSrc: pickContentScalarField(first, 'mediaSrc') ?? props.mediaSrc,
    mediaSide: pickContentScalarField(first, 'mediaSide') ?? props.mediaSide,
    mediaType: pickContentScalarField(first, 'mediaType') ?? props.mediaType,
    src: pickContentScalarField(first, 'src') ?? props.src,
    poster: pickContentScalarField(first, 'poster') ?? props.poster,
    submitLabel: pickContentScalarField(first, 'submitLabel') ?? props.submitLabel,
  };
};

export const renderUniversalPaletteNode = (
  node: DesignerNode,
  options: RuntimeRenderOptions,
  children?: React.ReactNode,
): React.ReactNode | null => {
  const paletteItemId = getNodePaletteItemId(node);
  if (!isUniversalPaletteItemId(paletteItemId)) {
    return null;
  }

  const props = resolveBoundUniversalOverrides(
    paletteItemId,
    resolveUniversalPropsFromNode(node, options),
    options,
  );
  const style = styleFromOptions(options);

  switch (paletteItemId) {
    case 'layout.separator':
      return <DesignerUniversalSeparator orientation={props.orientation} className={props.className} style={style} />;
    case 'layout.spacer':
      return <DesignerUniversalSpacer size={props.size} axis={props.axis} className={props.className} style={style} />;
    case 'feedback.alert':
      return <DesignerUniversalAlert title={props.title} message={props.message} variant={props.variant} className={props.className} style={style} />;
    case 'feedback.banner':
      return <DesignerUniversalBanner title={props.title} message={props.message} variant={props.variant} className={props.className} style={style} />;
    case 'feedback.empty-state':
      return <DesignerUniversalEmptyState title={props.title} description={props.description} actionLabel={props.actionLabel} className={props.className} style={style} />;
    case 'feedback.result':
      return <DesignerUniversalResult title={props.title} description={props.description} status={props.status} className={props.className} style={style} />;
    case 'content.stepper':
      return <DesignerUniversalStepper steps={props.steps} activeStep={props.activeStep} className={props.className} style={style} />;
    case 'content.carousel':
      return <DesignerUniversalCarousel title={props.title} slides={props.slides ?? props.data ?? MOCK_TESTIMONIALS_JSON} className={props.className} style={style} />;
    case 'content.icon':
      return <DesignerUniversalIcon iconName={props.iconName} size={props.size} className={props.className} style={style} />;
    case 'form.rating': {
      const eventProps = options.mode === 'runtime' && options.previewEvents
        ? resolveCanvasPreviewEventProps(node, options.previewEvents)
        : resolveCanvasMockEventProps(node);
      return (
        <DesignerUniversalRating
          label={props.label}
          defaultValue={props.numericValue}
          max={props.max}
          onChange={eventProps.onChange}
          className={props.className}
          style={style}
        />
      );
    }
    case 'form.otp-input': {
      const eventProps = options.mode === 'runtime' && options.previewEvents
        ? resolveCanvasPreviewEventProps(node, options.previewEvents)
        : resolveCanvasMockEventProps(node);
      return (
        <DesignerUniversalOtpInput
          label={props.label}
          length={props.length}
          defaultValue={props.value}
          onChange={eventProps.onChange}
          className={props.className}
          style={style}
        />
      );
    }
    case 'form.time-input': {
      const eventProps = options.mode === 'runtime' && options.previewEvents
        ? resolveCanvasPreviewEventProps(node, options.previewEvents)
        : resolveCanvasMockEventProps(node);
      const validation = resolveInputValidationProps(node, options.previewFieldErrors);
      return (
        <DesignerUniversalTimeInput
          label={props.label}
          defaultValue={props.value}
          min={readString(node.props.min)}
          max={readString(node.props.max)}
          step={readNumber(node.props.step, Number.NaN) || undefined}
          granularity={readString(node.props.granularity)}
          hourCycle={readString(node.props.hourCycle)}
          isRequired={readBoolean(node.props.isRequired) || readBoolean(node.props.required)}
          isDisabled={readBoolean(node.props.isDisabled) || readBoolean(node.props.disabled)}
          isInvalid={Boolean(validation.isInvalid)}
          errorMessage={typeof validation.errorMessage === 'string' ? validation.errorMessage : undefined}
          onChange={eventProps.onChange}
          onBlur={(event) => {
            triggerPreviewFieldValidation(
              node.id,
              node.props,
              event.currentTarget.value,
              options.onPreviewFieldValidation,
              options.designerStore,
            );
          }}
          className={props.className}
          style={style}
        />
      );
    }
    case 'form.datetime-input': {
      const eventProps = options.mode === 'runtime' && options.previewEvents
        ? resolveCanvasPreviewEventProps(node, options.previewEvents)
        : resolveCanvasMockEventProps(node);
      const validation = resolveInputValidationProps(node, options.previewFieldErrors);
      return (
        <DesignerUniversalDateTimeInput
          label={props.label}
          defaultValue={props.value}
          min={readString(node.props.min)}
          max={readString(node.props.max)}
          step={readNumber(node.props.step, Number.NaN) || undefined}
          granularity={readString(node.props.granularity)}
          hourCycle={readString(node.props.hourCycle)}
          timeZone={readString(node.props.timeZone)}
          isRequired={readBoolean(node.props.isRequired) || readBoolean(node.props.required)}
          isDisabled={readBoolean(node.props.isDisabled) || readBoolean(node.props.disabled)}
          isInvalid={Boolean(validation.isInvalid)}
          errorMessage={typeof validation.errorMessage === 'string' ? validation.errorMessage : undefined}
          onChange={eventProps.onChange}
          onBlur={(event) => {
            triggerPreviewFieldValidation(
              node.id,
              node.props,
              event.currentTarget.value,
              options.onPreviewFieldValidation,
              options.designerStore,
            );
          }}
          className={props.className}
          style={style}
        />
      );
    }
    case 'content.description-list':
      return <DesignerUniversalDescriptionList title={props.title} data={props.data ?? MOCK_DESCRIPTION_LIST_JSON} className={props.className} style={style} />;
    case 'content.stat-trend':
      return <DesignerUniversalStatTrend label={props.label} value={props.value} trend={props.trend} trendDirection={props.trendDirection} className={props.className} style={style} />;
    case 'layout.aspect-ratio':
      return <DesignerUniversalAspectRatio ratio={props.ratio} className={props.className} style={style}>{wrapDesignerChildSlot(children, options.mode)}</DesignerUniversalAspectRatio>;
    case 'layout.sticky':
      return <DesignerUniversalStickyContainer offset={props.offset} className={props.className} style={style}>{wrapDesignerChildSlot(children, options.mode)}</DesignerUniversalStickyContainer>;
    case 'layout.overlay':
      return <DesignerUniversalOverlayContainer overlayLabel={props.overlayLabel} className={props.className} style={style}>{wrapDesignerChildSlot(children, options.mode)}</DesignerUniversalOverlayContainer>;
    case 'content.segmented-control':
      return (
        <DesignerRuntimeSegmentedControl
          node={node}
          options={options}
          optionsOverride={props.options}
          selectedOverride={props.selected}
        />
      );
    case 'marketing.faq-accordion':
      return <DesignerUniversalFaqAccordion title={props.title} data={props.data ?? MOCK_FAQ_ITEMS_JSON} className={props.className} style={style} />;
    case 'marketing.testimonial-carousel':
      return <DesignerUniversalTestimonialCarousel title={props.title} data={props.data ?? MOCK_TESTIMONIALS_JSON} className={props.className} style={style} />;
    case 'marketing.pricing-table':
      return <DesignerUniversalPricingTable title={props.title} data={props.data ?? MOCK_PRICING_TIERS_JSON} className={props.className} style={style} />;
    case 'logic.visibility-container':
      return (
        <DesignerUniversalVisibilityContainer
          visibleCondition={props.visibleCondition}
          designerStore={options.designerStore}
          dataContext={options.dataContext}
          scope={options.repeaterScope}
          mode={options.mode}
          className={props.className}
          style={style}
        >
          {wrapDesignerChildSlot(children, options.mode)}
        </DesignerUniversalVisibilityContainer>
      );
    case 'marketing.hero-cta':
      return <DesignerUniversalHeroCta title={props.title} subtitle={props.subtitle} primaryCta={props.primaryCta} secondaryCta={props.secondaryCta} className={props.className} style={style} />;
    case 'content.feature-grid':
      return <DesignerUniversalFeatureGrid title={props.title} data={props.data ?? MOCK_FEATURE_GRID_JSON} className={props.className} style={style} />;
    case 'content.blog-card':
      return <DesignerUniversalBlogCardList title={props.title} data={props.data ?? MOCK_BLOG_POSTS_JSON} className={props.className} style={style} />;
    case 'content.team-member':
      return <DesignerUniversalTeamGrid title={props.title} data={props.data ?? MOCK_TEAM_MEMBERS_JSON} className={props.className} style={style} />;
    case 'content.contact-form-block':
      return <DesignerUniversalContactFormBlock title={props.title} submitLabel={props.submitLabel} className={props.className} style={style} />;
    case 'content.split-media':
      return (
        <DesignerUniversalSplitMedia
          title={props.title}
          mediaSide={props.mediaSide}
          mediaSrc={props.mediaSrc}
          mediaType={props.mediaType}
          className={props.className}
          style={style}
        >
          {wrapDesignerChildSlot(children, options.mode)}
        </DesignerUniversalSplitMedia>
      );
    case 'content.video-player':
      return (
        <DesignerVideoPlayer
          src={props.src}
          poster={props.poster}
          autoplay={props.autoplay}
          loop={props.loop}
          muted={props.muted}
          controls={props.controls}
          showCaptions={props.showCaptions}
          captionsSrc={props.captionsSrc}
          aspectRatio={props.aspectRatio}
          className={props.className}
          style={style}
        />
      );
    case 'content.audio-player':
      return (
        <DesignerAudioPlayer
          src={props.src}
          autoplay={props.autoplay}
          loop={props.loop}
          showWaveform={props.showWaveform}
          playbackSpeedControl={props.playbackSpeedControl}
          className={props.className}
          style={style}
        />
      );
    case 'content.qr-code':
      return (
        <DesignerQrCode
          value={props.value}
          size={props.size}
          errorCorrectionLevel={props.errorCorrectionLevel}
          logoOverlay={props.logoOverlay}
          downloadable={props.downloadable}
          className={props.className}
          style={style}
        />
      );
    case 'content.barcode':
      return (
        <DesignerBarcode
          value={props.value}
          format={props.format}
          showValue={props.showValue}
          size={props.size}
          className={props.className}
          style={style}
        />
      );
    case 'marketing.newsletter-signup':
      return <DesignerUniversalNewsletterSignup title={props.title} placeholder={props.placeholder} buttonLabel={props.buttonLabel} className={props.className} style={style} />;
    case 'content.cta-banner':
      return <DesignerUniversalCtaBanner title={props.title} description={props.description} actionLabel={props.actionLabel} className={props.className} style={style} />;
    default:
      return null;
  }
};

export const isUniversalRenderableNode = (node: DesignerNode): boolean =>
  isUniversalPaletteItemId(getNodePaletteItemId(node));

export const isUniversalStructuralNode = (paletteItemId: string): boolean =>
  isUniversalStructuralPaletteItemId(paletteItemId);
