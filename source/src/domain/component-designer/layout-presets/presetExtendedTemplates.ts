import type { TemplateNodeSeed } from '../types';
import {
  MOCK_CHART_SALES_Q1_JSON,
  MOCK_KANBAN_BOARD_JSON,
} from '../visualizationMockFixtures';
import { DEFAULT_DESIGNER_IMAGE_SRC } from '../designerAssets';
import type { NewLayoutPresetId } from './types';
import {
  expandedEmptyStateTemplate,
  expandedNewsletterSignupTemplate,
  expandedPricingCardsTemplate,
} from './expandedPageStarterTemplates';

export type { TemplateNodeSeed };

const card = 'rounded-xl border border-default-200 bg-content1 p-4 shadow-sm';
const field = 'rounded-md border border-default-200 bg-content1 px-3 py-2';
const btn = 'inline-flex rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground no-underline hover:opacity-90';
const btnSm = 'inline-flex rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground no-underline hover:opacity-90';
const btnOutline = 'inline-flex rounded-md border border-default-300 px-3 py-1.5 text-xs font-semibold text-default-700 no-underline hover:bg-default-50';

const bindingReadySubmit = {
  'event:onSubmit': {
    sourceType: 'apiRef' as const,
  },
};

const templates: Partial<Record<NewLayoutPresetId, TemplateNodeSeed[]>> = {};
const add = (key: NewLayoutPresetId, value: TemplateNodeSeed[]) => { templates[key] = value; };

add('bento-hero', [{
    type: 'container',
    props: { className: 'mx-auto flex w-full max-w-6xl flex-col gap-3' },
    children: [
      { type: 'heading', props: { text: 'Everything In One View', className: 'text-2xl font-semibold tracking-tight text-slate-900' } },
      {
        type: 'container',
        props: { className: 'grid grid-cols-1 gap-2 md:grid-cols-4 md:grid-rows-2' },
        children: [
          {
            type: 'container',
            props: { className: `${card} md:col-span-2 md:row-span-2 bg-gradient-to-br from-cyan-50 to-blue-50` },
            children: [
              { type: 'heading', props: { text: 'Primary Highlight', className: 'text-xl font-semibold text-slate-900' } },
              { type: 'text', props: { text: 'Lead with your strongest value proposition.', className: 'mt-1 text-sm text-slate-600' } },
              { type: 'link', props: { text: 'Explore', href: '#', target: '_self', rel: '', className: btnSm } },
            ],
          },
          { type: 'container', props: { className: card }, children: [{ type: 'heading', props: { text: 'Speed', className: 'text-sm font-semibold text-slate-800' } }, { type: 'text', props: { text: 'Ship faster.', className: 'text-xs text-slate-600' } }] },
          { type: 'container', props: { className: card }, children: [{ type: 'heading', props: { text: 'Scale', className: 'text-sm font-semibold text-slate-800' } }, { type: 'text', props: { text: 'Grow confidently.', className: 'text-xs text-slate-600' } }] },
          { type: 'container', props: { className: card }, children: [{ type: 'image', props: { src: DEFAULT_DESIGNER_IMAGE_SRC, alt: 'Preview', className: 'h-20 w-full rounded-lg object-cover' } }] },
          { type: 'container', props: { className: card }, children: [{ type: 'heading', props: { text: 'Insights', className: 'text-sm font-semibold text-slate-800' } }, { type: 'text', props: { text: 'Track outcomes.', className: 'text-xs text-slate-600' } }] },
        ],
      },
    ],
  }]);

add('comparison-table', expandedPricingCardsTemplate('Plan Comparison'));

