import type { DesignerPaletteItem } from './types';
import {
  MOCK_BLOG_POSTS_JSON,
  MOCK_DESCRIPTION_LIST_JSON,
  MOCK_FAQ_ITEMS_JSON,
  MOCK_FEATURE_GRID_JSON,
  MOCK_PRICING_TIERS_JSON,
  MOCK_TEAM_MEMBERS_JSON,
  MOCK_TESTIMONIALS_JSON,
} from './universalMockFixtures';

/** CD-P02 wave-2 HeroUI parity ids tracked in inventory (runtime via generic renderer). */
export const PHASE_P_WAVE2_HEROUI_IDS = [
  'heroui.breadcrumbs',
  'heroui.pagination',
] as const;

/** CD-P04–P35 — Phase P universal palette widget ids. */
export const UNIVERSAL_PALETTE_ITEM_IDS = [
  'layout.separator',
  'layout.spacer',
  'feedback.alert',
  'feedback.banner',
  'feedback.empty-state',
  'feedback.result',
  'content.stepper',
  'content.carousel',
  'content.icon',
  'form.rating',
  'form.otp-input',
  'form.time-input',
  'form.datetime-input',
  'content.description-list',
  'content.stat-trend',
  'layout.aspect-ratio',
  'layout.sticky',
  'layout.overlay',
  'content.segmented-control',
  'marketing.faq-accordion',
  'marketing.testimonial-carousel',
  'marketing.pricing-table',
  'logic.visibility-container',
  'marketing.hero-cta',
  'content.feature-grid',
  'content.blog-card',
  'content.team-member',
  'content.split-media',
  'content.video-player',
  'content.audio-player',
  'content.qr-code',
  'content.barcode',
  'marketing.newsletter-signup',
  'content.cta-banner',
] as const;

export type UniversalPaletteItemId = (typeof UNIVERSAL_PALETTE_ITEM_IDS)[number];

/** Removed from toolbox but still renderable for saved drafts (T1-9). */
export const LEGACY_UNIVERSAL_PALETTE_IDS = [
  'content.contact-form-block',
] as const;

export const isUniversalPaletteItemId = (
  itemId: string | null | undefined,
): itemId is UniversalPaletteItemId | (typeof LEGACY_UNIVERSAL_PALETTE_IDS)[number] =>
  typeof itemId === 'string'
  && (
    (UNIVERSAL_PALETTE_ITEM_IDS as readonly string[]).includes(itemId)
    || (LEGACY_UNIVERSAL_PALETTE_IDS as readonly string[]).includes(itemId)
  );

export const UNIVERSAL_PALETTE_STRUCTURAL_IDS = new Set<string>([
  'layout.aspect-ratio',
  'layout.sticky',
  'layout.overlay',
  'logic.visibility-container',
  'content.split-media',
]);

export const isUniversalStructuralPaletteItemId = (itemId: string): boolean =>
  UNIVERSAL_PALETTE_STRUCTURAL_IDS.has(itemId);

const parentTypes = ['root', 'container', 'list'] as const;
const leafDefaults = { allowedParentTypes: [...parentTypes], canHaveChildren: false, sourceType: 'local' as const, nodeType: 'container' as const };
const containerDefaults = { allowedParentTypes: [...parentTypes], canHaveChildren: true, sourceType: 'local' as const, nodeType: 'container' as const };

