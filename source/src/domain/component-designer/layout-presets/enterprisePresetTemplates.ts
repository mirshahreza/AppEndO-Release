import type { TemplateNodeSeed } from '../types';
import type { NewLayoutPresetId } from './types';

const card = 'rounded-xl border border-default-200 bg-content1 p-4 shadow-sm';
const cardFeatured = 'rounded-xl border-2 border-primary bg-content1 p-5 shadow-md ring-1 ring-primary/20';
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

add('auth-login', [{
    type: 'container',
    paletteItemId: 'html.section',
    props: { className: 'mx-auto flex w-full max-w-md flex-col gap-4 rounded-2xl border border-default-200 bg-content1 p-6 shadow-sm' },
    children: [
      {
        type: 'container',
        paletteItemId: 'layout.flex-column',
        props: { className: 'flex flex-col gap-1 text-center' },
        children: [
          {
            type: 'heading',
            paletteItemId: 'html.heading',
            props: { text: 'Sign in to your account', className: 'text-2xl font-semibold tracking-tight text-foreground' },
          },
          {
            type: 'text',
            paletteItemId: 'html.text',
            props: { text: 'Enter your credentials to access the workspace.', className: 'text-sm text-default-500' },
          },
        ],
      },
      {
        type: 'container',
        paletteItemId: 'html.form',
        props: { className: 'flex flex-col gap-3', method: 'post', action: '' },
        binding: bindingReadySubmit,
        children: [
          {
            type: 'container',
            paletteItemId: 'heroui.input-text',
            props: { placeholder: 'Email address', name: 'email', ariaLabel: 'Email address', inputType: 'email' },
          },
          {
            type: 'container',
            paletteItemId: 'heroui.input-text',
            props: { placeholder: 'Password', name: 'password', ariaLabel: 'Password', inputType: 'password' },
          },
          {
            type: 'container',
            paletteItemId: 'layout.flex-row',
            props: { className: 'flex flex-row items-center justify-between gap-3' },
            children: [
              {
                type: 'container',
                paletteItemId: 'heroui.switch',
                props: { ariaLabel: 'Remember me', className: 'inline-flex items-center gap-2' },
              },
              {
                type: 'link',
                paletteItemId: 'html.link',
                props: { text: 'Forgot password?', href: '#', target: '_self', rel: '', className: 'text-sm text-primary underline underline-offset-2 hover:opacity-80' },
              },
            ],
          },
          {
            type: 'link',
            paletteItemId: 'heroui.button-solid',
            props: { text: 'Sign in', href: '#', target: '_self', rel: '', className: `${btn} w-full justify-center` },
          },
        ],
      },
      {
        type: 'text',
        paletteItemId: 'html.text',
        props: { text: 'Need an account? Create one', className: 'text-center text-sm text-default-500' },
      },
    ],
  }]);

add('auth-signup', [{
    type: 'container',
    paletteItemId: 'html.section',
    props: { className: 'mx-auto flex w-full max-w-lg flex-col gap-4 rounded-2xl border border-default-200 bg-content1 p-6 shadow-sm' },
    children: [
      {
        type: 'container',
        paletteItemId: 'layout.flex-column',
        props: { className: 'flex flex-col gap-1' },
        children: [
          {
            type: 'heading',
            paletteItemId: 'html.heading',
            props: { text: 'Create your account', className: 'text-2xl font-semibold tracking-tight text-foreground' },
          },
          {
            type: 'text',
            paletteItemId: 'html.text',
            props: { text: 'Start your trial with a secure workspace profile.', className: 'text-sm text-default-500' },
          },
        ],
      },
      {
        type: 'container',
        paletteItemId: 'html.form',
        props: { className: 'flex flex-col gap-3', method: 'post', action: '' },
        binding: bindingReadySubmit,
        children: [
          {
            type: 'container',
            paletteItemId: 'layout.grid-2',
            props: { className: 'grid grid-cols-1 gap-3 md:grid-cols-2' },
            children: [
              {
                type: 'container',
                paletteItemId: 'heroui.input-text',
                props: { placeholder: 'First name', name: 'firstName', ariaLabel: 'First name' },
              },
              {
                type: 'container',
                paletteItemId: 'heroui.input-text',
                props: { placeholder: 'Last name', name: 'lastName', ariaLabel: 'Last name' },
              },
            ],
          },
          {
            type: 'container',
            paletteItemId: 'heroui.input-text',
            props: { placeholder: 'Work email', name: 'email', ariaLabel: 'Work email', inputType: 'email' },
          },
          {
            type: 'container',
            paletteItemId: 'heroui.input-text',
            props: { placeholder: 'Password', name: 'password', ariaLabel: 'Password', inputType: 'password' },
          },
          {
            type: 'container',
            paletteItemId: 'heroui.input-text',
            props: { placeholder: 'Confirm password', name: 'confirmPassword', ariaLabel: 'Confirm password', inputType: 'password' },
          },
          {
            type: 'link',
            paletteItemId: 'heroui.button-solid',
            props: { text: 'Create account', href: '#', target: '_self', rel: '', className: `${btn} w-full justify-center` },
          },
        ],
      },
    ],
  }]);