add('roadmap-board', [{
    type: 'container',
    props: { className: 'mx-auto flex w-full max-w-6xl flex-col gap-3' },
    children: [
      { type: 'heading', props: { text: 'Product Roadmap', className: 'text-2xl font-semibold text-slate-900' } },
      {
        type: 'container',
        props: { className: 'grid grid-cols-1 gap-3 md:grid-cols-3' },
        children: [
          { type: 'container', props: { className: card }, children: [{ type: 'heading', props: { text: 'Q1', className: 'text-base font-semibold text-slate-800' } }, { type: 'text', props: { text: '• Auth refresh\n• Billing v2', className: 'mt-2 whitespace-pre-line text-sm text-slate-600' } }] },
          { type: 'container', props: { className: card }, children: [{ type: 'heading', props: { text: 'Q2', className: 'text-base font-semibold text-slate-800' } }, { type: 'text', props: { text: '• Analytics hub\n• Team roles', className: 'mt-2 whitespace-pre-line text-sm text-slate-600' } }] },
          { type: 'container', props: { className: card }, children: [{ type: 'heading', props: { text: 'Q3', className: 'text-base font-semibold text-slate-800' } }, { type: 'text', props: { text: '• Mobile app\n• API gateway', className: 'mt-2 whitespace-pre-line text-sm text-slate-600' } }] },
        ],
      },
    ],
  }]);

add('newsletter-signup', expandedNewsletterSignupTemplate());

add('support-center', [{
    type: 'container',
    props: { className: 'mx-auto flex w-full max-w-5xl flex-col gap-4' },
    children: [
      { type: 'heading', props: { text: 'How Can We Help?', className: 'text-2xl font-semibold text-slate-900' } },
      { type: 'container', props: { className: `${field} text-slate-500` }, children: [{ type: 'text', props: { text: 'Search help articles...', className: 'text-sm text-slate-500' } }] },
      {
        type: 'container',
        props: { className: 'grid grid-cols-1 gap-3 md:grid-cols-2' },
        children: [
          { type: 'container', props: { className: card }, children: [{ type: 'heading', props: { text: 'Getting Started', className: 'text-base font-semibold text-slate-800' } }, { type: 'text', props: { text: 'Setup, onboarding, and first steps.', className: 'text-sm text-slate-600' } }] },
          { type: 'container', props: { className: card }, children: [{ type: 'heading', props: { text: 'Billing', className: 'text-base font-semibold text-slate-800' } }, { type: 'text', props: { text: 'Plans, invoices, and payments.', className: 'text-sm text-slate-600' } }] },
          { type: 'container', props: { className: card }, children: [{ type: 'heading', props: { text: 'Integrations', className: 'text-base font-semibold text-slate-800' } }, { type: 'text', props: { text: 'Connect tools and webhooks.', className: 'text-sm text-slate-600' } }] },
          { type: 'container', props: { className: card }, children: [{ type: 'heading', props: { text: 'Troubleshooting', className: 'text-base font-semibold text-slate-800' } }, { type: 'text', props: { text: 'Common issues and fixes.', className: 'text-sm text-slate-600' } }] },
        ],
      },
    ],
  }]);

add('event-agenda', [{
    type: 'container',
    props: { className: 'mx-auto flex w-full max-w-4xl flex-col gap-3' },
    children: [
      { type: 'heading', props: { text: 'Conference Agenda', className: 'text-2xl font-semibold text-slate-900' } },
      {
        type: 'container',
        props: { className: 'space-y-2' },
        children: [
          { type: 'container', props: { className: 'grid grid-cols-[88px,1fr] gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm' }, children: [{ type: 'text', props: { text: '09:00', className: 'text-sm font-semibold text-cyan-700' } }, { type: 'container', props: { className: 'space-y-1' }, children: [{ type: 'heading', props: { text: 'Opening Keynote', className: 'text-base font-semibold text-slate-800' } }, { type: 'text', props: { text: 'Vision and product direction.', className: 'text-sm text-slate-600' } }] }] },
          { type: 'container', props: { className: 'grid grid-cols-[88px,1fr] gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm' }, children: [{ type: 'text', props: { text: '11:30', className: 'text-sm font-semibold text-cyan-700' } }, { type: 'container', props: { className: 'space-y-1' }, children: [{ type: 'heading', props: { text: 'Design Systems Workshop', className: 'text-base font-semibold text-slate-800' } }, { type: 'text', props: { text: 'Hands-on component patterns.', className: 'text-sm text-slate-600' } }] }] },
          { type: 'container', props: { className: 'grid grid-cols-[88px,1fr] gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm' }, children: [{ type: 'text', props: { text: '15:00', className: 'text-sm font-semibold text-cyan-700' } }, { type: 'container', props: { className: 'space-y-1' }, children: [{ type: 'heading', props: { text: 'Panel: Shipping At Scale', className: 'text-base font-semibold text-slate-800' } }, { type: 'text', props: { text: 'Lessons from high-growth teams.', className: 'text-sm text-slate-600' } }] }] },
        ],
      },
    ],
  }]);

