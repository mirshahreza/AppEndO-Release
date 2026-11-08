import * as React from 'react';
import type { NewLayoutPresetId } from './types';

type MiniBlockProps = {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
};

const block = 'rounded-sm border border-slate-300/80 bg-white/90';
const fill = 'rounded-sm bg-slate-300/70';
const accent = 'rounded-sm border border-cyan-400/70 bg-cyan-100/80';
const media = 'rounded-sm border border-slate-300/70 bg-slate-200/80';
const pill = 'rounded-full bg-slate-300/80';

const MiniBar: React.FC<MiniBlockProps & { width?: string }> = ({ className = '', width = '100%' }) => (
  <div className={`h-[3px] ${fill} ${className}`} style={{ width }} />
);

const MiniBox: React.FC<MiniBlockProps> = ({ className = '', style, children }) => (
  <div className={`${block} ${className}`} style={style}>{children}</div>
);

const MiniBtn: React.FC<MiniBlockProps & { accent?: boolean }> = ({ className = '', accent: isAccent }) => (
  <div className={`h-[5px] w-[14px] ${isAccent ? accent : block} ${className}`} />
);

const MiniDot: React.FC = () => <div className="h-[3px] w-[3px] shrink-0 rounded-full bg-cyan-500/80" />;

const PreviewFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="relative mt-1 h-9 overflow-hidden rounded border border-slate-200 bg-slate-50/80 p-[3px]">
    <div className="relative flex h-full flex-col gap-[2px]">{children}</div>
  </div>
);

