import * as React from 'react';
import {
  BadgeDollarSign,
  Circle,
  Code2,
  Component as ComponentIcon,
  CreditCard,
  Heading2,
  Image,
  LayoutDashboard,
  LayoutGrid,
  LayoutTemplate,
  Link2,
  List,
  LogIn,
  PanelLeft,
  PanelRight,
  PanelTop,
  RectangleEllipsis,
  Rows4,
  ShieldCheck,
  Smartphone,
  SquareMousePointer,
  Type,
  Search,
  TriangleAlert,
  UserCog,
  UserPlus,
} from 'lucide-react';
import { cloneTemplateSeedsToNodes } from '../builtInTemplateClone';
import { createInitialDesignerState } from '../state';
import { DEFAULT_DESIGNER_IMAGE_SRC } from '../designerAssets';
import { APP_SHELL_LAYOUT_TEMPLATE } from './appShellLayoutTemplate';
import { SITE_SHELL_LAYOUT_TEMPLATE } from './siteShellLayoutTemplate';
import { getEnterprisePresetTemplate } from './enterprisePresetTemplates';
import { getPhase22BuiltInTemplate } from './phase22BuiltInTemplates';
import { EXTENDED_PRESET_TEMPLATES } from './presetExtendedTemplates';
import type { TemplateNodeSeed } from '../types';
import {
  MOCK_CHART_SALES_Q1_JSON,
  MOCK_KANBAN_BOARD_JSON,
  MOCK_PROJECT_TIMELINE_JSON,
} from '../visualizationMockFixtures';
import {
  expandedBlogListTemplate,
  expandedCtaBannerTemplate,
  expandedFaqAccordionTemplate,
  expandedFeatureGridTemplate,
  expandedHeroCtaTemplate,
  expandedPricingCardsTemplate,
  expandedTeamGridTemplate,
  expandedTestimonialWallTemplate,
} from './expandedPageStarterTemplates';
import { isBuiltInShellPresetId, type NewLayoutPresetId } from './types';

export type NewLayoutPresetCategory = 'all' | 'blank' | 'landing' | 'dashboard' | 'forms' | 'content' | 'app';
export type NewLayoutPresetCategoryValue = Exclude<NewLayoutPresetCategory, 'all'>;

export type NewLayoutPreset = {
  id: NewLayoutPresetId;
  title: string;
  description: string;
  icon: React.ReactNode;
  category: NewLayoutPresetCategoryValue;
  categories?: NewLayoutPresetCategoryValue[];
};

export const NEW_LAYOUT_CATEGORY_OPTIONS: Array<{ value: NewLayoutPresetCategory; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'blank', label: 'Blank' },
  { value: 'landing', label: 'Landing' },
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'forms', label: 'Forms' },
  { value: 'content', label: 'Content' },
  { value: 'app', label: 'App' },
];

export const NEW_LAYOUT_CATEGORY_LABELS: Record<NewLayoutPresetCategoryValue, string> = {
  blank: 'Blank',
  landing: 'Landing',
  dashboard: 'Dashboard',
  forms: 'Forms',
  content: 'Content',
  app: 'App',
};