add('empty-state', expandedEmptyStateTemplate());

add('product-showcase', [{
    type: 'container',
    props: { className: 'mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-4 md:grid-cols-2' },
    children: [
      { type: 'container', props: { className: 'overflow-hidden rounded-xl border border-slate-200 bg-slate-100 p-2 shadow-sm' }, children: [{ type: 'image', props: { src: DEFAULT_DESIGNER_IMAGE_SRC, alt: 'Product', className: 'h-64 w-full rounded-lg object-cover' } }] },
      {
        type: 'container',
        props: { className: 'space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm' },
        children: [
          { type: 'heading', props: { text: 'Product Name', className: 'text-2xl font-semibold text-slate-900' } },
          { type: 'text', props: { text: 'Highlight key benefits, specs, and social proof beside a strong visual.', className: 'text-sm text-slate-600' } },
          { type: 'text', props: { text: '★★★★★  4.9 average rating', className: 'text-sm font-medium text-amber-600' } },
          { type: 'link', props: { text: 'Buy Now', href: '#', target: '_self', rel: '', className: btn } },
        ],
      },
    ],
  }]);

add('analytics-detail', [{
    type: 'container',
    paletteItemId: 'html.section',
    props: { className: 'mx-auto flex w-full max-w-6xl flex-col gap-3' },
    children: [
      { type: 'heading', paletteItemId: 'html.heading', props: { text: 'Revenue Analytics', className: 'text-2xl font-semibold text-slate-900' } },
      {
        type: 'container',
        paletteItemId: 'viz.chart-line',
        props: {
          title: 'Trend over last 30 days',
          data: MOCK_CHART_SALES_Q1_JSON,
          seriesKeys: 'revenue',
          chartVariant: 'area',
          className: 'w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm',
        },
      },
      {
        type: 'container',
        paletteItemId: 'layout.grid-2',
        props: { className: 'grid grid-cols-1 gap-3 md:grid-cols-3' },
        children: [
          { type: 'container', paletteItemId: 'content.stat-trend', props: { label: 'Avg. Order', value: '$84.20', trend: '+6%', trendDirection: 'up', className: 'w-full' } },
          { type: 'container', paletteItemId: 'content.stat-trend', props: { label: 'Refund Rate', value: '1.2%', trend: '-0.3%', trendDirection: 'down', className: 'w-full' } },
          { type: 'container', paletteItemId: 'content.stat-trend', props: { label: 'Top Region', value: 'EMEA', trend: 'Stable', trendDirection: 'up', className: 'w-full' } },
        ],
      },
    ],
  }]);