add('kpi-metrics-grid', [{
    type: 'container',
    paletteItemId: 'html.section',
    props: { className: 'mx-auto flex w-full max-w-6xl flex-col gap-4' },
    children: [
      {
        type: 'container',
        paletteItemId: 'layout.flex-row',
        props: { className: 'flex flex-row items-end justify-between gap-3' },
        children: [
          {
            type: 'container',
            paletteItemId: 'layout.flex-column',
            props: { className: 'flex flex-col gap-1' },
            children: [
              {
                type: 'heading',
                paletteItemId: 'html.heading',
                props: { text: 'Performance Overview', className: 'text-2xl font-semibold tracking-tight text-foreground' },
              },
              {
                type: 'text',
                paletteItemId: 'html.text',
                props: { text: 'Key metrics for the current billing period.', className: 'text-sm text-default-500' },
              },
            ],
          },
          {
            type: 'link',
            paletteItemId: 'heroui.button-outline',
            props: { text: 'Export report', href: '#', target: '_self', rel: '', className: btnOutline },
          },
        ],
      },
      {
        type: 'container',
        paletteItemId: 'layout.grid-2',
        props: { className: 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4' },
        children: [
          { type: 'container', paletteItemId: 'content.stat-trend', props: { label: 'Monthly Revenue', value: '$84.2K', trend: '+12.4% vs last month', trendDirection: 'up', className: 'w-full' } },
          { type: 'container', paletteItemId: 'content.stat-trend', props: { label: 'Active Users', value: '12,480', trend: '+3.1% vs last month', trendDirection: 'up', className: 'w-full' } },
          { type: 'container', paletteItemId: 'content.stat-trend', props: { label: 'Churn Rate', value: '2.3%', trend: '+0.4 pts vs last month', trendDirection: 'down', className: 'w-full' } },
          { type: 'container', paletteItemId: 'content.stat-trend', props: { label: 'Support SLA', value: '98.6%', trend: '-0.2 pts vs last month', trendDirection: 'down', className: 'w-full' } },
        ],
      },
    ],
  }]);

add('pricing-tier-featured', [{
    type: 'container',
    paletteItemId: 'html.section',
    props: { className: 'mx-auto w-full max-w-md' },
    children: [
      {
        type: 'container',
        paletteItemId: 'tailwind.pricing',
        props: { className: cardFeatured },
        children: [
          {
            type: 'text',
            paletteItemId: 'html.text',
            props: { text: 'Most popular', className: 'inline-flex w-fit rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary' },
          },
          {
            type: 'heading',
            paletteItemId: 'html.heading',
            props: { text: 'Pro Plan', className: 'mt-3 text-2xl font-semibold tracking-tight text-foreground' },
          },
          {
            type: 'text',
            paletteItemId: 'html.text',
            props: { text: 'For growing teams that need advanced controls.', className: 'mt-1 text-sm text-default-500' },
          },
          {
            type: 'heading',
            paletteItemId: 'html.heading',
            props: { text: '$49 / seat', className: 'mt-4 text-3xl font-bold tracking-tight text-foreground' },
          },
          {
            type: 'list',
            paletteItemId: 'html.list',
            props: { className: 'mt-4 list-disc space-y-1 ps-5 text-sm text-default-700' },
            children: [
              { type: 'list-item', paletteItemId: 'html.list-item', props: { text: 'Unlimited projects and environments' } },
              { type: 'list-item', paletteItemId: 'html.list-item', props: { text: 'Role-based access and audit logs' } },
              { type: 'list-item', paletteItemId: 'html.list-item', props: { text: 'Priority support with 4-hour SLA' } },
              { type: 'list-item', paletteItemId: 'html.list-item', props: { text: 'API access with usage analytics' } },
            ],
          },
          {
            type: 'link',
            paletteItemId: 'heroui.button-solid',
            props: { text: 'Upgrade to Pro', href: '#', target: '_self', rel: '', className: `${btn} mt-5 w-full justify-center` },
          },
        ],
      },
    ],
  }]);

add('master-detail-header', [{
    type: 'container',
    paletteItemId: 'html.section',
    props: { className: 'mx-auto flex w-full max-w-6xl flex-col gap-4' },
    children: [
      {
        type: 'container',
        paletteItemId: 'layout.flex-column',
        props: { className: 'w-full border-b border-default-200 bg-content1 px-5 py-4' },
        children: [
          {
            type: 'text',
            paletteItemId: 'html.text',
            props: { text: 'Workspace / Customers / Acme Corp', className: 'text-xs font-medium text-default-500' },
          },
          {
            type: 'container',
            paletteItemId: 'layout.flex-row',
            props: { className: 'mt-3 flex flex-row flex-wrap items-start justify-between gap-4' },
            children: [
              {
                type: 'container',
                paletteItemId: 'layout.flex-column',
                props: { className: 'flex min-w-0 flex-1 flex-col gap-1' },
                children: [
                  {
                    type: 'heading',
                    paletteItemId: 'html.heading',
                    props: { text: 'Acme Corp', className: 'text-2xl font-semibold tracking-tight text-foreground' },
                  },
                  {
                    type: 'text',
                    paletteItemId: 'html.text',
                    props: { text: 'Enterprise customer · Active since Jan 2024 · Owner: Jordan Lee', className: 'text-sm text-default-500' },
                  },
                ],
              },
              {
                type: 'container',
                paletteItemId: 'layout.flex-row',
                props: { className: 'flex shrink-0 flex-row flex-wrap items-center gap-2' },
                children: [
                  {
                    type: 'link',
                    paletteItemId: 'heroui.button-outline',
                    props: { text: 'View audit log', href: '#', target: '_self', rel: '', className: btnOutline },
                  },
                  {
                    type: 'link',
                    paletteItemId: 'heroui.button-solid',
                    props: { text: 'Edit account', href: '#', target: '_self', rel: '', className: btnSm },
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        type: 'container',
        paletteItemId: 'layout.grid-2',
        props: { className: 'grid grid-cols-1 gap-4 lg:grid-cols-[1fr,1.2fr] px-1' },
        children: [
          {
            type: 'container',
            paletteItemId: 'html.form',
            props: { className: `${card} flex flex-col gap-3`, method: 'post', action: '' },
            binding: bindingReadySubmit,
            children: [
              {
                type: 'heading',
                paletteItemId: 'html.heading',
                props: { text: 'Record details', className: 'text-base font-semibold text-foreground' },
              },
              {
                type: 'container',
                paletteItemId: 'heroui.input-text',
                props: { placeholder: 'Company name', name: 'companyName', ariaLabel: 'Company name', label: 'Company name', size: 'sm' },
              },
              {
                type: 'container',
                paletteItemId: 'heroui.input-text',
                props: { placeholder: 'Primary contact', name: 'primaryContact', ariaLabel: 'Primary contact', label: 'Primary contact', size: 'sm' },
              },
              {
                type: 'container',
                paletteItemId: 'heroui.select',
                props: {
                  placeholder: 'Status',
                  name: 'status',
                  ariaLabel: 'Status',
                  label: 'Status',
                  size: 'sm',
                  items: '[{"id":"active","textValue":"Active"},{"id":"paused","textValue":"Paused"},{"id":"churned","textValue":"Churned"}]',
                },
              },
              {
                type: 'link',
                paletteItemId: 'heroui.button-solid',
                props: { text: 'Save details', href: '#', target: '_self', rel: '', className: `${btnSm} w-fit` },
              },
            ],
          },
          {
            type: 'container',
            paletteItemId: 'layout.flex-column',
            props: { className: 'flex flex-col gap-2' },
            children: [
              {
                type: 'heading',
                paletteItemId: 'html.heading',
                props: { text: 'Related records', className: 'text-base font-semibold text-foreground' },
              },
              {
                type: 'container',
                paletteItemId: 'heroui.data-grid',
                props: {
                  className: 'w-full min-h-0 rounded-lg border border-slate-200 bg-white p-3',
                  columns: '[{"key":"id","label":"ID","sort":true,"width":"80px"},{"key":"name","label":"Name","sort":true},{"key":"status","label":"Status","width":"120px"}]',
                  gridQueryMode: 'client',
                  pageSize: 10,
                  page: 1,
                  total: 0,
                },
                binding: {
                  gridListResource: {
                    sourceType: 'apiRef' as const,
                    loadOperation: 'list' as const,
                  },
                },
              },
            ],
          },
        ],
      },
    ],
  }]);

add('user-account-settings', [{
    type: 'container',
    paletteItemId: 'html.section',
    props: { className: 'mx-auto flex w-full max-w-3xl flex-col gap-4' },
    children: [
      {
        type: 'heading',
        paletteItemId: 'html.heading',
        props: { text: 'Account Settings', className: 'text-2xl font-semibold tracking-tight text-foreground' },
      },
      {
        type: 'text',
        paletteItemId: 'html.text',
        props: { text: 'Manage your profile details and sign-in security.', className: 'text-sm text-default-500' },
      },
      {
        type: 'container',
        paletteItemId: 'html.form',
        props: { className: 'flex flex-col gap-4', method: 'post', action: '' },
        binding: bindingReadySubmit,
        children: [
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
              ariaLabel: 'Account tabs',
              items: [
                { key: 'tab-0', label: 'Profile' },
                { key: 'tab-1', label: 'Security' },
              ],
            },
            children: [
              {
                type: 'container',
                paletteItemId: 'tailwind.card',
                props: { className: card, _designerTabPane: true },
                children: [
                  {
                    type: 'heading',
                    paletteItemId: 'html.heading',
                    props: { text: 'Profile', className: 'text-base font-semibold text-foreground' },
                  },
                  {
                    type: 'container',
                    paletteItemId: 'layout.grid-2',
                    props: { className: 'mt-3 grid grid-cols-1 gap-3 md:grid-cols-2' },
                    children: [
                      {
                        type: 'container',
                        paletteItemId: 'heroui.input-text',
                        props: { placeholder: 'First name', name: 'firstName', ariaLabel: 'First name', size: 'sm' },
                      },
                      {
                        type: 'container',
                        paletteItemId: 'heroui.input-text',
                        props: { placeholder: 'Last name', name: 'lastName', ariaLabel: 'Last name', size: 'sm' },
                      },
                    ],
                  },
                  {
                    type: 'container',
                    paletteItemId: 'heroui.input-text',
                    props: { placeholder: 'Email address', name: 'email', ariaLabel: 'Email address', inputType: 'email', className: 'mt-3', size: 'sm' },
                  },
                ],
              },
              {
                type: 'container',
                paletteItemId: 'tailwind.card',
                props: { className: card, _designerTabPane: true },
                children: [
                  {
                    type: 'heading',
                    paletteItemId: 'html.heading',
                    props: { text: 'Password & Security', className: 'text-base font-semibold text-foreground' },
                  },
                  {
                    type: 'container',
                    paletteItemId: 'heroui.input-text',
                    props: { placeholder: 'Current password', name: 'currentPassword', ariaLabel: 'Current password', inputType: 'password', className: 'mt-3', size: 'sm' },
                  },
                  {
                    type: 'container',
                    paletteItemId: 'layout.grid-2',
                    props: { className: 'mt-3 grid grid-cols-1 gap-3 md:grid-cols-2' },
                    children: [
                      {
                        type: 'container',
                        paletteItemId: 'heroui.input-text',
                        props: { placeholder: 'New password', name: 'newPassword', ariaLabel: 'New password', inputType: 'password', size: 'sm' },
                      },
                      {
                        type: 'container',
                        paletteItemId: 'heroui.input-text',
                        props: { placeholder: 'Confirm new password', name: 'confirmPassword', ariaLabel: 'Confirm new password', inputType: 'password', size: 'sm' },
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            type: 'link',
            paletteItemId: 'heroui.button-solid',
            props: { text: 'Save account changes', href: '#', target: '_self', rel: '', className: `${btnSm} w-fit` },
          },
        ],
      },
    ],
  }]);

add('billing-subscription', [{
    type: 'container',
    paletteItemId: 'html.section',
    props: { className: 'mx-auto flex w-full max-w-5xl flex-col gap-4' },
    children: [
      {
        type: 'heading',
        paletteItemId: 'html.heading',
        props: { text: 'Billing & Subscription', className: 'text-2xl font-semibold tracking-tight text-foreground' },
      },
      {
        type: 'text',
        paletteItemId: 'html.text',
        props: { text: 'Review your plan, usage, and payment method.', className: 'text-sm text-default-500' },
      },
      {
        type: 'container',
        paletteItemId: 'layout.grid-2',
        props: { className: 'grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr,0.8fr]' },
        children: [
          {
            type: 'container',
            paletteItemId: 'tailwind.card',
            props: { className: card },
            children: [
              {
                type: 'container',
                paletteItemId: 'layout.flex-row',
                props: { className: 'flex flex-row items-start justify-between gap-3' },
                children: [
                  {
                    type: 'container',
                    paletteItemId: 'layout.flex-column',
                    props: { className: 'flex flex-col gap-1' },
                    children: [
                      {
                        type: 'text',
                        paletteItemId: 'html.text',
                        props: { text: 'Current plan', className: 'text-xs font-medium uppercase tracking-wide text-default-500' },
                      },
                      {
                        type: 'heading',
                        paletteItemId: 'html.heading',
                        props: { text: 'Pro · 25 seats', className: 'text-xl font-semibold text-foreground' },
                      },
                    ],
                  },
                  {
                    type: 'text',
                    paletteItemId: 'html.text',
                    props: { text: '$1,225 / mo', className: 'text-lg font-semibold text-foreground' },
                  },
                ],
              },
              {
                type: 'text',
                paletteItemId: 'html.text',
                props: { text: 'Renews on July 1, 2026 · Billed monthly', className: 'mt-2 text-sm text-default-500' },
              },
              {
                type: 'container',
                paletteItemId: 'layout.flex-row',
                props: { className: 'mt-4 flex flex-row flex-wrap gap-2' },
                children: [
                  {
                    type: 'link',
                    paletteItemId: 'heroui.button-solid',
                    props: { text: 'Change plan', href: '#', target: '_self', rel: '', className: btnSm },
                  },
                  {
                    type: 'link',
                    paletteItemId: 'heroui.button-outline',
                    props: { text: 'View invoices', href: '#', target: '_self', rel: '', className: btnOutline },
                  },
                ],
              },
            ],
          },
          {
            type: 'container',
            paletteItemId: 'tailwind.card',
            props: { className: card },
            children: [
              {
                type: 'heading',
                paletteItemId: 'html.heading',
                props: { text: 'Payment method', className: 'text-base font-semibold text-foreground' },
              },
              {
                type: 'text',
                paletteItemId: 'html.text',
                props: { text: 'Visa ending in 4242', className: 'mt-2 text-sm text-default-700' },
              },
              {
                type: 'text',
                paletteItemId: 'html.text',
                props: { text: 'Expires 09/2028', className: 'mt-1 text-xs text-default-500' },
              },
              {
                type: 'link',
                paletteItemId: 'html.link',
                props: { text: 'Update payment method', href: '#', target: '_self', rel: '', className: 'mt-4 inline-flex text-sm text-primary underline underline-offset-2 hover:opacity-80' },
              },
            ],
          },
        ],
      },
    ],
  }]);

export const ENTERPRISE_PRESET_TEMPLATES = templates;
;

export const getEnterprisePresetTemplate = (presetId: NewLayoutPresetId): TemplateNodeSeed[] =>
  ENTERPRISE_PRESET_TEMPLATES[presetId] ?? [];