const PRESET_MINI_PREVIEW_RENDERERS: Record<NewLayoutPresetId, () => React.ReactNode> = {
  blank: () => (
    <PreviewFrame>
      <div className="flex h-full items-center justify-center rounded-sm border border-dashed border-slate-300/90 bg-white/60" />
    </PreviewFrame>
  ),
  'hero-cta': () => (
    <PreviewFrame>
      <div className="flex h-full flex-col gap-[2px] rounded-sm bg-gradient-to-r from-cyan-500/35 to-blue-500/35 p-[3px]">
        <MiniBar width="72%" className="bg-white/80" />
        <MiniBar width="55%" className="bg-white/70" />
        <div className="mt-auto flex gap-[2px]">
          <MiniBtn accent />
          <MiniBtn />
        </div>
      </div>
    </PreviewFrame>
  ),
  'feature-grid': () => (
    <PreviewFrame>
      <MiniBar width="48%" />
      <div className="grid flex-1 grid-cols-3 gap-[2px]">
        {Array.from({ length: 3 }).map((_, i) => (
          <MiniBox key={i} className="flex flex-col gap-[1px] p-[2px]">
            <MiniBar width="80%" />
            <MiniBar width="60%" />
          </MiniBox>
        ))}
      </div>
    </PreviewFrame>
  ),
  'split-media': () => (
    <PreviewFrame>
      <div className="grid h-full grid-cols-2 gap-[2px]">
        <MiniBox className="flex flex-col gap-[2px] p-[2px]">
          <MiniBar width="85%" />
          <MiniBar width="70%" />
          <MiniBtn accent className="mt-auto" />
        </MiniBox>
        <div className={`${media} h-full`} />
      </div>
    </PreviewFrame>
  ),
  'dashboard-kpi': () => (
    <PreviewFrame>
      <MiniBar width="52%" />
      <div className="grid flex-1 grid-cols-4 gap-[2px]">
        {Array.from({ length: 4 }).map((_, i) => (
          <MiniBox key={i} className="flex flex-col justify-center gap-[1px] p-[2px]">
            <MiniBar width="55%" />
            <MiniBar width="75%" className="h-[4px]" />
          </MiniBox>
        ))}
      </div>
    </PreviewFrame>
  ),
  'dashboard-viz-kit': () => (
    <PreviewFrame>
      <MiniBar width="55%" />
      <div className={`${media} h-6`} />
      <div className="grid flex-1 grid-cols-3 gap-[2px]">
        {Array.from({ length: 3 }).map((_, i) => (
          <MiniBox key={i} className="p-[2px]"><MiniBar width="70%" /></MiniBox>
        ))}
      </div>
    </PreviewFrame>
  ),
  'pricing-cards': () => (
    <PreviewFrame>
      <MiniBar width="42%" />
      <div className="grid flex-1 grid-cols-3 gap-[2px]">
        <MiniBox className="p-[2px]"><MiniBar width="70%" /><MiniBar width="50%" className="mt-[2px]" /><MiniBtn accent className="mt-auto" /></MiniBox>
        <MiniBox className={`${accent} p-[2px]`}><MiniBar width="70%" /><MiniBar width="50%" className="mt-[2px]" /><MiniBtn accent className="mt-auto" /></MiniBox>
        <MiniBox className="p-[2px]"><MiniBar width="70%" /><MiniBar width="50%" className="mt-[2px]" /><MiniBtn className="mt-auto" /></MiniBox>
      </div>
    </PreviewFrame>
  ),
  'faq-accordion': () => (
    <PreviewFrame>
      <MiniBar width="58%" />
      <div className="flex flex-1 flex-col gap-[2px]">
        {Array.from({ length: 3 }).map((_, i) => (
          <MiniBox key={i} className="flex flex-col gap-[1px] p-[2px]">
            <MiniBar width="68%" />
            <MiniBar width="88%" className="h-[2px]" />
          </MiniBox>
        ))}
      </div>
    </PreviewFrame>
  ),
  'contact-form': () => (
    <PreviewFrame>
      <MiniBar width="40%" />
      <div className="grid grid-cols-2 gap-[2px]">
        <MiniBox className="h-[5px]" />
        <MiniBox className="h-[5px]" />
      </div>
      <MiniBox className="h-[5px]" />
      <MiniBox className="flex-1" />
      <MiniBtn accent />
    </PreviewFrame>
  ),
  timeline: () => (
    <PreviewFrame>
      <MiniBar width="46%" />
      <div className="flex flex-1 flex-col gap-[3px]">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-start gap-[2px]">
            <MiniDot />
            <div className="flex flex-1 flex-col gap-[1px]">
              <MiniBar width="42%" />
              <MiniBar width="78%" className="h-[2px]" />
            </div>
          </div>
        ))}
      </div>
    </PreviewFrame>
  ),
  'blog-list': () => (
    <PreviewFrame>
      <MiniBar width="44%" />
      <div className="flex flex-1 flex-col gap-[2px]">
        {Array.from({ length: 3 }).map((_, i) => (
          <MiniBox key={i} className="flex flex-col gap-[1px] p-[2px]">
            <MiniBar width="62%" />
            <MiniBar width="90%" className="h-[2px]" />
          </MiniBox>
        ))}
      </div>
    </PreviewFrame>
  ),
  'testimonial-wall': () => (
    <PreviewFrame>
      <div className="grid h-full grid-cols-3 gap-[2px]">
        {Array.from({ length: 3 }).map((_, i) => (
          <MiniBox key={i} className="flex flex-col justify-between p-[2px]">
            <MiniBar width="92%" />
            <MiniBar width="92%" className="h-[2px]" />
            <MiniBar width="45%" className="mt-[2px] h-[2px]" />
          </MiniBox>
        ))}
      </div>
    </PreviewFrame>
  ),
  'stats-strip': () => (
    <PreviewFrame>
      <div className="grid h-full grid-cols-6 gap-[2px]">
        {Array.from({ length: 6 }).map((_, i) => (
          <MiniBox key={i} className="flex flex-col items-center justify-center gap-[1px] p-[1px]">
            <MiniBar width="70%" className="h-[2px]" />
            <MiniBar width="55%" className="h-[3px]" />
          </MiniBox>
        ))}
      </div>
    </PreviewFrame>
  ),
  'team-grid': () => (
    <PreviewFrame>
      <MiniBar width="40%" />
      <div className="grid flex-1 grid-cols-3 gap-[2px]">
        {Array.from({ length: 3 }).map((_, i) => (
          <MiniBox key={i} className="flex flex-col gap-[1px] p-[2px]">
            <div className={`h-[5px] w-[5px] ${pill}`} />
            <MiniBar width="72%" />
            <MiniBar width="48%" className="h-[2px]" />
          </MiniBox>
        ))}
      </div>
    </PreviewFrame>
  ),
  'sidebar-layout': () => (
    <PreviewFrame>
      <div className="grid h-full grid-cols-[28%,1fr] gap-[2px]">
        <MiniBox className="flex flex-col gap-[2px] p-[2px]">
          <MiniBar width="70%" />
          <MiniBar width="85%" className="h-[2px]" />
          <MiniBar width="75%" className="h-[2px]" />
          <MiniBar width="65%" className="h-[2px]" />
        </MiniBox>
        <MiniBox className="flex flex-col gap-[2px] p-[2px]">
          <MiniBar width="50%" />
          <MiniBar width="88%" className="h-[2px]" />
          <MiniBar width="76%" className="h-[2px]" />
        </MiniBox>
      </div>
    </PreviewFrame>
  ),
  'app-shell': () => (
    <PreviewFrame>
      <div className="grid h-full grid-cols-[28%,1fr] gap-[1px]">
        <MiniBox className="flex flex-col gap-[2px] p-[2px]">
          <MiniBar width="70%" />
          <MiniBar width="55%" className="h-[2px]" />
          <div className="mt-auto flex flex-col gap-[1px]">
            <MiniBar width="80%" className="h-[2px]" />
            <MiniBar width="65%" className="h-[2px]" />
          </div>
        </MiniBox>
        <div className="flex min-h-0 flex-col gap-[1px]">
          <MiniBox className="h-[5px] px-[2px]"><MiniBar width="35%" className="h-[3px]" /></MiniBox>
          <MiniBox className="flex flex-1 flex-col gap-[2px] rounded-tl-sm border-t border-s border-e border-slate-300/90 p-[2px]">
            <MiniBar width="42%" />
            <MiniBar width="78%" className="h-[2px]" />
          </MiniBox>
        </div>
      </div>
    </PreviewFrame>
  ),
  'site-shell': () => (
    <PreviewFrame>
      <div className="flex h-full flex-col gap-[1px]">
        <MiniBox className="h-[4px] px-[2px]"><MiniBar width="45%" className="h-[3px]" /></MiniBox>
        <MiniBox className="flex flex-1 flex-col gap-[2px] p-[2px]">
          <MiniBar width="55%" />
          <MiniBar width="90%" className="h-[2px]" />
          <MiniBar width="72%" className="h-[2px]" />
        </MiniBox>
        <MiniBox className="h-[3px] px-[2px]"><MiniBar width="30%" className="h-[2px]" /></MiniBox>
      </div>
    </PreviewFrame>
  ),
  'gallery-grid': () => (
    <PreviewFrame>
      <div className="grid h-full grid-cols-4 grid-rows-2 gap-[2px]">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className={`${media} min-h-0`} />
        ))}
      </div>
    </PreviewFrame>
  ),
  changelog: () => (
    <PreviewFrame>
      <MiniBar width="36%" />
      <div className="flex flex-1 flex-col gap-[2px]">
        {Array.from({ length: 3 }).map((_, i) => (
          <MiniBar key={i} width={`${78 - i * 6}%`} />
        ))}
      </div>
    </PreviewFrame>
  ),
  'cta-banner': () => (
    <PreviewFrame>
      <div className={`${accent} flex h-full items-center justify-between gap-[2px] px-[3px]`}>
        <MiniBar width="58%" />
        <MiniBtn accent />
      </div>
    </PreviewFrame>
  ),
  'bento-hero': () => (
    <PreviewFrame>
      <MiniBar width="44%" />
      <div className="grid flex-1 grid-cols-3 grid-rows-2 gap-[2px]">
        <MiniBox className="col-span-2 row-span-2 p-[2px]"><MiniBar width="60%" /><MiniBar width="80%" className="mt-[2px] h-[2px]" /></MiniBox>
        <div className={`${media} min-h-0`} />
        <MiniBox className="p-[1px]"><MiniBar width="70%" /></MiniBox>
      </div>
    </PreviewFrame>
  ),
  'comparison-table': () => (
    <PreviewFrame>
      <MiniBar width="42%" />
      <div className="flex flex-1 flex-col gap-[2px]">
        <div className="grid grid-cols-4 gap-[2px]">
          {Array.from({ length: 4 }).map((_, i) => (
            <MiniBox key={i} className="h-[4px] bg-slate-200/90" />
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, row) => (
          <div key={row} className="grid grid-cols-4 gap-[2px]">
            {Array.from({ length: 4 }).map((_, col) => (
              <MiniBar key={col} width="100%" className="h-[3px]" />
            ))}
          </div>
        ))}
      </div>
    </PreviewFrame>
  ),
  'roadmap-board': () => (
    <PreviewFrame>
      <MiniBar width="38%" />
      <div className="grid flex-1 grid-cols-3 gap-[2px]">
        {Array.from({ length: 3 }).map((_, i) => (
          <MiniBox key={i} className="flex flex-col gap-[2px] p-[2px]">
            <MiniBar width="60%" />
            <MiniBox className="h-[4px]" />
            <MiniBox className="h-[4px]" />
          </MiniBox>
        ))}
      </div>
    </PreviewFrame>
  ),
  'newsletter-signup': () => (
    <PreviewFrame>
      <div className="flex h-full flex-col items-center justify-center gap-[2px] rounded-sm border border-slate-200 bg-white p-[3px]">
        <MiniBar width="52%" />
        <MiniBar width="72%" className="h-[2px]" />
        <div className="flex w-full gap-[2px]">
          <MiniBox className="h-[5px] flex-1" />
          <MiniBtn accent />
        </div>
      </div>
    </PreviewFrame>
  ),
  'support-center': () => (
    <PreviewFrame>
      <MiniBox className="h-[5px]" />
      <div className="grid flex-1 grid-cols-2 gap-[2px]">
        {Array.from({ length: 4 }).map((_, i) => (
          <MiniBox key={i} className="p-[2px]"><MiniBar width="70%" /><MiniBar width="90%" className="mt-[1px] h-[2px]" /></MiniBox>
        ))}
      </div>
    </PreviewFrame>
  ),
  'event-agenda': () => (
    <PreviewFrame>
      <MiniBar width="40%" />
      <div className="flex flex-1 flex-col gap-[2px]">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="grid grid-cols-[22%,1fr] gap-[2px]">
            <MiniBar width="100%" className="h-[3px]" />
            <MiniBox className="p-[1px]"><MiniBar width="75%" /></MiniBox>
          </div>
        ))}
      </div>
    </PreviewFrame>
  ),
  'empty-state': () => (
    <PreviewFrame>
      <div className="flex h-full flex-col items-center justify-center gap-[2px]">
        <div className="h-[8px] w-[8px] rounded-full border border-dashed border-slate-300 bg-white" />
        <MiniBar width="48%" />
        <MiniBar width="62%" className="h-[2px]" />
        <MiniBtn accent className="mt-[1px]" />
      </div>
    </PreviewFrame>
  ),
  'product-showcase': () => (
    <PreviewFrame>
      <div className="grid h-full grid-cols-2 gap-[2px]">
        <div className={`${media} h-full`} />
        <MiniBox className="flex flex-col gap-[2px] p-[2px]">
          <MiniBar width="72%" />
          <MiniBar width="88%" className="h-[2px]" />
          <MiniBar width="76%" className="h-[2px]" />
          <MiniBtn accent className="mt-auto" />
        </MiniBox>
      </div>
    </PreviewFrame>
  ),
  'analytics-detail': () => (
    <PreviewFrame>
      <MiniBar width="46%" />
      <MiniBox className="flex-1 p-[2px]">
        <div className={`h-full min-h-[10px] ${media}`} />
      </MiniBox>
      <div className="grid grid-cols-3 gap-[2px]">
        {Array.from({ length: 3 }).map((_, i) => (
          <MiniBox key={i} className="h-[4px]" />
        ))}
      </div>
    </PreviewFrame>
  ),
  'command-center': () => (
    <PreviewFrame>
      <MiniBox className="h-[4px]" />
      <div className="grid flex-1 grid-cols-2 gap-[2px]">
        {Array.from({ length: 4 }).map((_, i) => (
          <MiniBox key={i} className="p-[2px]"><MiniBar width="55%" /><MiniBox className="mt-[1px] h-[5px]" /></MiniBox>
        ))}
      </div>
    </PreviewFrame>
  ),
  'feature-tabs': () => (
    <PreviewFrame>
      <div className="flex gap-[2px]">
        <MiniBtn accent />
        <MiniBtn />
        <MiniBtn />
      </div>
      <MiniBox className="flex flex-1 flex-col gap-[2px] p-[2px]">
        <MiniBar width="58%" />
        <MiniBar width="82%" className="h-[2px]" />
        <MiniBar width="70%" className="h-[2px]" />
      </MiniBox>
    </PreviewFrame>
  ),
  'case-study': () => (
    <PreviewFrame>
      <MiniBar width="62%" className="h-[4px]" />
      <MiniBar width="88%" className="h-[2px]" />
      <div className="grid flex-1 grid-cols-2 gap-[2px]">
        <MiniBox className="p-[2px]"><MiniBar width="70%" /><MiniBar width="90%" className="mt-[1px] h-[2px]" /></MiniBox>
        <MiniBox className="p-[2px]"><MiniBar width="55%" className="h-[4px]" /><MiniBar width="40%" className="mt-[1px] h-[2px]" /></MiniBox>
      </div>
    </PreviewFrame>
  ),
  'onboarding-steps': () => (
    <PreviewFrame>
      <div className="flex items-center gap-[2px]">
        {Array.from({ length: 3 }).map((_, i) => (
          <React.Fragment key={i}>
            <div className={`h-[5px] w-[5px] rounded-full ${i === 0 ? 'bg-cyan-500/70' : 'border border-slate-300 bg-white'}`} />
            {i < 2 ? <div className="h-px flex-1 bg-slate-300/80" /> : null}
          </React.Fragment>
        ))}
      </div>
      <MiniBox className="flex flex-1 flex-col gap-[2px] p-[2px]">
        <MiniBar width="50%" />
        <MiniBar width="82%" className="h-[2px]" />
        <MiniBtn accent className="mt-auto" />
      </MiniBox>
    </PreviewFrame>
  ),
  'kanban-board': () => (
    <PreviewFrame>
      <div className="grid h-full grid-cols-3 gap-[2px]">
        {Array.from({ length: 3 }).map((_, col) => (
          <MiniBox key={col} className="flex flex-col gap-[2px] p-[2px]">
            <MiniBar width="55%" />
            <MiniBox className="h-[4px]" />
            <MiniBox className="h-[4px]" />
          </MiniBox>
        ))}
      </div>
    </PreviewFrame>
  ),
  'release-notes-grid': () => (
    <PreviewFrame>
      <MiniBar width="44%" />
      <div className="grid flex-1 grid-cols-2 gap-[2px]">
        {Array.from({ length: 4 }).map((_, i) => (
          <MiniBox key={i} className="p-[2px]"><MiniBar width="65%" /><MiniBar width="88%" className="mt-[1px] h-[2px]" /></MiniBox>
        ))}
      </div>
    </PreviewFrame>
  ),
  'social-proof-strip': () => (
    <PreviewFrame>
      <div className="grid grid-cols-5 gap-[2px]">
        {Array.from({ length: 5 }).map((_, i) => (
          <MiniBox key={i} className="h-[4px]" />
        ))}
      </div>
      <MiniBox className="flex flex-1 flex-col justify-center gap-[1px] p-[2px]">
        <MiniBar width="78%" />
        <MiniBar width="42%" className="h-[2px]" />
      </MiniBox>
    </PreviewFrame>
  ),
  'integrations-grid': () => (
    <PreviewFrame>
      <MiniBar width="40%" />
      <div className="grid flex-1 grid-cols-4 gap-[2px]">
        {Array.from({ length: 8 }).map((_, i) => (
          <MiniBox key={i} className="aspect-square min-h-0 p-[1px]"><div className={`h-full w-full ${pill}`} /></MiniBox>
        ))}
      </div>
    </PreviewFrame>
  ),
  'settings-form': () => (
    <PreviewFrame>
      <MiniBar width="38%" />
      <div className="flex flex-1 flex-col gap-[2px]">
        {Array.from({ length: 2 }).map((_, i) => (
          <MiniBox key={i} className="flex flex-col gap-[2px] p-[2px]">
            <MiniBar width="42%" />
            <MiniBox className="h-[4px]" />
            <MiniBox className="h-[4px]" />
          </MiniBox>
        ))}
      </div>
    </PreviewFrame>
  ),
  'profile-overview': () => (
    <PreviewFrame>
      <div className="flex gap-[2px]">
        <div className={`h-[10px] w-[10px] shrink-0 rounded-full ${pill}`} />
        <div className="flex flex-1 flex-col gap-[1px]">
          <MiniBar width="55%" />
          <MiniBar width="72%" className="h-[2px]" />
        </div>
      </div>
      <div className="grid flex-1 grid-cols-3 gap-[2px]">
        {Array.from({ length: 3 }).map((_, i) => (
          <MiniBox key={i} className="p-[1px]"><MiniBar width="70%" className="h-[2px]" /><MiniBar width="55%" className="mt-[1px] h-[3px]" /></MiniBox>
        ))}
      </div>
    </PreviewFrame>
  ),
  'mobile-app-promo': () => (
    <PreviewFrame>
      <div className="grid h-full grid-cols-[34%,1fr] gap-[2px]">
        <div className="rounded-sm border-2 border-slate-300/80 bg-white p-[2px]">
          <div className={`h-full min-h-0 ${media}`} />
        </div>
        <MiniBox className="flex flex-col gap-[2px] p-[2px]">
          <MiniBar width="72%" />
          <MiniBar width="86%" className="h-[2px]" />
          <div className="mt-auto flex gap-[2px]">
            <MiniBtn />
            <MiniBtn accent />
          </div>
        </MiniBox>
      </div>
    </PreviewFrame>
  ),
  'docs-detail': () => (
    <PreviewFrame>
      <div className="grid h-full grid-cols-[24%,1fr] gap-[2px]">
        <MiniBox className="flex flex-col gap-[2px] p-[2px]">
          {Array.from({ length: 4 }).map((_, i) => (
            <MiniBar key={i} width={`${70 - i * 8}%`} className="h-[2px]" />
          ))}
        </MiniBox>
        <MiniBox className="flex flex-col gap-[2px] p-[2px]">
          <MiniBar width="58%" />
          <MiniBar width="92%" className="h-[2px]" />
          <MiniBar width="84%" className="h-[2px]" />
          <MiniBar width="76%" className="h-[2px]" />
        </MiniBox>
      </div>
    </PreviewFrame>
  ),
  'metrics-sidebar': () => (
    <PreviewFrame>
      <div className="grid h-full grid-cols-[1fr,24%] gap-[2px]">
        <MiniBox className="p-[2px]">
          <div className={`h-full min-h-0 ${media}`} />
        </MiniBox>
        <MiniBox className="flex flex-col gap-[2px] p-[2px]">
          {Array.from({ length: 3 }).map((_, i) => (
            <MiniBox key={i} className="h-[4px] p-[1px]"><MiniBar width="70%" className="h-[2px]" /></MiniBox>
          ))}
        </MiniBox>
      </div>
    </PreviewFrame>
  ),
  'auth-login': () => (
    <PreviewFrame>
      <MiniBox className="flex h-full flex-col gap-[2px] p-[2px]">
        <MiniBar width="65%" />
        <MiniBar width="45%" className="h-[2px]" />
        <MiniBox className="h-[4px]" />
        <MiniBox className="h-[4px]" />
        <MiniBtn accent className="w-full" />
      </MiniBox>
    </PreviewFrame>
  ),
  'auth-signup': () => (
    <PreviewFrame>
      <MiniBox className="flex h-full flex-col gap-[2px] p-[2px]">
        <MiniBar width="58%" />
        <div className="grid grid-cols-2 gap-[2px]">
          <MiniBox className="h-[4px]" />
          <MiniBox className="h-[4px]" />
        </div>
        <MiniBox className="h-[4px]" />
        <MiniBtn accent className="w-full" />
      </MiniBox>
    </PreviewFrame>
  ),
  'kpi-metrics-grid': () => (
    <PreviewFrame>
      <div className="grid h-full grid-cols-4 gap-[2px]">
        {Array.from({ length: 4 }).map((_, i) => (
          <MiniBox key={i} className="flex flex-col gap-[1px] p-[1px]">
            <MiniBar width="80%" className="h-[2px]" />
            <MiniBar width="55%" />
          </MiniBox>
        ))}
      </div>
    </PreviewFrame>
  ),
  'pricing-tier-featured': () => (
    <PreviewFrame>
      <MiniBox className="flex h-full flex-col gap-[2px] border-cyan-400/70 p-[2px]">
        <div className={`h-[3px] w-[28%] ${pill}`} />
        <MiniBar width="50%" />
        <MiniBar width="38%" className="h-[2px]" />
        <MiniBar width="42%" />
        <MiniBtn accent className="w-full" />
      </MiniBox>
    </PreviewFrame>
  ),
  'master-detail-header': () => (
    <PreviewFrame>
      <MiniBox className="flex h-full flex-col gap-[2px] p-[2px]">
        <MiniBar width="72%" className="h-[2px]" />
        <MiniBar width="48%" />
        <MiniBar width="86%" className="h-[2px]" />
        <div className="flex gap-[2px]">
          <MiniBtn />
          <MiniBtn accent />
        </div>
      </MiniBox>
    </PreviewFrame>
  ),
  'user-account-settings': () => (
    <PreviewFrame>
      <div className="flex h-full flex-col gap-[2px]">
        <MiniBox className="flex flex-1 flex-col gap-[2px] p-[2px]">
          <MiniBar width="40%" />
          <div className="grid grid-cols-2 gap-[2px]">
            <MiniBox className="h-[4px]" />
            <MiniBox className="h-[4px]" />
          </div>
        </MiniBox>
        <MiniBox className="h-[5px] p-[2px]"><MiniBtn accent /></MiniBox>
      </div>
    </PreviewFrame>
  ),
  'billing-subscription': () => (
    <PreviewFrame>
      <div className="grid h-full grid-cols-[1.2fr,0.8fr] gap-[2px]">
        <MiniBox className="flex flex-col gap-[2px] p-[2px]">
          <MiniBar width="55%" />
          <MiniBar width="70%" className="h-[2px]" />
          <MiniBtn accent />
        </MiniBox>
        <MiniBox className="flex flex-col gap-[2px] p-[2px]">
          <MiniBar width="60%" />
          <MiniBar width="80%" className="h-[2px]" />
        </MiniBox>
      </div>
    </PreviewFrame>
  ),
  'crud-collection-page': () => (
    <PreviewFrame>
      <div className="flex h-full flex-col gap-[2px]">
        <div className="flex items-center justify-between gap-[2px]">
          <MiniBar width="40%" />
          <MiniBtn accent />
        </div>
        <MiniBox className="flex flex-1 flex-col gap-[1px] p-[2px]">
          <MiniBar width="100%" className="h-[2px]" />
          <MiniBar width="100%" className="h-[2px]" />
          <MiniBar width="100%" className="h-[2px]" />
        </MiniBox>
      </div>
    </PreviewFrame>
  ),
  'not-found-error-pages': () => (
    <PreviewFrame>
      <div className="grid h-full grid-cols-2 gap-[2px]">
        <MiniBox className="flex flex-col items-center justify-center gap-[2px] p-[2px]">
          <MiniBar width="30%" />
          <MiniBar width="60%" className="h-[2px]" />
          <MiniBtn accent />
        </MiniBox>
        <MiniBox className="flex flex-col items-center justify-center gap-[2px] p-[2px]">
          <MiniBar width="30%" />
          <MiniBar width="55%" className="h-[2px]" />
          <MiniBtn accent />
        </MiniBox>
      </div>
    </PreviewFrame>
  ),
  'advanced-search-results': () => (
    <PreviewFrame>
      <div className="flex h-full flex-col gap-[2px]">
        <MiniBox className="grid grid-cols-3 gap-[2px] p-[2px]">
          <MiniBox className="h-[4px]" />
          <MiniBox className="h-[4px]" />
          <MiniBox className="h-[4px]" />
        </MiniBox>
        <MiniBox className="flex flex-1 flex-col gap-[1px] p-[2px]">
          <MiniBar width="100%" className="h-[2px]" />
          <MiniBar width="100%" className="h-[2px]" />
        </MiniBox>
      </div>
    </PreviewFrame>
  ),
};

export const renderPresetMiniPreview = (presetId: NewLayoutPresetId): React.ReactNode => {
  const render = PRESET_MINI_PREVIEW_RENDERERS[presetId];
  return render ? render() : PRESET_MINI_PREVIEW_RENDERERS.blank();
};