add('command-center', [{
    type: 'container',
    props: { className: 'mx-auto flex w-full max-w-6xl flex-col gap-3' },
    children: [
      { type: 'heading', props: { text: 'Operations Command Center', className: 'text-xl font-semibold text-slate-900' } },
      {
        type: 'container',
        paletteItemId: 'feedback.alert',
        props: { title: 'All Systems Operational', message: 'No active incidents. Last deploy 12 min ago.', variant: 'success', className: 'w-full' },
      },
      {
        type: 'container',
        props: { className: 'grid grid-cols-1 gap-2 md:grid-cols-2' },
        children: [
          { type: 'container', props: { className: card }, children: [{ type: 'heading', props: { text: 'Deployments', className: 'text-sm font-semibold text-slate-800' } }, { type: 'text', props: { text: 'Last deploy: 12 min ago', className: 'text-sm text-slate-600' } }] },
          { type: 'container', props: { className: card }, children: [{ type: 'heading', props: { text: 'On-Call', className: 'text-sm font-semibold text-slate-800' } }, { type: 'text', props: { text: 'Team Alpha · Pager active', className: 'text-sm text-slate-600' } }] },
        ],
      },
    ],
  }]);

add('feature-tabs', [{
    type: 'container',
    props: { className: 'mx-auto flex w-full max-w-5xl flex-col gap-3' },
    children: [
      { type: 'heading', props: { text: 'Platform Capabilities', className: 'text-2xl font-semibold text-slate-900' } },
      {
        type: 'container',
        paletteItemId: 'content.segmented-control',
        props: { options: 'Automation,Security,Analytics', selected: 'Automation', className: 'w-full' },
      },
      { type: 'container', props: { className: card }, children: [{ type: 'heading', props: { text: 'Automation Workflows', className: 'text-lg font-semibold text-slate-800' } }, { type: 'text', props: { text: 'Trigger actions from events, schedules, or manual runs.', className: 'mt-1 text-sm text-slate-600' } }] },
    ],
  }]);

add('case-study', [{
    type: 'container',
    props: { className: 'mx-auto flex w-full max-w-5xl flex-col gap-4' },
    children: [
      { type: 'heading', props: { text: 'How Acme Cut Delivery Time By 40%', className: 'text-2xl font-semibold text-slate-900' } },
      { type: 'text', props: { text: 'A practical look at the workflow changes that improved throughput across teams.', className: 'text-sm text-slate-600' } },
      {
        type: 'container',
        props: { className: 'grid grid-cols-1 gap-3 md:grid-cols-3' },
        children: [
          { type: 'container', props: { className: 'rounded-lg bg-cyan-50 p-3 text-center' }, children: [{ type: 'heading', props: { text: '40%', className: 'text-2xl font-semibold text-cyan-700' } }, { type: 'text', props: { text: 'Faster delivery', className: 'text-xs text-slate-600' } }] },
          { type: 'container', props: { className: 'rounded-lg bg-cyan-50 p-3 text-center' }, children: [{ type: 'heading', props: { text: '3x', className: 'text-2xl font-semibold text-cyan-700' } }, { type: 'text', props: { text: 'Release cadence', className: 'text-xs text-slate-600' } }] },
          { type: 'container', props: { className: 'rounded-lg bg-cyan-50 p-3 text-center' }, children: [{ type: 'heading', props: { text: '92%', className: 'text-2xl font-semibold text-cyan-700' } }, { type: 'text', props: { text: 'Team satisfaction', className: 'text-xs text-slate-600' } }] },
        ],
      },
    ],
  }]);

add('onboarding-steps', [{
    type: 'container',
    props: { className: 'mx-auto flex w-full max-w-3xl flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm' },
    children: [
      { type: 'heading', props: { text: 'Get Started', className: 'text-2xl font-semibold text-slate-900' } },
      {
        type: 'container',
        paletteItemId: 'content.stepper',
        props: { steps: 'Profile,Workspace,Invite Team', activeStep: 0, className: 'w-full' },
      },
      { type: 'heading', props: { text: 'Step 1: Complete Your Profile', className: 'text-lg font-semibold text-slate-800' } },
      {
        type: 'container',
        paletteItemId: 'heroui.input-text',
        props: { placeholder: 'Display name', name: 'displayName', ariaLabel: 'Display name' },
      },
      { type: 'link', props: { text: 'Continue', href: '#', target: '_self', rel: '', className: btnSm },
      },
    ],
  }]);

