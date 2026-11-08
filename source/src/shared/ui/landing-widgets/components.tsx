import * as React from 'react';
import {
  ArrowRight,
  Check,
  Mail,
  MapPin,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { AppButton } from '../AppButton';
import { UiCheckbox } from '../HeroFieldControls';
import { UiInput } from '../ai-field-assist/AiAssistInput';
import { UiDisclosure } from '../UiDisclosure';
import { UiTabs } from '../UiTabs';
import type {
  LandingAction,
  LandingAnnouncementProps,
  LandingCaseStudyProps,
  LandingComparisonProps,
  LandingContactProps,
  LandingFaqProps,
  LandingFeatureProps,
  LandingFeatureTabsProps,
  LandingFeaturedQuoteProps,
  LandingGalleryProps,
  LandingHeroProps,
  LandingIntegrationProps,
  LandingMarqueeProps,
  LandingMetricProps,
  LandingNewsletterProps,
  LandingPricingProps,
  LandingProcessStepsProps,
  LandingQuotesProps,
  LandingSectionProps,
  LandingTeamProps,
  LandingTimelineProps,
  LandingWidgetCommonProps,
} from './types';

const sectionClass = 'mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8';
const cardClass = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm';

function goTo(href: string): void {
  if (typeof window !== 'undefined') window.location.assign(href);
}

function Actions({ actions }: { actions?: readonly LandingAction[] }) {
  if (!actions?.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {actions.slice(0, 2).map((action) => (
        <AppButton
          key={`${action.label}-${action.href}`}
          intent={action.kind === 'secondary' ? 'secondary' : 'primary'}
          onClick={() => goTo(action.href)}
        >
          <ArrowRight aria-hidden className="h-3.5 w-3.5" />
          {action.label}
        </AppButton>
      ))}
    </div>
  );
}

function Header({
  eyebrow,
  heading,
  copy,
  inverse = false,
}: LandingSectionProps & { inverse?: boolean }) {
  return (
    <header className="max-w-3xl">
      {eyebrow ? <p className={cn('text-xs font-bold uppercase tracking-[0.18em]', inverse ? 'text-indigo-200' : 'text-indigo-700')}>{eyebrow}</p> : null}
      <h2 className={cn('mt-2 text-3xl font-bold tracking-tight sm:text-4xl', inverse ? 'text-white' : 'text-slate-950')}>{heading}</h2>
      {copy ? <p className={cn('mt-3 text-base leading-7', inverse ? 'text-slate-200' : 'text-slate-600')}>{copy}</p> : null}
    </header>
  );
}

function Section({ children, className, id, ariaLabel }: LandingWidgetCommonProps & { children: React.ReactNode }) {
  return <section id={id} aria-label={ariaLabel} className={cn(sectionClass, className)}>{children}</section>;
}

function MediaPoster({ assetRef, alt, caption }: { assetRef: string; alt: string; caption?: string }) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100" data-asset-ref={assetRef}>
      <div role="img" aria-label={alt} className="grid aspect-[16/10] place-items-center bg-gradient-to-br from-indigo-100 via-white to-cyan-100">
        <Sparkles aria-hidden className="h-10 w-10 text-indigo-500" />
      </div>
      {caption ? <figcaption className="px-4 py-3 text-sm text-slate-600">{caption}</figcaption> : null}
    </figure>
  );
}

export function LandingAnnouncement({ message, action, dismissLabel, onDismiss, className, id, ariaLabel }: LandingAnnouncementProps) {
  return (
    <aside id={id} aria-label={ariaLabel ?? 'Announcement'} className={cn('flex flex-wrap items-center justify-center gap-3 bg-indigo-950 px-4 py-2.5 text-sm text-white', className)}>
      <p>{message}</p>
      {action ? <Actions actions={[action]} /> : null}
      {dismissLabel && onDismiss ? (
        <AppButton size="icon-sm" intent="utility" aria-label={dismissLabel} onClick={onDismiss}>
          <X aria-hidden className="h-3.5 w-3.5" />
        </AppButton>
      ) : null}
    </aside>
  );
}

