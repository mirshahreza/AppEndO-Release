import React from 'react';
import { Kbd } from '@heroui/react';
import { cn } from '../../lib/utils';

const HeroKbd = Kbd as any;

export type UiKbdProps = {
  /** Shortcut keys in press order, e.g. `['Ctrl', 'K']`. */
  keys: readonly string[];
  className?: string;
};

/** Thin wrapper over HeroUI `Kbd` — keyboard shortcut chrome. */
export const UiKbd: React.FC<UiKbdProps> = ({ keys, className }) => {
  const parts = keys.filter((key) => key.trim().length > 0);
  const Content = HeroKbd.Content ?? 'kbd';

  return (
    <HeroKbd className={cn('inline-flex items-center gap-0.5', className)} aria-label={parts.join(' + ')}>
      {parts.map((key, index) => (
        <React.Fragment key={`${key}-${index}`}>
          {index > 0 ? <span className="px-0.5 text-[10px] text-slate-400" aria-hidden>+</span> : null}
          <Content className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] font-medium text-slate-700 shadow-[0_1px_0_rgb(226_232_240)]">
            {key}
          </Content>
        </React.Fragment>
      ))}
    </HeroKbd>
  );
};