export const DESIGNER_UNIVERSAL_PALETTE_ITEMS: DesignerPaletteItem[] = [
  {
    id: 'layout.separator',
    label: 'Separator',
    category: 'layout',
    icon: 'SeparatorHorizontal',
    defaultProps: { orientation: 'horizontal', className: 'w-full border-t border-slate-200' },
    ...leafDefaults,
  },
  {
    id: 'layout.spacer',
    label: 'Spacer',
    category: 'layout',
    icon: 'MoveVertical',
    defaultProps: { size: 24, axis: 'vertical', className: '' },
    ...leafDefaults,
  },
  {
    id: 'feedback.alert',
    label: 'Alert',
    category: 'feedback-status',
    icon: 'TriangleAlert',
    defaultProps: { title: 'Heads up', message: 'Review your settings before continuing.', variant: 'warning', className: 'w-full' },
    ...leafDefaults,
  },
  {
    id: 'feedback.banner',
    label: 'Banner',
    category: 'feedback-status',
    icon: 'Megaphone',
    defaultProps: { title: 'Maintenance window', message: 'Scheduled downtime Sunday 02:00 UTC.', variant: 'info', className: 'w-full' },
    ...leafDefaults,
  },
  {
    id: 'feedback.empty-state',
    label: 'Empty State',
    category: 'feedback-status',
    icon: 'Inbox',
    defaultProps: {
      title: 'No records yet',
      description: 'Create your first item to get started.',
      actionLabel: 'Add item',
      className: 'w-full',
    },
    ...leafDefaults,
  },
  {
    id: 'feedback.result',
    label: 'Result',
    category: 'feedback-status',
    icon: 'CircleCheck',
    defaultProps: { title: 'Success', description: 'Your changes were saved.', status: 'success', className: 'w-full' },
    ...leafDefaults,
  },
  {
    id: 'content.stepper',
    label: 'Stepper',
    category: 'content-media',
    icon: 'ListOrdered',
    defaultProps: { steps: 'Account,Profile,Review', activeStep: 1, className: 'w-full' },
    ...leafDefaults,
  },
  {
    id: 'content.carousel',
    label: 'Carousel',
    category: 'content-media',
    icon: 'GalleryHorizontal',
    defaultProps: { title: 'Gallery', slides: MOCK_TESTIMONIALS_JSON, className: 'w-full' },
    ...leafDefaults,
  },
  {
    id: 'content.icon',
    label: 'Icon',
    category: 'content-media',
    icon: 'Sparkles',
    defaultProps: { iconName: 'Sparkles', size: 24, className: 'inline-flex text-primary' },
    ...leafDefaults,
  },
  {
    id: 'form.rating',
    label: 'Rating',
    category: 'heroui-forms-inputs',
    icon: 'Star',
    defaultProps: { label: 'Rating', value: 4, max: 5, className: 'w-full' },
    ...leafDefaults,
  },
  {
    id: 'form.otp-input',
    label: 'OTP Input',
    category: 'heroui-forms-inputs',
    icon: 'KeyRound',
    defaultProps: { label: 'Verification code', length: 6, className: 'w-full' },
    ...leafDefaults,
  },
  {
    id: 'form.time-input',
    label: 'Time Input',
    category: 'heroui-forms-inputs',
    icon: 'Clock',
    defaultProps: { label: 'Time', value: '09:30', className: 'w-full' },
    ...leafDefaults,
  },
  {
    id: 'form.datetime-input',
    label: 'Date & Time',
    category: 'heroui-forms-inputs',
    icon: 'CalendarClock',
    defaultProps: { label: 'Date & time', value: '2026-07-07T09:30', className: 'w-full' },
    ...leafDefaults,
  },
  {
    id: 'content.description-list',
    label: 'Description List',
    category: 'content-media',
    icon: 'List',
    defaultProps: { title: 'Details', data: MOCK_DESCRIPTION_LIST_JSON, className: 'w-full' },
    ...leafDefaults,
  },
  {
    id: 'content.stat-trend',
    label: 'Stat + Trend',
    category: 'content-media',
    icon: 'TrendingUp',
    defaultProps: { label: 'Revenue', value: '$48.2k', trend: '+12%', trendDirection: 'up', className: 'w-full' },
    ...leafDefaults,
  },
  {
    id: 'layout.aspect-ratio',
    label: 'Aspect Ratio',
    category: 'layout',
    icon: 'Ratio',
    defaultProps: { ratio: '16/9', className: 'w-full overflow-hidden rounded-lg bg-slate-100' },
    ...containerDefaults,
    // Structural wrapper — can nest children but is not a flex/grid layout container (T1-11e).
    capabilities: ['resizable'],
  },
  {
    id: 'layout.sticky',
    label: 'Sticky Container',
    category: 'layout',
    icon: 'Pin',
    defaultProps: { offset: 0, className: 'sticky top-0 z-10 w-full bg-white/90 p-3 backdrop-blur' },
    ...containerDefaults,
  },
  {
    id: 'layout.overlay',
    label: 'Overlay Container',
    category: 'layout',
    icon: 'Layers',
    defaultProps: { overlayLabel: 'Overlay', className: 'relative w-full min-h-[120px] rounded-lg bg-slate-100' },
    ...containerDefaults,
    // Overlay host — hide unrelated flex/grid Layout inspector controls (T1-11e).
    capabilities: ['overlay'],
  },
  {
    id: 'content.segmented-control',
    label: 'Segmented Control',
    category: 'content-media',
    icon: 'ToggleLeft',
    defaultProps: { options: 'Day,Week,Month', selected: 'Week', className: 'w-full' },
    ...leafDefaults,
  },
  {
    id: 'marketing.faq-accordion',
    label: 'FAQ Accordion',
    category: 'marketing',
    icon: 'HelpCircle',
    defaultProps: { title: 'Frequently asked questions', data: MOCK_FAQ_ITEMS_JSON, className: 'w-full' },
    ...leafDefaults,
  },
  {
    id: 'marketing.testimonial-carousel',
    label: 'Testimonial Carousel',
    category: 'marketing',
    icon: 'Quote',
    defaultProps: { title: 'What customers say', data: MOCK_TESTIMONIALS_JSON, className: 'w-full' },
    ...leafDefaults,
  },
  {
    id: 'marketing.pricing-table',
    label: 'Pricing Table',
    category: 'marketing',
    icon: 'CreditCard',
    defaultProps: { title: 'Plans', data: MOCK_PRICING_TIERS_JSON, className: 'w-full' },
    ...leafDefaults,
  },
  {
    id: 'logic.visibility-container',
    label: 'Visibility Container',
    category: 'logic',
    icon: 'Eye',
    defaultProps: { visibleCondition: "store.ui.showPanel === true", className: 'w-full rounded-lg border border-dashed border-slate-300 p-3' },
    ...containerDefaults,
    // Conditional wrapper — not a flex/grid layout surface (T1-11e noise fix).
    capabilities: [],
  },
  {
    id: 'marketing.hero-cta',
    label: 'Hero + CTA',
    category: 'marketing',
    icon: 'PanelTop',
    defaultProps: { title: 'Build apps visually', subtitle: 'Design, preview, and publish from one workspace.', primaryCta: 'Get started', secondaryCta: 'Learn more', className: 'w-full' },
    ...leafDefaults,
  },
  {
    id: 'content.feature-grid',
    label: 'Feature Grid',
    category: 'content-media',
    icon: 'LayoutGrid',
    defaultProps: { title: 'Features', data: MOCK_FEATURE_GRID_JSON, className: 'w-full' },
    ...leafDefaults,
  },
  {
    id: 'content.blog-card',
    label: 'Blog Card List',
    category: 'content-media',
    icon: 'Newspaper',
    defaultProps: { title: 'Latest posts', data: MOCK_BLOG_POSTS_JSON, className: 'w-full' },
    ...leafDefaults,
  },
  {
    id: 'content.team-member',
    label: 'Team Grid',
    category: 'content-media',
    icon: 'Users',
    defaultProps: { title: 'Our team', data: MOCK_TEAM_MEMBERS_JSON, className: 'w-full' },
    ...leafDefaults,
  },
  {
    id: 'content.split-media',
    label: 'Split Media',
    category: 'content-media',
    icon: 'Columns2',
    defaultProps: {
      title: 'Split section',
      mediaSide: 'right',
      mediaSrc: '',
      mediaType: 'image',
      className: 'w-full',
    },
    ...containerDefaults,
  },
  {
    id: 'content.video-player',
    label: 'Video Player',
    category: 'content-media',
    icon: 'Clapperboard',
    defaultProps: {
      src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
      poster: '',
      autoplay: false,
      loop: false,
      muted: false,
      controls: true,
      showCaptions: false,
      captionsSrc: '',
      aspectRatio: '16 / 9',
      className: 'w-full',
    },
    ...leafDefaults,
  },
  {
    id: 'content.audio-player',
    label: 'Audio Player',
    category: 'content-media',
    icon: 'AudioLines',
    defaultProps: {
      src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3',
      autoplay: false,
      loop: false,
      showWaveform: true,
      playbackSpeedControl: true,
      className: 'w-full',
    },
    ...leafDefaults,
  },
  {
    id: 'content.qr-code',
    label: 'QR Code',
    category: 'content-media',
    icon: 'QrCode',
    defaultProps: {
      value: 'https://example.com',
      size: 160,
      errorCorrectionLevel: 'M',
      logoOverlay: '',
      downloadable: false,
      className: '',
    },
    ...leafDefaults,
  },
  {
    id: 'content.barcode',
    label: 'Barcode',
    category: 'content-media',
    icon: 'Barcode',
    defaultProps: {
      value: '123456789012',
      format: 'CODE128',
      showValue: true,
      size: 2,
      className: '',
    },
    ...leafDefaults,
  },
  {
    id: 'marketing.newsletter-signup',
    label: 'Newsletter Signup',
    category: 'marketing',
    icon: 'Send',
    defaultProps: { title: 'Stay in the loop', placeholder: 'you@company.com', buttonLabel: 'Subscribe', className: 'w-full' },
    ...leafDefaults,
  },
  {
    id: 'content.cta-banner',
    label: 'CTA Banner',
    category: 'marketing',
    icon: 'MousePointerClick',
    defaultProps: { title: 'Ready to launch?', description: 'Publish your first component today.', actionLabel: 'Open designer', className: 'w-full' },
    ...leafDefaults,
  },
];