add('kanban-board', [{
    type: 'container',
    paletteItemId: 'html.section',
    props: { className: 'mx-auto flex w-full max-w-6xl flex-col gap-3' },
    children: [
      { type: 'heading', paletteItemId: 'html.heading', props: { text: 'Sprint Board', className: 'text-2xl font-semibold text-slate-900' } },
      {
        type: 'container',
        paletteItemId: 'viz.kanban',
        props: {
          title: 'Sprint Board',
          data: MOCK_KANBAN_BOARD_JSON,
          className: 'w-full',
        },
      },
    ],
  }]);

add('release-notes-grid', [{
    type: 'container',
    props: { className: 'mx-auto flex w-full max-w-5xl flex-col gap-3' },
    children: [
      { type: 'heading', props: { text: 'Release Notes', className: 'text-2xl font-semibold text-slate-900' } },
      {
        type: 'container',
        props: { className: 'grid grid-cols-1 gap-3 md:grid-cols-2' },
        children: [
          { type: 'container', props: { className: card }, children: [{ type: 'heading', props: { text: 'v3.2.0', className: 'text-base font-semibold text-slate-800' } }, { type: 'text', props: { text: 'New designer presets and improved drag targets.', className: 'text-sm text-slate-600' } }] },
          { type: 'container', props: { className: card }, children: [{ type: 'heading', props: { text: 'v3.1.4', className: 'text-base font-semibold text-slate-800' } }, { type: 'text', props: { text: 'Runtime preview stability fixes.', className: 'text-sm text-slate-600' } }] },
          { type: 'container', props: { className: card }, children: [{ type: 'heading', props: { text: 'v3.1.0', className: 'text-base font-semibold text-slate-800' } }, { type: 'text', props: { text: 'Binding editor and outline improvements.', className: 'text-sm text-slate-600' } }] },
          { type: 'container', props: { className: card }, children: [{ type: 'heading', props: { text: 'v3.0.0', className: 'text-base font-semibold text-slate-800' } }, { type: 'text', props: { text: 'Major workspace layout refresh.', className: 'text-sm text-slate-600' } }] },
        ],
      },
    ],
  }]);

add('social-proof-strip', [{
    type: 'container',
    props: { className: 'mx-auto flex w-full max-w-6xl flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm' },
    children: [
      { type: 'text', props: { text: 'Trusted by teams at', className: 'text-center text-xs font-semibold uppercase tracking-wide text-slate-500' } },
      {
        type: 'container',
        props: { className: 'grid grid-cols-2 gap-2 md:grid-cols-5' },
        children: [
          { type: 'text', props: { text: 'Acme', className: 'rounded-md bg-slate-50 py-2 text-center text-sm font-semibold text-slate-600' } },
          { type: 'text', props: { text: 'Northwind', className: 'rounded-md bg-slate-50 py-2 text-center text-sm font-semibold text-slate-600' } },
          { type: 'text', props: { text: 'Globex', className: 'rounded-md bg-slate-50 py-2 text-center text-sm font-semibold text-slate-600' } },
          { type: 'text', props: { text: 'Initech', className: 'rounded-md bg-slate-50 py-2 text-center text-sm font-semibold text-slate-600' } },
          { type: 'text', props: { text: 'Umbrella', className: 'rounded-md bg-slate-50 py-2 text-center text-sm font-semibold text-slate-600' } },
        ],
      },
      { type: 'text', props: { text: '“We shipped our new onboarding in half the time.” — VP Product', className: 'text-center text-sm italic text-slate-600' } },
    ],
  }]);

