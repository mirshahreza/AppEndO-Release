import type { LandingWidgetConfig, LandingWidgetId, LandingWidgetPropsMap } from './types';

const actions = [{ label: 'Explore the platform', href: '/platform', kind: 'primary' }] as const;
const features = [
  { title: 'Clear ownership', description: 'Give every release an accountable owner.' },
  { title: 'Visible progress', description: 'Follow work from first draft to launch.' },
  { title: 'Composable tools', description: 'Connect focused tools without hidden coupling.' },
] as const;
const metrics = [
  { value: '42%', label: 'Faster delivery' },
  { value: '3.1×', label: 'More reuse' },
] as const;
const media = { assetRef: 'asset:fixtures/product-stage.svg', alt: 'AppEndO product workspace preview', caption: 'A deterministic local product poster.' } as const;

function fixture<I extends LandingWidgetId>(id: I, props: LandingWidgetPropsMap[I]): LandingWidgetConfig<I> {
  return Object.freeze({ id, props: Object.freeze(props) }) as LandingWidgetConfig<I>;
}

export const LANDING_WIDGET_FIXTURES = Object.freeze({
  'landing-announcement': fixture('landing-announcement', { message: 'The summer release is now available.', action: { label: 'Read release notes', href: '/releases' } }),
  'landing-hero-centered': fixture('landing-hero-centered', { eyebrow: 'AppEndO Studio', heading: 'Build operational software with confidence.', copy: 'Compose governed experiences from trusted platform primitives.', actions, media }),
  'landing-hero-split': fixture('landing-hero-split', { eyebrow: 'One workspace', heading: 'Move from intent to a working product.', copy: 'Keep design, data, and delivery in one accountable flow.', actions, media }),
  'landing-hero-product-stage': fixture('landing-hero-product-stage', { eyebrow: 'Production ready', heading: 'See the whole system before launch.', copy: 'Review a faithful product stage backed by local assets.', actions, media, trustCue: 'Deterministic preview. No remote dependencies.' }),
  'landing-logo-cloud': fixture('landing-logo-cloud', { heading: 'Trusted by focused teams', integrations: [{ name: 'Northstar' }, { name: 'Keystone' }, { name: 'Juniper' }] }),
  'landing-stat-strip': fixture('landing-stat-strip', { heading: 'Measured outcomes', metrics }),
  'landing-feature-grid': fixture('landing-feature-grid', { eyebrow: 'Capabilities', heading: 'Everything needed for controlled delivery', features }),
  'landing-bento-features': fixture('landing-bento-features', { eyebrow: 'System view', heading: 'A workspace shaped around real work', features }),
  'landing-feature-tabs': fixture('landing-feature-tabs', { eyebrow: 'Explore', heading: 'Move through each capability', features }),
  'landing-process-steps': fixture('landing-process-steps', { eyebrow: 'Process', heading: 'From decision to delivery', steps: features.slice(0, 2) }),
  'landing-comparison': fixture('landing-comparison', { heading: 'Choose the right operating model', offerings: ['Essentials', 'Studio'], rows: [{ feature: 'Governed components', values: ['Included', 'Included'] }, { feature: 'Advanced authoring', values: ['—', 'Included'] }] }),
  'landing-pricing': fixture('landing-pricing', { heading: 'Plans that grow with the work', plans: [{ name: 'Studio', price: '$49', description: 'For product teams shipping governed experiences.', features: ['Trusted components', 'Local assets'], action: { label: 'Choose Studio', href: '/plans/studio' } }] }),
  'landing-testimonial-grid': fixture('landing-testimonial-grid', { heading: 'What teams changed', quotes: [{ quote: 'We can now explain every design decision.', name: 'Riley Chen', role: 'Product lead' }] }),
  'landing-featured-quote': fixture('landing-featured-quote', { quote: 'The platform gives our teams a shared language for delivery.', name: 'Morgan Lee', role: 'Operations director' }),
  'landing-case-study': fixture('landing-case-study', { eyebrow: 'Case study', heading: 'Northstar cut release review time', copy: 'A shared component system removed duplicate approval work.', metrics, media }),
  'landing-integration-grid': fixture('landing-integration-grid', { heading: 'Works with your operating stack', integrations: [{ name: 'Identity' }, { name: 'Analytics' }, { name: 'Messaging' }] }),
  'landing-media-gallery': fixture('landing-media-gallery', { heading: 'Product views', media: [media, { ...media, assetRef: 'asset:fixtures/workflow.svg', alt: 'Workflow canvas preview' }] }),
  'landing-marquee': fixture('landing-marquee', { ariaLabel: 'Platform capabilities', items: ['Governance', 'Design systems', 'Workflows', 'Data'] }),
  'landing-newsletter': fixture('landing-newsletter', { heading: 'Useful release notes, once a month', copy: 'Get practical guidance for governed product delivery.', actionId: 'newsletter-signup', consentLabel: 'I agree to receive product email.' }),
  'landing-cta-band': fixture('landing-cta-band', { heading: 'Turn the next decision into a working release.', actions }),
  'landing-faq': fixture('landing-faq', { heading: 'Common questions', items: [{ question: 'Can assets be hosted remotely?', answer: 'No. Landing widgets accept registered local asset references only.' }, { question: 'Can widgets run custom scripts?', answer: 'No. Widgets render trusted, typed compositions only.' }] }),
  'landing-team': fixture('landing-team', { heading: 'Meet the product team', people: [{ name: 'Avery Stone', role: 'Design systems' }, { name: 'Sam Rivera', role: 'Platform engineering' }] }),
  'landing-timeline': fixture('landing-timeline', { heading: 'Release path', milestones: [{ date: 'Week 1', title: 'Shape', description: 'Agree on the outcome and constraints.' }, { date: 'Week 2', title: 'Deliver', description: 'Build, verify, and publish the governed release.' }] }),
  'landing-contact': fixture('landing-contact', { heading: 'Talk with the team', copy: 'Choose the route that matches your question.', routes: [{ label: 'Product questions', value: 'product@example.com', href: 'mailto:product@example.com' }, { label: 'Office', value: 'Platform district' }], actionId: 'contact-request' }),
}) satisfies Readonly<{ [I in LandingWidgetId]: LandingWidgetConfig<I> }>;