function Hero({ split = false, product = false, ...props }: LandingHeroProps & { split?: boolean; product?: boolean }) {
  return (
    <Section {...props}>
      <div className={cn('grid items-center gap-8', split || product ? 'lg:grid-cols-2' : 'text-center')}>
        <div className={cn('max-w-3xl', !split && !product && 'mx-auto')}>
          {props.eyebrow ? <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-700">{props.eyebrow}</p> : null}
          <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">{props.heading}</h1>
          <p className="mt-5 text-lg leading-8 text-slate-600">{props.copy}</p>
          <div className={cn('mt-6', !split && !product && '[&>div]:justify-center')}><Actions actions={props.actions} /></div>
          {props.trustCue ? <p className="mt-4 text-sm font-medium text-slate-500">{props.trustCue}</p> : null}
        </div>
        {props.media ? <MediaPoster {...props.media} /> : null}
      </div>
    </Section>
  );
}

export const LandingHeroCentered = (props: LandingHeroProps) => <Hero {...props} />;
export const LandingHeroSplit = (props: LandingHeroProps) => <Hero {...props} split />;
export const LandingHeroProductStage = (props: LandingHeroProps) => <Hero {...props} product />;

function IntegrationGrid({ integrations, ...props }: LandingIntegrationProps) {
  return (
    <Section {...props}>
      <Header {...props} />
      <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {integrations.map((item) => (
          <li key={item.name} className="grid min-h-20 place-items-center rounded-xl border border-slate-200 bg-white p-4 text-center text-sm font-bold text-slate-700" data-asset-ref={item.assetRef}>
            {item.name}
          </li>
        ))}
      </ul>
    </Section>
  );
}

export const LandingLogoCloud = IntegrationGrid;
export const LandingIntegrationGrid = IntegrationGrid;

export function LandingStatStrip({ metrics, ...props }: LandingMetricProps) {
  return (
    <Section {...props}>
      <Header {...props} />
      <dl className="mt-8 grid grid-cols-2 divide-x divide-slate-200 rounded-2xl border border-slate-200 bg-white md:grid-cols-3 lg:grid-cols-6">
        {metrics.map((metric) => <div key={metric.label} className="p-5 text-center"><dt className="text-sm text-slate-500">{metric.label}</dt><dd className="mt-1 text-2xl font-black text-slate-950">{metric.value}</dd></div>)}
      </dl>
    </Section>
  );
}

function Features({ features, bento = false, ...props }: LandingFeatureProps & { bento?: boolean }) {
  return (
    <Section {...props}>
      <Header {...props} />
      <ul className={cn('mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3', bento && 'lg:grid-cols-4')}>
        {features.map((feature, index) => {
          const Icon = feature.icon ?? Sparkles;
          return <li key={feature.title} className={cn(cardClass, bento && index === 0 && 'lg:col-span-2 lg:row-span-2')}><Icon aria-hidden className="h-5 w-5 text-indigo-600" /><h3 className="mt-4 text-lg font-bold text-slate-900">{feature.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{feature.description}</p></li>;
        })}
      </ul>
      <div className="mt-6"><Actions actions={props.actions} /></div>
    </Section>
  );
}

export const LandingFeatureGrid = (props: LandingFeatureProps) => <Features {...props} />;
export const LandingBentoFeatures = (props: LandingFeatureProps) => <Features {...props} bento />;

export function LandingFeatureTabs({ features, ...props }: LandingFeatureTabsProps) {
  return (
    <Section {...props}>
      <Header {...props} />
      <UiTabs
        className="mt-8"
        ariaLabel={`${props.heading} features`}
        items={features.map((feature) => ({
          id: feature.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          label: feature.title,
          content: <article className={cardClass}><h3 className="text-xl font-bold text-slate-900">{feature.title}</h3><p className="mt-2 leading-7 text-slate-600">{feature.description}</p></article>,
        }))}
      />
    </Section>
  );
}

export function LandingProcessSteps({ steps, ...props }: LandingProcessStepsProps) {
  return (
    <Section {...props}><Header {...props} /><ol className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">{steps.map((step, index) => <li key={step.title} className={cardClass}><span className="text-sm font-black text-indigo-600">{String(index + 1).padStart(2, '0')}</span><h3 className="mt-3 font-bold text-slate-900">{step.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p></li>)}</ol></Section>
  );
}

export function LandingComparison({ offerings, rows, ...props }: LandingComparisonProps) {
  return (
    <Section {...props}><Header {...props} /><div className="mt-8 overflow-x-auto rounded-2xl border border-slate-200"><table className="w-full min-w-[40rem] border-collapse bg-white text-start text-sm"><caption className="sr-only">{props.heading}</caption><thead><tr><th className="p-4 text-start">Feature</th>{offerings.map((name) => <th key={name} className="p-4 text-start">{name}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.feature} className="border-t border-slate-200"><th scope="row" className="p-4 text-start font-semibold">{row.feature}</th>{row.values.map((value, index) => <td key={`${row.feature}-${offerings[index]}`} className="p-4 text-slate-600">{value}</td>)}</tr>)}</tbody></table></div></Section>
  );
}

export function LandingPricing({ plans, ...props }: LandingPricingProps) {
  return (
    <Section {...props}><Header {...props} /><div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">{plans.map((plan) => <article key={plan.name} className={cardClass}><h3 className="font-bold text-slate-900">{plan.name}</h3><p className="mt-3 text-3xl font-black text-slate-950">{plan.price}</p><p className="mt-2 text-sm text-slate-600">{plan.description}</p><ul className="my-5 space-y-2">{plan.features.map((feature) => <li key={feature} className="flex gap-2 text-sm text-slate-700"><Check aria-hidden className="h-4 w-4 text-emerald-600" />{feature}</li>)}</ul><Actions actions={plan.action ? [plan.action] : undefined} /></article>)}</div></Section>
  );
}

export function LandingTestimonialGrid({ quotes, ...props }: LandingQuotesProps) {
  return <Section {...props}><Header {...props} /><div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{quotes.map((quote) => <blockquote key={`${quote.name}-${quote.quote}`} className={cardClass}><p className="text-lg leading-8 text-slate-800">“{quote.quote}”</p><footer className="mt-4 text-sm font-bold text-slate-900">{quote.name}{quote.role ? <span className="block font-normal text-slate-500">{quote.role}</span> : null}</footer></blockquote>)}</div></Section>;
}

export function LandingFeaturedQuote({ quote, name, role, portrait, ...props }: LandingFeaturedQuoteProps) {
  return <Section {...props}><blockquote className="mx-auto max-w-4xl text-center"><p className="text-3xl font-bold leading-tight text-slate-950 sm:text-4xl">“{quote}”</p><footer className="mt-6 text-sm font-bold text-slate-900">{name}{role ? <span className="ms-2 font-normal text-slate-500">{role}</span> : null}</footer>{portrait ? <div className="mx-auto mt-5 max-w-xs"><MediaPoster {...portrait} /></div> : null}</blockquote></Section>;
}

export function LandingCaseStudy({ metrics, media, ...props }: LandingCaseStudyProps) {
  return <Section {...props}><div className="grid gap-8 lg:grid-cols-2"><div><Header {...props} /><dl className="mt-6 grid grid-cols-2 gap-3">{metrics.map((metric) => <div key={metric.label} className={cardClass}><dt className="text-sm text-slate-500">{metric.label}</dt><dd className="mt-1 text-2xl font-black">{metric.value}</dd></div>)}</dl></div>{media ? <MediaPoster {...media} /> : null}</div></Section>;
}

export function LandingMediaGallery({ media, ...props }: LandingGalleryProps) {
  return <Section {...props}><Header {...props} /><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{media.map((item) => <MediaPoster key={item.assetRef} {...item} />)}</div></Section>;
}

export function LandingMarquee({ items, className, id, ariaLabel }: LandingMarqueeProps) {
  return <section id={id} aria-label={ariaLabel} className={cn(sectionClass, className)}><ul className="flex flex-wrap justify-center gap-x-8 gap-y-3" data-reduced-motion-fallback="wrapped-static-list">{items.map((item) => <li key={item} className="text-sm font-bold uppercase tracking-widest text-slate-500">{item}</li>)}</ul></section>;
}

export function LandingNewsletter({ actionId, consentLabel, onSubmit, ...props }: LandingNewsletterProps) {
  const [email, setEmail] = React.useState('');
  const [consent, setConsent] = React.useState(false);
  return (
    <Section {...props}><div className="rounded-3xl bg-indigo-950 p-6 text-white sm:p-10"><Header {...props} inverse /><form className="mt-6 max-w-xl" data-form-action-id={actionId} onSubmit={(event) => { event.preventDefault(); if (consent) onSubmit?.(email); }}><div className="flex flex-col gap-2 sm:flex-row"><UiInput type="email" inputMode="email" autoComplete="email" ariaLabel="Email address" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} className="flex-1" /><AppButton type="submit" intent="primary" disabled={!consent || !email}><Send aria-hidden className="h-3.5 w-3.5" />Subscribe</AppButton></div><UiCheckbox className="mt-3" checked={consent} onChange={(event) => setConsent(event.target.checked)}>{consentLabel}</UiCheckbox></form></div></Section>
  );
}

