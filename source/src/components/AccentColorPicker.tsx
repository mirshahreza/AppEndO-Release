import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../lib/utils';
import { useAccentTheme } from '../contexts/AccentThemeContext';
import { normalizeHex } from '../shared/theme/accentColorUtils';
import type { AccentMatrixSwatch } from '../shared/theme/accentPalettes';
import { useOptionalCulture } from '../core/culture/CultureContext';
import { PAGE_GUIDE_EN } from '../core/culture/translations/pageGuideEn';
import { HeaderHintTooltip } from '../shared/ui/SideHintTooltip';
import { pageGuideChromeProps } from '../shared/ui/shell/pageGuide/pageGuideChrome';
import { PaletteIcon } from './accentColorPickerIcon';

// Lazy: the panel is the only part of this component that needs motion/framer-motion (for its
// enter/exit transition) — see AccentColorPickerPanel.tsx for why that matters here.
const AccentColorPickerPanel = React.lazy(() => import('./AccentColorPickerPanel').then((m) => ({ default: m.AccentColorPickerPanel })));

export type AccentColorPickerSize = 'md' | 'sm';

const PICKER_SIZE_CLASS: Record<AccentColorPickerSize, { button: string; swatch: string; icon: string }> = {
  md: {
    button: 'h-8 w-8 rounded-lg',
    swatch: 'inset-[4px]',
    icon: 'h-[15px] w-[15px]',
  },
  sm: {
    /** Square header chrome — accent dot centered with equal inset on both sides. */
    button: 'h-9 w-9 rounded-lg',
    swatch: 'h-[15px] w-[15px]',
    icon: 'h-2 w-2',
  },
};

export const AccentColorPicker: React.FC<{ size?: AccentColorPickerSize }> = ({ size = 'md' }) => {
  const { accentHex, setAccentColor } = useAccentTheme();
  const culture = useOptionalCulture();
  const isRtl = culture?.direction === 'rtl';
  const [isOpen, setIsOpen] = useState(false);
  // Once opened, keep mounting the lazy panel on subsequent opens/closes so close
  // transitions keep working — only the very first open pays the chunk-load cost.
  const [everOpened, setEverOpened] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [panelStyle, setPanelStyle] = useState<{ top: number; left?: number; right?: number } | null>(null);

  const updatePanelPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setPanelStyle(
      isRtl
        ? {
            top: rect.bottom + 8,
            left: Math.max(12, rect.left),
          }
        : {
            top: rect.bottom + 8,
            right: Math.max(12, window.innerWidth - rect.right),
          },
    );
  }, [isRtl]);

  useEffect(() => {
    if (isOpen) setEverOpened(true);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setPanelStyle(null);
      return;
    }

    updatePanelPosition();

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      const panel = document.getElementById(panelId);
      if (panel?.contains(target)) return;
      setIsOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    const onLayoutChange = () => updatePanelPosition();

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onLayoutChange);
    window.addEventListener('scroll', onLayoutChange, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onLayoutChange);
      window.removeEventListener('scroll', onLayoutChange, true);
    };
  }, [isOpen, panelId, updatePanelPosition]);

  const handleSwatchSelect = useCallback((swatch: AccentMatrixSwatch) => {
    const normalized = normalizeHex(swatch.hex);
    if (!normalized) return;
    setAccentColor(normalized, swatch.source);
  }, [setAccentColor]);

  const sizeClass = PICKER_SIZE_CLASS[size];
  const accentTitle = PAGE_GUIDE_EN['pageGuide.chrome.accent.title'];
  const accentHint = PAGE_GUIDE_EN['pageGuide.chrome.accent.hint'];

  return (
    <div ref={rootRef} className="relative inline-flex shrink-0">
      <HeaderHintTooltip title={accentTitle} hint={accentHint} tone="amber">
      <button
        ref={triggerRef}
        type="button"
        aria-label={accentTitle}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-controls={panelId}
        {...pageGuideChromeProps((key) => PAGE_GUIDE_EN[key] ?? key, 'accent', 21)}
        onClick={() => {
          setIsOpen((open) => {
            const next = !open;
            if (next) {
              const trigger = triggerRef.current;
              if (trigger) {
                const rect = trigger.getBoundingClientRect();
                setPanelStyle(
                  isRtl
                    ? {
                        top: rect.bottom + 8,
                        left: Math.max(12, rect.left),
                      }
                    : {
                        top: rect.bottom + 8,
                        right: Math.max(12, window.innerWidth - rect.right),
                      },
                );
              }
            }
            return next;
          });
        }}
        className={cn(
          'group relative flex shrink-0 cursor-pointer items-center justify-center transition-all duration-300',
          sizeClass.button,
          isOpen
            ? 'bg-primary-subtle/70 text-primary-700 shadow-cyan-ring-sm'
            : 'text-slate-400 hover:bg-primary-subtle/55 hover:text-primary-700',
        )}
      >
        {size === 'sm' ? (
          <span
            aria-hidden
            className={cn(
              'shrink-0 rounded-full transition-transform duration-500',
              sizeClass.swatch,
              isOpen ? 'scale-100' : 'scale-95 group-hover:scale-100',
            )}
            style={{
              backgroundColor: accentHex,
              boxShadow: '0 0 0 1.5px color-mix(in srgb, var(--app-accent-500) 42%, white)',
            }}
          />
        ) : (
          <span
            aria-hidden
            className={cn(
              'absolute rounded-full transition-transform duration-500',
              sizeClass.swatch,
              isOpen ? 'scale-100' : 'scale-90 group-hover:scale-100',
            )}
            style={{
              background: `conic-gradient(from 210deg, ${accentHex}, #6366f1, #06b6d4, ${accentHex})`,
              padding: '2px',
            }}
          >
            <span
              className="flex h-full w-full items-center justify-center rounded-full border border-white/80 bg-surface-shell shadow-sm"
              style={{ backgroundColor: accentHex }}
            />
          </span>
        )}
        <PaletteIcon
          className={cn('pointer-events-none absolute inset-0 m-auto opacity-0', sizeClass.icon)}
        />
      </button>
      </HeaderHintTooltip>

      {everOpened && typeof document !== 'undefined' && createPortal(
        <React.Suspense fallback={null}>
          <AccentColorPickerPanel
            isOpen={isOpen}
            panelId={panelId}
            panelStyle={panelStyle}
            accentHex={accentHex}
            onSwatchSelect={handleSwatchSelect}
          />
        </React.Suspense>,
        document.body,
      )}
    </div>
  );
};
