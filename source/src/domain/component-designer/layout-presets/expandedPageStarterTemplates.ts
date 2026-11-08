import type { TemplateNodeSeed } from '../types';
import {
  MOCK_BLOG_POSTS_JSON,
  MOCK_FAQ_ITEMS_JSON,
  MOCK_FEATURE_GRID_JSON,
  MOCK_PRICING_TIERS_JSON,
  MOCK_TEAM_MEMBERS_JSON,
  MOCK_TESTIMONIALS_JSON,
} from '../universalMockFixtures';

/**
 * Page-starter templates must copy editable layout nodes into the new component
 * (heading, cards, buttons, …). Do not leave a single composite template widget
 * (`content.feature-grid`, `marketing.hero-cta`, …) as the document body.
 */
export const PAGE_STARTER_COMPOSITE_WIDGET_IDS = [
  'content.feature-grid',
  'content.blog-card',
  'content.team-member',
  'content.cta-banner',
  'marketing.hero-cta',
  'marketing.pricing-table',
  'marketing.faq-accordion',
  'marketing.testimonial-carousel',
  'marketing.newsletter-signup',
  'feedback.empty-state',
] as const;

const heading = (text: string, className: string): TemplateNodeSeed => ({
  type: 'heading',
  paletteItemId: 'html.heading',
  props: { text, className },
});

const text = (value: string, className: string): TemplateNodeSeed => ({
  type: 'text',
  paletteItemId: 'html.text',
  props: { text: value, className },
});

const box = (className: string, children: TemplateNodeSeed[], paletteItemId = 'html.container'): TemplateNodeSeed => ({
  type: 'container',
  paletteItemId,
  props: { className },
  children,
});

const actionButton = (label: string, className: string): TemplateNodeSeed => ({
  type: 'link',
  paletteItemId: 'heroui.button-solid',
  props: {
    text: label,
    href: '#',
    target: '_self',
    rel: '',
    type: 'button',
    className,
  },
});

const parseRecords = <T,>(raw: string): T[] => JSON.parse(raw) as T[];

export const expandedHeroCtaTemplate = (): TemplateNodeSeed[] => [
  box(
    'w-full rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 px-8 py-12 text-white',
    [
      heading('Build Your Next Experience', 'text-3xl font-bold tracking-tight text-white'),
      text(
        'Compose powerful sections quickly with reusable blocks and clean bindings.',
        'mt-3 max-w-2xl text-base text-slate-200',
      ),
      box('mt-6 flex flex-wrap gap-3', [
        actionButton('Get Started', 'rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-900 no-underline'),
        actionButton('Learn More', 'rounded-md border border-white/40 bg-transparent px-4 py-2 text-sm font-medium text-white no-underline'),
      ]),
    ],
    'html.section',
  ),
];

export const expandedFeatureGridTemplate = (): TemplateNodeSeed[] => {
  const features = parseRecords<{ title: string; description: string }>(MOCK_FEATURE_GRID_JSON);
  return [
    box('w-full', [
      heading('Core Features', 'mb-4 text-lg font-semibold text-slate-900'),
      box(
        'grid gap-4 md:grid-cols-3',
        features.map((feature) => box('rounded-lg border border-slate-200 bg-white p-4', [
          heading(feature.title, 'font-semibold text-slate-900'),
          text(feature.description, 'mt-1 text-sm text-slate-600'),
        ])),
      ),
    ]),
  ];
};

export const expandedPricingCardsTemplate = (title = 'Simple Pricing'): TemplateNodeSeed[] => {
  const tiers = parseRecords<{
    name: string;
    price: string;
    period?: string;
    features?: string[];
    cta?: string;
    featured?: boolean;
  }>(MOCK_PRICING_TIERS_JSON);

  return [
    box('w-full', [
      heading(title, 'mb-4 text-center text-lg font-semibold text-slate-900'),
      box(
        'grid gap-4 md:grid-cols-3',
        tiers.map((tier) => box(
          tier.featured
            ? 'rounded-xl border border-primary bg-primary/5 p-4 shadow-md'
            : 'rounded-xl border border-slate-200 bg-white p-4',
          [
            text(tier.name, 'text-sm font-semibold text-slate-800'),
            heading(`${tier.price}${tier.period ?? ''}`, 'mt-2 text-2xl font-bold text-slate-900'),
            {
              type: 'list',
              paletteItemId: 'html.list',
              props: { className: 'mt-3 list-none space-y-1 text-sm text-slate-600' },
              children: (tier.features ?? []).map((feature) => ({
                type: 'list-item' as const,
                paletteItemId: 'html.list-item',
                props: { text: `• ${feature}` },
              })),
            },
            ...(tier.cta
              ? [actionButton(tier.cta, 'mt-4 inline-block rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white no-underline')]
              : []),
          ],
        )),
      ),
    ]),
  ];
};