export function LandingCtaBand(props: LandingSectionProps) {
  return <Section {...props}><div className="flex flex-col justify-between gap-6 rounded-3xl bg-slate-950 p-7 text-white md:flex-row md:items-center"><Header {...props} inverse /><Actions actions={props.actions} /></div></Section>;
}

export function LandingFaq({ items, ...props }: LandingFaqProps) {
  return <Section {...props}><Header {...props} /><div className="mt-8 space-y-3">{items.map((item) => <UiDisclosure key={item.question} trigger={item.question}><p>{item.answer}</p></UiDisclosure>)}</div></Section>;
}

export function LandingTeam({ people, ...props }: LandingTeamProps) {
  return <Section {...props}><Header {...props} /><ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{people.map((person) => <li key={person.name} className={cardClass}>{person.portrait ? <MediaPoster {...person.portrait} /> : null}<h3 className="mt-4 font-bold text-slate-900">{person.name}</h3><p className="text-sm text-slate-500">{person.role}</p></li>)}</ul></Section>;
}

export function LandingTimeline({ milestones, ...props }: LandingTimelineProps) {
  return <Section {...props}><Header {...props} /><ol className="mt-8 border-s-2 border-indigo-200 ps-6">{milestones.map((milestone) => <li key={`${milestone.date}-${milestone.title}`} className="relative pb-8 last:pb-0"><span className="absolute -start-[1.94rem] top-1.5 h-3 w-3 rounded-full bg-indigo-600" /><time className="text-xs font-bold uppercase tracking-wider text-indigo-700">{milestone.date}</time><h3 className="mt-1 font-bold text-slate-900">{milestone.title}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{milestone.description}</p></li>)}</ol></Section>;
}

export function LandingContact({ routes, actionId, ...props }: LandingContactProps) {
  return <Section {...props}><Header {...props} /><address className="mt-8 grid gap-4 not-italic sm:grid-cols-2">{routes.map((route) => <article key={route.label} className={cardClass}>{route.href?.startsWith('mailto:') ? <Mail aria-hidden className="h-5 w-5 text-indigo-600" /> : <MapPin aria-hidden className="h-5 w-5 text-indigo-600" />}<h3 className="mt-3 font-bold text-slate-900">{route.label}</h3>{route.href ? <a className="mt-1 inline-block text-sm text-indigo-700 underline-offset-4 hover:underline" href={route.href}>{route.value}</a> : <p className="mt-1 text-sm text-slate-600">{route.value}</p>}</article>)}</address>{actionId ? <div className="mt-5" data-form-action-id={actionId}><AppButton intent="primary"><Mail aria-hidden className="h-3.5 w-3.5" />Send a message</AppButton></div> : null}</Section>;
}