add('integrations-grid', [{
    type: 'container',
    props: { className: 'mx-auto flex w-full max-w-5xl flex-col gap-3' },
    children: [
      { type: 'heading', props: { text: 'Connected Integrations', className: 'text-2xl font-semibold text-slate-900' } },
      {
        type: 'container',
        props: { className: 'grid grid-cols-2 gap-2 md:grid-cols-4' },
        children: [
          { type: 'container', props: { className: 'rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center' }, children: [{ type: 'text', props: { text: 'Slack ✓', className: 'text-sm font-semibold text-emerald-800' } }] },
          { type: 'container', props: { className: 'rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center' }, children: [{ type: 'text', props: { text: 'GitHub ✓', className: 'text-sm font-semibold text-emerald-800' } }] },
          { type: 'container', props: { className: 'rounded-lg border border-slate-200 bg-white p-3 text-center' }, children: [{ type: 'text', props: { text: 'Jira', className: 'text-sm font-semibold text-slate-700' } }] },
          { type: 'container', props: { className: 'rounded-lg border border-slate-200 bg-white p-3 text-center' }, children: [{ type: 'text', props: { text: 'Stripe', className: 'text-sm font-semibold text-slate-700' } }] },
          { type: 'container', props: { className: 'rounded-lg border border-slate-200 bg-white p-3 text-center' }, children: [{ type: 'text', props: { text: 'Notion', className: 'text-sm font-semibold text-slate-700' } }] },
          { type: 'container', props: { className: 'rounded-lg border border-slate-200 bg-white p-3 text-center' }, children: [{ type: 'text', props: { text: 'Figma', className: 'text-sm font-semibold text-slate-700' } }] },
          { type: 'container', props: { className: 'rounded-lg border border-slate-200 bg-white p-3 text-center' }, children: [{ type: 'text', props: { text: 'Zendesk', className: 'text-sm font-semibold text-slate-700' } }] },
          { type: 'container', props: { className: 'rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-center' }, children: [{ type: 'text', props: { text: '+ Add', className: 'text-sm font-semibold text-slate-500' } }] },
        ],
      },
    ],
  }]);

add('settings-form', [{
    type: 'container',
    paletteItemId: 'html.form',
    props: { className: 'mx-auto flex w-full max-w-3xl flex-col gap-4', method: 'post', action: '' },
    binding: bindingReadySubmit,
    children: [
      { type: 'heading', paletteItemId: 'html.heading', props: { text: 'Workspace Settings', className: 'text-2xl font-semibold tracking-tight text-foreground' } },
      {
        type: 'container',
        paletteItemId: 'tailwind.card',
        props: { className: card },
        children: [
          { type: 'heading', paletteItemId: 'html.heading', props: { text: 'General', className: 'text-base font-semibold text-foreground' } },
          {
            type: 'container',
            paletteItemId: 'heroui.input-text',
            props: { placeholder: 'Workspace name', name: 'workspaceName', ariaLabel: 'Workspace name', className: 'mt-2' },
          },
          {
            type: 'container',
            paletteItemId: 'heroui.input-text',
            props: { placeholder: 'Default timezone', name: 'timezone', ariaLabel: 'Default timezone', className: 'mt-2' },
          },
        ],
      },
      {
        type: 'container',
        paletteItemId: 'tailwind.card',
        props: { className: card },
        children: [
          { type: 'heading', paletteItemId: 'html.heading', props: { text: 'Notifications', className: 'text-base font-semibold text-foreground' } },
          { type: 'text', paletteItemId: 'html.text', props: { text: 'Email alerts for deployments and incidents.', className: 'mt-1 text-sm text-default-600' } },
        ],
      },
      {
        type: 'link',
        paletteItemId: 'heroui.button-solid',
        props: { text: 'Save Changes', href: '#', target: '_self', rel: '', className: btnSm },
      },
    ],
  }]);

