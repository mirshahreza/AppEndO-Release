/** CD-P28–P30 — JSON fixtures for marketing / feedback universal widgets. */

export const MOCK_FAQ_ITEMS_JSON = JSON.stringify([
  { id: 'q1', question: 'How do I get started?', answer: 'Create a component and drag widgets from the palette.' },
  { id: 'q2', question: 'Can I bind data from an API?', answer: 'Yes — use binding definitions on supported widgets.' },
]);

export const MOCK_TESTIMONIALS_JSON = JSON.stringify([
  { id: 't1', name: 'Alex Chen', role: 'Product Lead', quote: 'We shipped our admin portal in days, not months.', avatar: '' },
  { id: 't2', name: 'Sam Rivera', role: 'CTO', quote: 'Preview parity with production export is excellent.', avatar: '' },
]);

export const MOCK_PRICING_TIERS_JSON = JSON.stringify([
  { id: 'starter', name: 'Starter', price: '$19', period: '/mo', features: ['5 users', 'Email support'], cta: 'Start trial', featured: false },
  { id: 'pro', name: 'Pro', price: '$49', period: '/mo', features: ['25 users', 'Priority support', 'API access'], cta: 'Choose Pro', featured: true },
  { id: 'enterprise', name: 'Enterprise', price: 'Custom', period: '', features: ['Unlimited users', 'Dedicated support', 'SLA'], cta: 'Contact sales', featured: false },
]);

export const MOCK_DESCRIPTION_LIST_JSON = JSON.stringify([
  { term: 'Status', detail: 'Active' },
  { term: 'Owner', detail: 'Operations team' },
  { term: 'Last updated', detail: '2026-07-01' },
]);

export const MOCK_FEATURE_GRID_JSON = JSON.stringify([
  { id: 'f1', title: 'Fast setup', description: 'Start from presets or blank canvas.' },
  { id: 'f2', title: 'Live preview', description: 'See changes instantly before publish.' },
  { id: 'f3', title: 'Export ready', description: 'Generate production TSX in one click.' },
]);

export const MOCK_BLOG_POSTS_JSON = JSON.stringify([
  { id: 'b1', title: 'Introducing App Builder', summary: 'Design application UI visually.', date: '2026-06-01' },
  { id: 'b2', title: 'Binding best practices', summary: 'Connect widgets to APIs safely.', date: '2026-06-15' },
]);

export const MOCK_TEAM_MEMBERS_JSON = JSON.stringify([
  { id: 'm1', name: 'Jordan Lee', role: 'Designer', bio: 'UX and component systems.' },
  { id: 'm2', name: 'Taylor Kim', role: 'Engineer', bio: 'Runtime and codegen.' },
]);