export const expandedFaqAccordionTemplate = (): TemplateNodeSeed[] => {
  const items = parseRecords<{ question: string; answer: string }>(MOCK_FAQ_ITEMS_JSON);
  return [
    box('w-full space-y-2', [
      heading('Frequently Asked Questions', 'text-base font-semibold text-slate-900'),
      ...items.map((item) => box('rounded-lg border border-slate-200 bg-white', [
        heading(item.question, 'px-4 py-3 text-sm font-medium text-slate-800'),
        text(item.answer, 'border-t border-slate-100 px-4 py-3 text-sm text-slate-600'),
      ])),
    ]),
  ];
};

export const expandedBlogListTemplate = (): TemplateNodeSeed[] => {
  const posts = parseRecords<{ title: string; summary: string; date?: string }>(MOCK_BLOG_POSTS_JSON);
  return [
    box('w-full space-y-3', [
      heading('Latest Articles', 'text-lg font-semibold text-slate-900'),
      ...posts.map((post) => box('rounded-lg border border-slate-200 bg-white p-4', [
        heading(post.title, 'font-semibold text-slate-900'),
        text(post.summary, 'mt-1 text-sm text-slate-600'),
        ...(post.date ? [text(post.date, 'mt-2 text-xs text-slate-400')] : []),
      ])),
    ]),
  ];
};

export const expandedTestimonialWallTemplate = (): TemplateNodeSeed[] => {
  const quotes = parseRecords<{ name: string; role?: string; quote: string }>(MOCK_TESTIMONIALS_JSON);
  return [
    box('w-full space-y-3', [
      heading('What Our Customers Say', 'text-lg font-semibold text-slate-900'),
      ...quotes.map((item) => box('rounded-lg border border-slate-200 bg-white p-4', [
        text(item.quote, 'text-sm text-slate-700'),
        text(item.role ? `— ${item.name}, ${item.role}` : `— ${item.name}`, 'mt-2 text-xs text-slate-500'),
      ])),
    ]),
  ];
};

export const expandedTeamGridTemplate = (): TemplateNodeSeed[] => {
  const members = parseRecords<{ name: string; role: string; bio: string }>(MOCK_TEAM_MEMBERS_JSON);
  return [
    box('w-full', [
      heading('Meet The Team', 'mb-4 text-lg font-semibold text-slate-900'),
      box(
        'grid gap-4 sm:grid-cols-2 lg:grid-cols-3',
        members.map((member) => box('rounded-lg border border-slate-200 bg-white p-4', [
          heading(member.name, 'font-semibold text-slate-900'),
          text(member.role, 'text-sm text-primary'),
          text(member.bio, 'mt-2 text-sm text-slate-600'),
        ])),
      ),
    ]),
  ];
};

export const expandedCtaBannerTemplate = (): TemplateNodeSeed[] => [
  box(
    'flex w-full flex-col items-start justify-between gap-4 rounded-lg border border-primary/20 bg-primary/5 p-5 sm:flex-row sm:items-center',
    [
      box('', [
        heading('Ready to launch your next release?', 'text-base font-semibold text-slate-900'),
        text('Start building with reusable components today.', 'mt-1 text-sm text-slate-600'),
      ]),
      actionButton('Start Now', 'rounded-md bg-primary px-4 py-2 text-sm font-medium text-white no-underline'),
    ],
  ),
];

export const expandedNewsletterSignupTemplate = (): TemplateNodeSeed[] => [
  box('mx-auto w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-4 text-center', [
    heading('Stay In The Loop', 'mb-3 font-semibold text-slate-900'),
    box('flex gap-2', [
      {
        type: 'container',
        paletteItemId: 'heroui.input-text',
        props: {
          name: 'email',
          placeholder: 'you@company.com',
          inputType: 'email',
          size: 'sm',
          className: 'min-w-0 flex-1',
        },
      },
      actionButton('Subscribe', 'inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-white no-underline'),
    ]),
  ]),
];

export const expandedEmptyStateTemplate = (): TemplateNodeSeed[] => [
  box(
    'mx-auto flex w-full max-w-lg flex-col items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center',
    [
      heading('No Data Yet', 'text-base font-semibold text-slate-800'),
      text('Create your first item to populate this view.', 'max-w-md text-sm text-slate-600'),
      actionButton('Create Item', 'mt-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white no-underline'),
    ],
  ),
];