add('profile-overview', [{
    type: 'container',
    paletteItemId: 'html.section',
    props: { className: 'mx-auto flex w-full max-w-4xl flex-col gap-4' },
    children: [
      {
        type: 'container',
        paletteItemId: 'layout.flex-row',
        props: { className: 'flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center' },
        children: [
          {
            type: 'container',
            paletteItemId: 'heroui.avatar',
            props: { className: 'inline-flex h-16 w-16 items-center justify-center rounded-full bg-cyan-100 text-lg font-semibold text-cyan-700' },
            children: [
              { type: 'text', paletteItemId: 'html.text', props: { text: 'MK', className: 'text-lg font-semibold text-cyan-700' } },
            ],
          },
          {
            type: 'container',
            paletteItemId: 'layout.flex-column',
            props: { className: 'flex flex-col gap-1' },
            children: [
              { type: 'heading', paletteItemId: 'html.heading', props: { text: 'Mohsen Kim', className: 'text-xl font-semibold text-slate-900' } },
              { type: 'text', paletteItemId: 'html.text', props: { text: 'Product Designer · San Francisco', className: 'text-sm text-slate-600' } },
            ],
          },
        ],
      },
      {
        type: 'container',
        paletteItemId: 'heroui.tabs',
        props: {
          className: 'min-w-0 w-full',
          placement: 'top',
          alignment: 'start',
          width: 'fit',
          variant: 'line',
          defaultSelectedKey: 'tab-0',
          ariaLabel: 'Profile tabs',
          items: [
            { key: 'tab-0', label: 'Overview' },
            { key: 'tab-1', label: 'Activity' },
            { key: 'tab-2', label: 'Settings' },
          ],
        },
        children: [
          {
            type: 'container',
            paletteItemId: 'layout.flex-column',
            props: { className: 'flex flex-col gap-3 p-2', _designerTabPane: true },
            children: [
              {
                type: 'container',
                paletteItemId: 'layout.grid-2',
                props: { className: 'grid grid-cols-3 gap-3' },
                children: [
                  { type: 'container', paletteItemId: 'content.stat-trend', props: { label: 'Projects', value: '24', trend: '+2', trendDirection: 'up', className: 'w-full' } },
                  { type: 'container', paletteItemId: 'content.stat-trend', props: { label: 'Contributions', value: '156', trend: '+12', trendDirection: 'up', className: 'w-full' } },
                  { type: 'container', paletteItemId: 'content.stat-trend', props: { label: 'Rating', value: '4.9', trend: 'Stable', trendDirection: 'up', className: 'w-full' } },
                ],
              },
            ],
          },
          {
            type: 'container',
            paletteItemId: 'layout.flex-column',
            props: { className: 'flex flex-col gap-2 p-2', _designerTabPane: true },
            children: [
              { type: 'heading', paletteItemId: 'html.heading', props: { text: 'Recent activity', className: 'text-base font-semibold text-slate-800' } },
              { type: 'text', paletteItemId: 'html.text', props: { text: 'Published design system updates and reviewed three pull requests this week.', className: 'text-sm text-slate-600' } },
            ],
          },
          {
            type: 'container',
            paletteItemId: 'layout.flex-column',
            props: { className: 'flex flex-col gap-2 p-2', _designerTabPane: true },
            children: [
              { type: 'heading', paletteItemId: 'html.heading', props: { text: 'Quick settings', className: 'text-base font-semibold text-slate-800' } },
              {
                type: 'container',
                paletteItemId: 'heroui.switch',
                props: { ariaLabel: 'Email notifications', className: 'inline-flex items-center gap-2' },
              },
            ],
          },
        ],
      },
    ],
  }]);