export const NEW_LAYOUT_CATEGORY_TONES: Record<NewLayoutPresetCategoryValue, {
  card: string;
  icon: string;
  preview: string;
  chip: string;
}> = {
  blank: {
    card: 'hover:border-slate-300 hover:bg-slate-50/90',
    icon: 'border-slate-300 bg-slate-100 text-slate-700',
    preview: 'from-slate-100 via-slate-50 to-white',
    chip: 'border-slate-300 bg-white text-slate-700',
  },
  landing: {
    card: 'hover:border-cyan-300 hover:bg-cyan-50/80',
    icon: 'border-cyan-200 bg-cyan-100 text-cyan-700',
    preview: 'from-cyan-100 via-sky-50 to-white',
    chip: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  },
  dashboard: {
    card: 'hover:border-indigo-300 hover:bg-indigo-50/70',
    icon: 'border-indigo-200 bg-indigo-100 text-indigo-700',
    preview: 'from-indigo-100 via-blue-50 to-white',
    chip: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  },
  forms: {
    card: 'hover:border-emerald-300 hover:bg-emerald-50/70',
    icon: 'border-emerald-200 bg-emerald-100 text-emerald-700',
    preview: 'from-emerald-100 via-teal-50 to-white',
    chip: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  content: {
    card: 'hover:border-amber-300 hover:bg-amber-50/70',
    icon: 'border-amber-200 bg-amber-100 text-amber-700',
    preview: 'from-amber-100 via-orange-50 to-white',
    chip: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  app: {
    card: 'hover:border-fuchsia-300 hover:bg-fuchsia-50/70',
    icon: 'border-fuchsia-200 bg-fuchsia-100 text-fuchsia-700',
    preview: 'from-fuchsia-100 via-violet-50 to-white',
    chip: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700',
  },
};

export const getPresetCategories = (preset: NewLayoutPreset): NewLayoutPresetCategoryValue[] => preset.categories ?? [preset.category];

/** CD-N01 — first-run wizard: one click picks a starter preset (≤2 clicks including New layout). */
export type FirstRunWizardTemplateId = 'blank' | 'form' | 'dashboard';

export type FirstRunWizardTemplate = {
  id: FirstRunWizardTemplateId;
  title: string;
  description: string;
  presetId: NewLayoutPresetId;
  icon: React.ReactNode;
  tone: NewLayoutPresetCategoryValue;
};

export const FIRST_RUN_WIZARD_TEMPLATES: readonly FirstRunWizardTemplate[] = [
  {
    id: 'blank',
    title: 'Blank Page',
    description: 'Empty canvas — add components from the toolbox.',
    presetId: 'blank',
    icon: <Circle className="h-5 w-5" />,
    tone: 'blank',
  },
  {
    id: 'form',
    title: 'Form',
    description: 'Contact-style form with inputs and submit area.',
    presetId: 'contact-form',
    icon: <RectangleEllipsis className="h-5 w-5" />,
    tone: 'forms',
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    description: 'KPI cards and summary layout for admin views.',
    presetId: 'dashboard-kpi',
    icon: <LayoutDashboard className="h-5 w-5" />,
    tone: 'dashboard',
  },
];

export const NEW_LAYOUT_PRESETS: NewLayoutPreset[] = [
  {
    id: 'blank',
    title: 'Empty Canvas',
    description: 'Start with a completely empty component.',
    icon: <Circle className="h-4 w-4" />,
    category: 'blank',
  },
  {
    id: 'hero-cta',
    title: 'Hero + Call To Action',
    description: 'Header section with title, description, and action buttons.',
    icon: <PanelTop className="h-4 w-4" />,
    category: 'landing',
    categories: ['landing', 'content'],
  },
  {
    id: 'feature-grid',
    title: 'Feature Grid',
    description: 'Top heading with a responsive 3-card feature grid.',
    icon: <LayoutTemplate className="h-4 w-4" />,
    category: 'landing',
  },
  {
    id: 'split-media',
    title: 'Split Media',
    description: 'Two-column layout with content and image area.',
    icon: <Rows4 className="h-4 w-4" />,
    category: 'landing',
  },
  {
    id: 'dashboard-kpi',
    title: 'Dashboard KPIs',
    description: 'Alias of KPI Metrics Grid — four real stat-trend cards with export action.',
    icon: <ShieldCheck className="h-4 w-4" />,
    category: 'dashboard',
    categories: ['dashboard', 'app'],
  },
  {
    id: 'dashboard-viz-kit',
    title: 'Dashboard Kit',
    description: 'Charts, sparkline, and kanban with sample data (CD-O37).',
    icon: <LayoutDashboard className="h-4 w-4" />,
    category: 'dashboard',
    categories: ['dashboard', 'app'],
  },
  {
    id: 'pricing-cards',
    title: 'Pricing Cards',
    description: 'Three-tier pricing plans with CTA actions.',
    icon: <RectangleEllipsis className="h-4 w-4" />,
    category: 'landing',
  },
  {
    id: 'faq-accordion',
    title: 'FAQ Section',
    description: 'Question and answer stack for help pages.',
    icon: <List className="h-4 w-4" />,
    category: 'content',
  },
  {
    id: 'contact-form',
    title: 'Contact Form',
    description: 'Compact form with fields and submit action.',
    icon: <Code2 className="h-4 w-4" />,
    category: 'forms',
    categories: ['forms', 'content'],
  },
  {
    id: 'timeline',
    title: 'Timeline',
    description: 'Vertical activity timeline with milestones.',
    icon: <Rows4 className="h-4 w-4" />,
    category: 'content',
  },
  {
    id: 'blog-list',
    title: 'Blog List',
    description: 'List of post cards with title and summary.',
    icon: <LayoutTemplate className="h-4 w-4" />,
    category: 'content',
  },
  {
    id: 'testimonial-wall',
    title: 'Testimonial Wall',
    description: 'Customer quotes in compact card layout.',
    icon: <RectangleEllipsis className="h-4 w-4" />,
    category: 'landing',
  },
  {
    id: 'stats-strip',
    title: 'Stats Strip',
    description: 'Horizontal strip of key metrics.',
    icon: <ShieldCheck className="h-4 w-4" />,
    category: 'dashboard',
  },
  {
    id: 'team-grid',
    title: 'Team Grid',
    description: 'Team member cards with role and bio.',
    icon: <ComponentIcon className="h-4 w-4" />,
    category: 'content',
  },
  {
    id: 'sidebar-layout',
    title: 'Sidebar Layout',
    description: 'Left navigation with content section.',
    icon: <PanelLeft className="h-4 w-4" />,
    category: 'app',
  },
  {
    id: 'app-shell',
    title: 'App Shell',
    description: 'Header, sidebar, and content shell.',
    icon: <PanelRight className="h-4 w-4" />,
    category: 'app',
  },
  {
    id: 'site-shell',
    title: 'Site Shell',
    description: 'Public one-page site with top menu, logo, and smooth-scroll sections.',
    icon: <PanelTop className="h-4 w-4" />,
    category: 'app',
  },
  {
    id: 'gallery-grid',
    title: 'Gallery Grid',
    description: 'Image gallery style responsive grid.',
    icon: <Image className="h-4 w-4" />,
    category: 'content',
  },
  {
    id: 'changelog',
    title: 'Changelog',
    description: 'Version updates in timeline format.',
    icon: <List className="h-4 w-4" />,
    category: 'content',
  },
  {
    id: 'cta-banner',
    title: 'CTA Banner',
    description: 'Compact call-to-action banner section.',
    icon: <Code2 className="h-4 w-4" />,
    category: 'landing',
  },
  {
    id: 'bento-hero',
    title: 'Bento Hero',
    description: 'Hero with mixed-size highlight blocks.',
    icon: <LayoutTemplate className="h-4 w-4" />,
    category: 'landing',
  },
  {
    id: 'comparison-table',
    title: 'Comparison Table',
    description: 'Feature comparison matrix for plans or products.',
    icon: <RectangleEllipsis className="h-4 w-4" />,
    category: 'content',
  },
  {
    id: 'roadmap-board',
    title: 'Roadmap Board',
    description: 'Quarterly roadmap columns for planning.',
    icon: <Rows4 className="h-4 w-4" />,
    category: 'dashboard',
    categories: ['dashboard', 'app'],
  },
  {
    id: 'newsletter-signup',
    title: 'Newsletter Signup',
    description: 'Email capture block with compact CTA.',
    icon: <Code2 className="h-4 w-4" />,
    category: 'forms',
    categories: ['forms', 'landing'],
  },
  {
    id: 'support-center',
    title: 'Support Center',
    description: 'Help topics with search and quick links.',
    icon: <PanelRight className="h-4 w-4" />,
    category: 'content',
  },
  {
    id: 'event-agenda',
    title: 'Event Agenda',
    description: 'Session schedule for conferences or workshops.',
    icon: <List className="h-4 w-4" />,
    category: 'content',
  },
  {
    id: 'empty-state',
    title: 'Empty State',
    description: 'No-data layout with helper action.',
    icon: <Circle className="h-4 w-4" />,
    category: 'app',
  },
  {
    id: 'product-showcase',
    title: 'Product Showcase',
    description: 'Image-led product highlight with details.',
    icon: <Image className="h-4 w-4" />,
    category: 'landing',
  },
  {
    id: 'analytics-detail',
    title: 'Analytics Detail',
    description: 'Metric focus panel with supporting insights.',
    icon: <ShieldCheck className="h-4 w-4" />,
    category: 'dashboard',
    categories: ['dashboard', 'content'],
  },
  {
    id: 'command-center',
    title: 'Command Center',
    description: 'Ops-style shell with status and action areas.',
    icon: <PanelTop className="h-4 w-4" />,
    category: 'app',
  },
  {
    id: 'feature-tabs',
    title: 'Feature Tabs',
    description: 'Tabbed feature navigation and content.',
    icon: <LayoutTemplate className="h-4 w-4" />,
    category: 'content',
    categories: ['content', 'landing'],
  },
  {
    id: 'case-study',
    title: 'Case Study',
    description: 'Narrative success story with key outcomes.',
    icon: <RectangleEllipsis className="h-4 w-4" />,
    category: 'landing',
  },
  {
    id: 'onboarding-steps',
    title: 'Onboarding Steps',
    description: 'Step-by-step getting started flow with progress.',
    icon: <List className="h-4 w-4" />,
    category: 'app',
  },
  {
    id: 'kanban-board',
    title: 'Kanban Board',
    description: 'Task columns for backlog, progress, and done.',
    icon: <Rows4 className="h-4 w-4" />,
    category: 'app',
  },
  {
    id: 'release-notes-grid',
    title: 'Release Notes Grid',
    description: 'Version updates grouped into compact cards.',
    icon: <RectangleEllipsis className="h-4 w-4" />,
    category: 'content',
  },
  {
    id: 'social-proof-strip',
    title: 'Social Proof Strip',
    description: 'Trusted-by logos and highlight quote row.',
    icon: <ShieldCheck className="h-4 w-4" />,
    category: 'landing',
  },
  {
    id: 'integrations-grid',
    title: 'Integrations Grid',
    description: 'Connected tools matrix with small badges.',
    icon: <ComponentIcon className="h-4 w-4" />,
    category: 'app',
  },
  {
    id: 'settings-form',
    title: 'Settings Form',
    description: 'Account or workspace settings with grouped fields.',
    icon: <Code2 className="h-4 w-4" />,
    category: 'forms',
    categories: ['forms', 'app'],
  },
  {
    id: 'profile-overview',
    title: 'Profile Overview',
    description: 'Profile summary with stats and action area.',
    icon: <PanelRight className="h-4 w-4" />,
    category: 'app',
  },
  {
    id: 'mobile-app-promo',
    title: 'Mobile App Promo',
    description: 'Phone mockup hero with store call-to-actions.',
    icon: <Smartphone className="h-4 w-4" />,
    category: 'landing',
  },
  {
    id: 'docs-detail',
    title: 'Docs Detail',
    description: 'Documentation page with table of contents rail.',
    icon: <PanelLeft className="h-4 w-4" />,
    category: 'content',
  },
  {
    id: 'metrics-sidebar',
    title: 'Metrics Sidebar',
    description: 'Report view with KPI rail beside main chart.',
    icon: <PanelLeft className="h-4 w-4" />,
    category: 'dashboard',
    categories: ['dashboard', 'content'],
  },
  {
    id: 'auth-login',
    title: 'Auth Login Form',
    description: 'Sign-in card with email, password, remember me, and submit binding.',
    icon: <LogIn className="h-4 w-4" />,
    category: 'forms',
    categories: ['forms', 'app'],
  },
  {
    id: 'auth-signup',
    title: 'Auth Sign Up Form',
    description: 'Registration form with profile fields and binding-ready submit.',
    icon: <UserPlus className="h-4 w-4" />,
    category: 'forms',
    categories: ['forms', 'app'],
  },
  {
    id: 'kpi-metrics-grid',
    title: 'KPI Metrics Grid',
    description: 'Four-card performance overview with export action.',
    icon: <LayoutGrid className="h-4 w-4" />,
    category: 'dashboard',
  },
  {
    id: 'pricing-tier-featured',
    title: 'Featured Pricing Tier',
    description: 'Single highlighted plan card with feature list and upgrade CTA.',
    icon: <BadgeDollarSign className="h-4 w-4" />,
    category: 'landing',
    categories: ['landing', 'content'],
  },
  {
    id: 'master-detail-header',
    title: 'Master Detail Page',
    description: 'Header, detail form, and related records grid — binding-ready.',
    icon: <LayoutDashboard className="h-4 w-4" />,
    category: 'app',
    categories: ['app', 'dashboard'],
  },
  {
    id: 'user-account-settings',
    title: 'User Account Settings',
    description: 'Tabbed profile and password sections with binding-ready save form.',
    icon: <UserCog className="h-4 w-4" />,
    category: 'forms',
    categories: ['forms', 'app'],
  },
  {
    id: 'billing-subscription',
    title: 'Billing & Subscription',
    description: 'Current plan summary, payment method, and upgrade actions.',
    icon: <CreditCard className="h-4 w-4" />,
    category: 'app',
    categories: ['app', 'dashboard'],
  },
  {
    id: 'crud-collection-page',
    title: 'CRUD Collection Page',
    description: 'Binding-ready list grid with create modal form scaffold.',
    icon: <LayoutGrid className="h-4 w-4" />,
    category: 'app',
    categories: ['app', 'forms', 'dashboard'],
  },
  {
    id: 'not-found-error-pages',
    title: '404 & Error Pages',
    description: 'shell.not-found and shell.error-page layouts ready for portal wiring.',
    icon: <TriangleAlert className="h-4 w-4" />,
    category: 'app',
    categories: ['app', 'content'],
  },
  {
    id: 'advanced-search-results',
    title: 'Advanced Search Results',
    description: 'Entity picker, filters, and data-grid results — binding-ready.',
    icon: <Search className="h-4 w-4" />,
    category: 'app',
    categories: ['app', 'dashboard', 'forms'],
  },
];

export const NEW_LAYOUT_STATUS_MESSAGE: Record<NewLayoutPresetId, string> = {
  blank: 'Started a new empty version.',
  'hero-cta': 'Started a new Hero + Call To Action layout.',
  'feature-grid': 'Started a new Feature Grid layout.',
  'split-media': 'Started a new Split Media layout.',
  'dashboard-kpi': 'Started a new Dashboard KPIs layout.',
  'dashboard-viz-kit': 'Started a new Dashboard Kit with charts and kanban.',
  'pricing-cards': 'Started a new Pricing Cards layout.',
  'faq-accordion': 'Started a new FAQ Section layout.',
  'contact-form': 'Started a new Contact Form layout.',
  timeline: 'Started a new Timeline layout.',
  'blog-list': 'Started a new Blog List layout.',
  'testimonial-wall': 'Started a new Testimonial Wall layout.',
  'stats-strip': 'Started a new Stats Strip layout.',
  'team-grid': 'Started a new Team Grid layout.',
  'sidebar-layout': 'Started a new Sidebar Layout layout.',
  'app-shell': 'Started a new App Shell layout.',
  'gallery-grid': 'Started a new Gallery Grid layout.',
  changelog: 'Started a new Changelog layout.',
  'cta-banner': 'Started a new CTA Banner layout.',
  'bento-hero': 'Started a new Bento Hero layout.',
  'comparison-table': 'Started a new Comparison Table layout.',
  'roadmap-board': 'Started a new Roadmap Board layout.',
  'newsletter-signup': 'Started a new Newsletter Signup layout.',
  'support-center': 'Started a new Support Center layout.',
  'event-agenda': 'Started a new Event Agenda layout.',
  'empty-state': 'Started a new Empty State layout.',
  'product-showcase': 'Started a new Product Showcase layout.',
  'analytics-detail': 'Started a new Analytics Detail layout.',
  'command-center': 'Started a new Command Center layout.',
  'feature-tabs': 'Started a new Feature Tabs layout.',
  'case-study': 'Started a new Case Study layout.',
  'onboarding-steps': 'Started a new Onboarding Steps layout.',
  'kanban-board': 'Started a new Kanban Board layout.',
  'release-notes-grid': 'Started a new Release Notes Grid layout.',
  'social-proof-strip': 'Started a new Social Proof Strip layout.',
  'integrations-grid': 'Started a new Integrations Grid layout.',
  'settings-form': 'Started a new Settings Form layout.',
  'profile-overview': 'Started a new Profile Overview layout.',
  'mobile-app-promo': 'Started a new Mobile App Promo layout.',
  'docs-detail': 'Started a new Docs Detail layout.',
  'metrics-sidebar': 'Started a new Metrics Sidebar layout.',
  'auth-login': 'Started a new Auth Login Form layout.',
  'auth-signup': 'Started a new Auth Sign Up Form layout.',
  'kpi-metrics-grid': 'Started a new KPI Metrics Grid layout.',
  'pricing-tier-featured': 'Started a new Featured Pricing Tier layout.',
  'master-detail-header': 'Started a new Master Detail page layout.',
  'user-account-settings': 'Started a new User Account Settings layout.',
  'billing-subscription': 'Started a new Billing & Subscription layout.',
  'crud-collection-page': 'Started a new CRUD Collection Page layout.',
  'not-found-error-pages': 'Started a new 404 & Error Pages layout.',
  'advanced-search-results': 'Started a new Advanced Search Results layout.',
};

export { renderPresetMiniPreview } from './presetMiniPreviews';

const SAMPLE_FORM_CLASS = 'mx-auto flex w-full max-w-lg flex-col gap-3 rounded-lg border border-default-200 bg-content1 p-4';
const SAMPLE_FORM_FIELDS_CLASS = 'flex flex-col gap-3';
const SAMPLE_FORM_TWO_COLUMN_CLASS = 'grid grid-cols-1 gap-3 sm:grid-cols-2';
const SAMPLE_FORM_SUBMIT_CLASS = 'inline-flex w-full justify-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground no-underline hover:opacity-90';

const bindingReadyFormSubmit = {
  'event:onSubmit': {
    sourceType: 'apiRef' as const,
  },
};

type SampleFormLabeledFieldConfig = {
  label: string;
  name: string;
  placeholder: string;
  paletteItemId?: 'heroui.input-text' | 'heroui.textarea';
  inputType?: string;
  isRequired?: boolean;
  minRows?: number;
};

/** Label-over-input field row — matches AGENTS.md form spacing and auto-form field props. */
const buildSampleFormLabeledField = (config: SampleFormLabeledFieldConfig): TemplateNodeSeed => ({
  type: 'container',
  paletteItemId: 'layout.flex-column',
  props: { className: 'flex flex-col gap-[2px]' },
  children: [
    {
      type: 'text',
      paletteItemId: 'html.text',
      props: {
        text: config.label,
        className: 'ps-[4px] text-sm font-medium text-slate-700',
      },
    },
    {
      type: 'container',
      paletteItemId: config.paletteItemId ?? 'heroui.input-text',
      props: {
        name: config.name,
        label: config.label,
        placeholder: config.placeholder,
        size: 'sm',
        className: 'w-full',
        ...(config.inputType ? { inputType: config.inputType } : {}),
        ...(config.isRequired ? { isRequired: true } : {}),
        ...(config.minRows ? { minRows: config.minRows } : {}),
      },
    },
  ],
});

const getExtendedPresetTemplate = (presetId: NewLayoutPresetId): TemplateNodeSeed[] => (
  EXTENDED_PRESET_TEMPLATES[presetId] ?? []
);

export const getTemplateForPreset = (presetId: NewLayoutPresetId): TemplateNodeSeed[] => {
  switch (presetId) {
    case 'hero-cta':
      return expandedHeroCtaTemplate();
    case 'feature-grid':
      return expandedFeatureGridTemplate();
    case 'split-media':
      return [
        {
          type: 'container',
          props: { className: 'mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-4 md:grid-cols-2' },
          children: [
            {
              type: 'container',
              props: { className: 'space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm' },
              children: [
                { type: 'heading', props: { text: 'Tell A Better Story', className: 'text-2xl font-semibold tracking-tight text-slate-900' } },
                { type: 'text', props: { text: 'Use this split layout for landing sections, profile intros, or product highlights.', className: 'text-sm text-slate-600' } },
                { type: 'link', props: { text: 'Primary Action', href: '#', target: '_self', rel: '', className: 'inline-flex rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white no-underline hover:bg-cyan-700' } },
              ],
            },
            {
              type: 'container',
              props: { className: 'overflow-hidden rounded-xl border border-slate-200 bg-slate-100 p-2 shadow-sm' },
              children: [
                { type: 'image', props: { src: DEFAULT_DESIGNER_IMAGE_SRC, alt: 'Preview image', className: 'h-56 w-full rounded-lg object-cover' } },
              ],
            },
          ],
        },
      ] as TemplateNodeSeed[];
    case 'dashboard-kpi':
      // Phase 22: alias to kpi-metrics-grid (real content.stat-trend cards) — avoids duplicate mock.
      return getEnterprisePresetTemplate('kpi-metrics-grid');
    case 'dashboard-viz-kit':
      return [
        {
          type: 'container',
          props: { className: 'mx-auto flex w-full max-w-6xl flex-col gap-4' },
          children: [
            { type: 'heading', props: { text: 'Executive Dashboard', className: 'text-2xl font-semibold tracking-tight text-slate-900' } },
            {
              type: 'container',
              props: { className: 'grid grid-cols-1 gap-4 lg:grid-cols-3' },
              children: [
                {
                  type: 'container',
                  paletteItemId: 'viz.chart-line',
                  props: {
                    title: 'Revenue Trend',
                    data: MOCK_CHART_SALES_Q1_JSON,
                    seriesKeys: 'revenue',
                    chartVariant: 'area',
                    className: 'lg:col-span-2 w-full rounded-lg border border-slate-200 bg-white p-3',
                  },
                },
                {
                  type: 'container',
                  paletteItemId: 'viz.chart-sparkline',
                  props: {
                    data: MOCK_CHART_SALES_Q1_JSON,
                    seriesKeys: 'revenue',
                    height: 48,
                    className: 'w-full rounded-lg border border-slate-200 bg-white p-3',
                  },
                },
              ],
            },
            {
              type: 'container',
              paletteItemId: 'viz.chart-bar',
              props: {
                title: 'Revenue vs Cost',
                data: MOCK_CHART_SALES_Q1_JSON,
                seriesKeys: 'revenue,cost',
                grouped: true,
                className: 'w-full rounded-lg border border-slate-200 bg-white p-3',
              },
            },
            {
              type: 'container',
              paletteItemId: 'viz.kanban',
              props: {
                title: 'Sprint Board',
                data: MOCK_KANBAN_BOARD_JSON,
                className: 'w-full',
              },
            },
            {
              type: 'container',
              paletteItemId: 'viz.timeline',
              props: {
                title: 'Milestones',
                data: MOCK_PROJECT_TIMELINE_JSON,
                className: 'w-full rounded-lg border border-slate-200 bg-white p-4',
              },
            },
          ],
        },
      ] as TemplateNodeSeed[];
    case 'pricing-cards':
      return expandedPricingCardsTemplate();
    case 'faq-accordion':
      return expandedFaqAccordionTemplate();
    case 'contact-form':
      return [
        {
          type: 'container',
          paletteItemId: 'html.form',
          props: { className: SAMPLE_FORM_CLASS, method: 'post', action: '' },
          binding: bindingReadyFormSubmit,
          children: [
            {
              type: 'heading',
              paletteItemId: 'html.heading',
              props: { text: 'Contact us', className: 'text-lg font-semibold tracking-tight text-foreground' },
            },
            {
              type: 'text',
              paletteItemId: 'html.text',
              props: {
                text: 'Example form with labeled fields — connect submit binding to your API.',
                className: 'text-sm text-default-500',
              },
            },
            {
              type: 'container',
              paletteItemId: 'layout.flex-column',
              props: { className: SAMPLE_FORM_FIELDS_CLASS },
              children: [
                {
                  type: 'container',
                  paletteItemId: 'html.container',
                  props: { className: SAMPLE_FORM_TWO_COLUMN_CLASS },
                  children: [
                    buildSampleFormLabeledField({
                      label: 'First name',
                      name: 'firstName',
                      placeholder: 'Jane',
                      isRequired: true,
                    }),
                    buildSampleFormLabeledField({
                      label: 'Last name',
                      name: 'lastName',
                      placeholder: 'Doe',
                      isRequired: true,
                    }),
                  ],
                },
                buildSampleFormLabeledField({
                  label: 'Email',
                  name: 'email',
                  placeholder: 'you@company.com',
                  inputType: 'email',
                  isRequired: true,
                }),
                buildSampleFormLabeledField({
                  label: 'Message',
                  name: 'message',
                  placeholder: 'How can we help?',
                  paletteItemId: 'heroui.textarea',
                  minRows: 4,
                  isRequired: true,
                }),
              ],
            },
            {
              type: 'link',
              paletteItemId: 'heroui.button-solid',
              props: {
                text: 'Send message',
                href: '#',
                target: '_self',
                rel: '',
                type: 'submit',
                className: SAMPLE_FORM_SUBMIT_CLASS,
              },
            },
          ],
        },
      ] as TemplateNodeSeed[];
    case 'timeline':
      return [
        {
          type: 'container',
          props: { className: 'mx-auto w-full max-w-4xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm' },
          children: [
            { type: 'heading', props: { text: 'Project Timeline', className: 'text-2xl font-semibold tracking-tight text-slate-900' } },
            {
              type: 'container',
              paletteItemId: 'content.stepper',
              props: {
                steps: 'Planning,Build,Release',
                activeStep: 1,
                className: 'mt-4 w-full',
              },
            },
            {
              type: 'container',
              props: { className: 'mt-4 space-y-3' },
              children: [
                { type: 'container', props: { className: 'rounded-lg border border-slate-200 bg-white p-3' }, children: [{ type: 'heading', props: { text: 'Planning', className: 'text-sm font-semibold text-slate-800' } }, { type: 'text', props: { text: 'Requirements collected and scoped.', className: 'text-sm text-slate-600' } }] },
                { type: 'container', props: { className: 'rounded-lg border border-cyan-200 bg-cyan-50/60 p-3' }, children: [{ type: 'heading', props: { text: 'Build', className: 'text-sm font-semibold text-slate-800' } }, { type: 'text', props: { text: 'Core modules and flows implemented.', className: 'text-sm text-slate-600' } }] },
                { type: 'container', props: { className: 'rounded-lg border border-slate-200 bg-white p-3' }, children: [{ type: 'heading', props: { text: 'Release', className: 'text-sm font-semibold text-slate-800' } }, { type: 'text', props: { text: 'Launch and monitor performance metrics.', className: 'text-sm text-slate-600' } }] },
              ],
            },
          ],
        },
      ] as TemplateNodeSeed[];
    case 'blog-list':
      return expandedBlogListTemplate();
    case 'testimonial-wall':
      return expandedTestimonialWallTemplate();
    case 'stats-strip':
      return [
        {
          type: 'container',
          props: { className: 'mx-auto grid w-full max-w-6xl grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6' },
          children: [
            { type: 'container', paletteItemId: 'content.stat-trend', props: { label: 'Users', value: '12.4K', trend: '+8%', trendDirection: 'up', className: 'w-full' } },
            { type: 'container', paletteItemId: 'content.stat-trend', props: { label: 'Sessions', value: '41K', trend: '+15%', trendDirection: 'up', className: 'w-full' } },
            { type: 'container', paletteItemId: 'content.stat-trend', props: { label: 'Sales', value: '2.8K', trend: '+5%', trendDirection: 'up', className: 'w-full' } },
            { type: 'container', paletteItemId: 'content.stat-trend', props: { label: 'MRR', value: '$83K', trend: '+12%', trendDirection: 'up', className: 'w-full' } },
            { type: 'container', paletteItemId: 'content.stat-trend', props: { label: 'NPS', value: '58', trend: '-2 pts', trendDirection: 'down', className: 'w-full' } },
            { type: 'container', paletteItemId: 'content.stat-trend', props: { label: 'Uptime', value: '99.95%', trend: 'Stable', trendDirection: 'up', className: 'w-full' } },
          ],
        },
      ] as TemplateNodeSeed[];
    case 'team-grid':
      return expandedTeamGridTemplate();
    case 'sidebar-layout':
      return [
        {
          type: 'container',
          props: { className: 'mx-auto grid w-full max-w-6xl grid-cols-1 gap-3 md:grid-cols-[240px,1fr]' },
          children: [
            { type: 'container', props: { className: 'rounded-xl border border-slate-200 bg-white p-3 shadow-sm' }, children: [{ type: 'heading', props: { text: 'Navigation', className: 'text-sm font-semibold text-slate-800' } }, { type: 'list', props: { className: 'mt-2 list-disc space-y-1 ps-4 text-xs text-slate-600' }, children: [{ type: 'list-item', props: { text: 'Overview' } }, { type: 'list-item', props: { text: 'Reports' } }, { type: 'list-item', props: { text: 'Settings' } }] }] },
            { type: 'container', props: { className: 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm' }, children: [{ type: 'heading', props: { text: 'Main Content', className: 'text-lg font-semibold text-slate-800' } }, { type: 'text', props: { text: 'Use this area for dashboard widgets or page content.', className: 'mt-1 text-sm text-slate-600' } }] },
          ],
        },
      ] as TemplateNodeSeed[];
    case 'app-shell':
      return APP_SHELL_LAYOUT_TEMPLATE;
    case 'site-shell':
      return SITE_SHELL_LAYOUT_TEMPLATE;
    case 'gallery-grid':
      return [
        {
          type: 'container',
          props: { className: 'mx-auto grid w-full max-w-6xl grid-cols-2 gap-2 md:grid-cols-4' },
          children: [
            { type: 'image', props: { src: DEFAULT_DESIGNER_IMAGE_SRC, alt: 'Gallery image', className: 'h-24 w-full rounded-lg object-cover border border-slate-200' } },
            { type: 'image', props: { src: DEFAULT_DESIGNER_IMAGE_SRC, alt: 'Gallery image', className: 'h-24 w-full rounded-lg object-cover border border-slate-200' } },
            { type: 'image', props: { src: DEFAULT_DESIGNER_IMAGE_SRC, alt: 'Gallery image', className: 'h-24 w-full rounded-lg object-cover border border-slate-200' } },
            { type: 'image', props: { src: DEFAULT_DESIGNER_IMAGE_SRC, alt: 'Gallery image', className: 'h-24 w-full rounded-lg object-cover border border-slate-200' } },
            { type: 'image', props: { src: DEFAULT_DESIGNER_IMAGE_SRC, alt: 'Gallery image', className: 'h-24 w-full rounded-lg object-cover border border-slate-200' } },
            { type: 'image', props: { src: DEFAULT_DESIGNER_IMAGE_SRC, alt: 'Gallery image', className: 'h-24 w-full rounded-lg object-cover border border-slate-200' } },
            { type: 'image', props: { src: DEFAULT_DESIGNER_IMAGE_SRC, alt: 'Gallery image', className: 'h-24 w-full rounded-lg object-cover border border-slate-200' } },
            { type: 'image', props: { src: DEFAULT_DESIGNER_IMAGE_SRC, alt: 'Gallery image', className: 'h-24 w-full rounded-lg object-cover border border-slate-200' } },
          ],
        },
      ] as TemplateNodeSeed[];
    case 'changelog':
      return [
        {
          type: 'container',
          props: { className: 'mx-auto flex w-full max-w-4xl flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm' },
          children: [
            { type: 'heading', props: { text: 'Changelog', className: 'text-xl font-semibold text-slate-900' } },
            { type: 'text', props: { text: 'v2.4.0 - Added runtime diagnostics panel.', className: 'text-sm text-slate-700' } },
            { type: 'text', props: { text: 'v2.3.0 - Improved template manager.', className: 'text-sm text-slate-700' } },
            { type: 'text', props: { text: 'v2.2.1 - Fixed drag and drop edge cases.', className: 'text-sm text-slate-700' } },
          ],
        },
      ] as TemplateNodeSeed[];
    case 'cta-banner':
      return expandedCtaBannerTemplate();
    case 'bento-hero':
    case 'comparison-table':
    case 'roadmap-board':
    case 'newsletter-signup':
    case 'support-center':
    case 'event-agenda':
    case 'empty-state':
    case 'product-showcase':
    case 'analytics-detail':
    case 'command-center':
    case 'feature-tabs':
    case 'case-study':
    case 'onboarding-steps':
    case 'kanban-board':
    case 'release-notes-grid':
    case 'social-proof-strip':
    case 'integrations-grid':
    case 'settings-form':
    case 'profile-overview':
    case 'mobile-app-promo':
    case 'docs-detail':
    case 'metrics-sidebar':
      return getExtendedPresetTemplate(presetId);
    case 'auth-login':
    case 'auth-signup':
    case 'kpi-metrics-grid':
    case 'pricing-tier-featured':
    case 'master-detail-header':
    case 'user-account-settings':
    case 'billing-subscription':
      return getEnterprisePresetTemplate(presetId);
    case 'crud-collection-page':
    case 'not-found-error-pages':
    case 'advanced-search-results':
      return getPhase22BuiltInTemplate(presetId);
    case 'blank':
    default:
      return [] as TemplateNodeSeed[];
  }
};

export const createStateFromNewLayoutPreset = (
  presetId: NewLayoutPresetId,
): { state: ReturnType<typeof createInitialDesignerState>; preferredSelectedNodeId: string | null } => {
  const baseState = createInitialDesignerState();
  const template = getTemplateForPreset(presetId);
  if (template.length === 0) {
    return { state: baseState, preferredSelectedNodeId: null };
  }

  const rootNodeId = baseState.document.rootNodeId;
  const { nodes: clonedNodes, rootNodeIds } = cloneTemplateSeedsToNodes(template, rootNodeId, 0);
  const now = new Date().toISOString();

  return {
    state: {
      ...baseState,
      document: {
        ...baseState.document,
        nodes: {
          ...baseState.document.nodes,
          ...clonedNodes,
          [rootNodeId]: {
            ...baseState.document.nodes[rootNodeId],
            children: rootNodeIds,
          },
        },
        metadata: {
          ...baseState.document.metadata,
          updatedAt: now,
        },
      },
    },
    preferredSelectedNodeId: rootNodeIds[0] ?? null,
  };
};

const BUILT_IN_COMPONENT_EPOCH = '2024-01-01T00:00:00.000Z';

export const createStableStateFromNewLayoutPreset = (
  presetId: NewLayoutPresetId,
  componentId: string,
  componentName: string,
): { state: ReturnType<typeof createInitialDesignerState>; preferredSelectedNodeId: string | null } => {
  const baseState = createInitialDesignerState();
  const template = getTemplateForPreset(presetId);
  if (template.length === 0) {
    return {
      state: {
        ...baseState,
        document: {
          ...baseState.document,
          id: componentId,
          name: componentName,
          metadata: {
            createdAt: BUILT_IN_COMPONENT_EPOCH,
            updatedAt: BUILT_IN_COMPONENT_EPOCH,
          },
        },
      },
      preferredSelectedNodeId: null,
    };
  }

  const rootNodeId = baseState.document.rootNodeId;
  let nodeCounter = 0;
  const { nodes: clonedNodes, rootNodeIds } = cloneTemplateSeedsToNodes(template, rootNodeId, 0, {
    createNodeId: () => {
      nodeCounter += 1;
      return `${componentId}-node-${nodeCounter}`;
    },
  });

  return {
    state: {
      ...baseState,
      document: {
        ...baseState.document,
        id: componentId,
        name: componentName,
        nodes: {
          ...baseState.document.nodes,
          ...clonedNodes,
          [rootNodeId]: {
            ...baseState.document.nodes[rootNodeId],
            children: rootNodeIds,
          },
        },
        metadata: {
          createdAt: BUILT_IN_COMPONENT_EPOCH,
          updatedAt: BUILT_IN_COMPONENT_EPOCH,
        },
      },
    },
    preferredSelectedNodeId: rootNodeIds[0] ?? null,
  };
};

const listCopyTemplatePresets = (): NewLayoutPreset[] => (
  NEW_LAYOUT_PRESETS.filter((preset) => !isBuiltInShellPresetId(preset.id))
);

export function countPresetsForCategory(category: NewLayoutPresetCategory): number {
  const presets = listCopyTemplatePresets();
  if (category === 'all') {
    return presets.length;
  }
  return presets.filter((preset) => getPresetCategories(preset).includes(category)).length;
}

export function filterPresetsByCategory(category: NewLayoutPresetCategory): NewLayoutPreset[] {
  const presets = listCopyTemplatePresets();
  if (category === 'all') {
    return presets;
  }
  return presets.filter((preset) => getPresetCategories(preset).includes(category));
}