add('mobile-app-promo', [{
    type: 'container',
    props: { className: 'mx-auto grid w-full max-w-5xl grid-cols-1 items-center gap-4 rounded-2xl border border-slate-200 bg-gradient-to-r from-indigo-50 to-cyan-50 p-5 md:grid-cols-2' },
    children: [
      { type: 'container', props: { className: 'mx-auto w-40 rounded-[1.5rem] border-4 border-slate-800 bg-white p-2 shadow-lg' }, children: [{ type: 'image', props: { src: DEFAULT_DESIGNER_IMAGE_SRC, alt: 'App preview', className: 'h-56 w-full rounded-2xl object-cover' } }] },
      {
        type: 'container',
        props: { className: 'space-y-3' },
        children: [
          { type: 'heading', props: { text: 'Download Our Mobile App', className: 'text-2xl font-semibold text-slate-900' } },
          { type: 'text', props: { text: 'Manage projects on the go with offline sync and push alerts.', className: 'text-sm text-slate-600' } },
          { type: 'container', props: { className: 'flex flex-wrap gap-2' }, children: [{ type: 'link', props: { text: 'App Store', href: '#', target: '_self', rel: '', className: btnSm } }, { type: 'link', props: { text: 'Google Play', href: '#', target: '_self', rel: '', className: btnOutline } }] },
        ],
      },
    ],
  }]);

add('docs-detail', [{
    type: 'container',
    props: { className: 'mx-auto grid w-full max-w-6xl grid-cols-1 gap-3 md:grid-cols-[200px,1fr]' },
    children: [
      {
        type: 'container',
        props: { className: 'rounded-xl border border-slate-200 bg-slate-50 p-3' },
        children: [
          { type: 'heading', props: { text: 'On This Page', className: 'text-xs font-semibold uppercase tracking-wide text-slate-500' } },
          { type: 'list', props: { className: 'mt-2 list-none space-y-1 text-sm text-slate-600' }, children: [{ type: 'list-item', props: { text: 'Overview' } }, { type: 'list-item', props: { text: 'Installation' } }, { type: 'list-item', props: { text: 'Configuration' } }, { type: 'list-item', props: { text: 'Examples' } }] },
        ],
      },
      {
        type: 'container',
        props: { className: card },
        children: [
          { type: 'heading', props: { text: 'Getting Started', className: 'text-2xl font-semibold text-slate-900' } },
          { type: 'text', props: { text: 'Follow this guide to install, configure, and run your first component.', className: 'mt-2 text-sm text-slate-600' } },
          { type: 'heading', props: { text: 'Installation', className: 'mt-4 text-lg font-semibold text-slate-800' } },
          { type: 'text', props: { text: 'Add the package and import the designer module in your app entry.', className: 'text-sm text-slate-600' } },
        ],
      },
    ],
  }]);

add('metrics-sidebar', [{
    type: 'container',
    paletteItemId: 'html.section',
    props: { className: 'mx-auto grid w-full max-w-6xl grid-cols-1 gap-3 md:grid-cols-[1fr,220px]' },
    children: [
      {
        type: 'container',
        paletteItemId: 'layout.flex-column',
        props: { className: 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm' },
        children: [
          { type: 'heading', paletteItemId: 'html.heading', props: { text: 'Weekly Report', className: 'text-xl font-semibold text-slate-900' } },
          {
            type: 'container',
            paletteItemId: 'viz.chart-bar',
            props: {
              title: 'Revenue vs Cost',
              data: MOCK_CHART_SALES_Q1_JSON,
              seriesKeys: 'revenue,cost',
              grouped: true,
              className: 'mt-3 w-full rounded-lg border border-slate-100 bg-white p-3',
            },
          },
        ],
      },
      {
        type: 'container',
        paletteItemId: 'layout.flex-column',
        props: { className: 'space-y-2' },
        children: [
          { type: 'container', paletteItemId: 'content.stat-trend', props: { label: 'Visitors', value: '18.2K', trend: '+9%', trendDirection: 'up', className: 'w-full' } },
          { type: 'container', paletteItemId: 'content.stat-trend', props: { label: 'Bounce Rate', value: '32%', trend: '-2%', trendDirection: 'down', className: 'w-full' } },
          { type: 'container', paletteItemId: 'content.stat-trend', props: { label: 'Avg. Session', value: '4m 12s', trend: '+18s', trendDirection: 'up', className: 'w-full' } },
        ],
      },
    ],
  }]);

export const EXTENDED_PRESET_TEMPLATES = templates;
;
