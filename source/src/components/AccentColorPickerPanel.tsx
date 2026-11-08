import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';
import { hexToRgb } from '../shared/theme/accentColorUtils';
import {
  ACCENT_COLOR_MATRIX,
  ACCENT_INTENSITY_LABELS,
  type AccentMatrixSwatch,
} from '../shared/theme/accentPalettes';

const swatchNeedsDarkForeground = (hex: string): boolean => {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.48;
};

export type AccentColorPickerPanelProps = {
  isOpen: boolean;
  panelId: string;
  panelStyle: { top: number; left?: number; right?: number } | null;
  accentHex: string;
  onSwatchSelect: (swatch: AccentMatrixSwatch) => void;
};

/**
 * Split out of AccentColorPicker.tsx and lazy-loaded there — this is the only part of the
 * component that needs `motion`/`framer-motion` (for the panel's enter/exit transition), and
 * AccentColorPicker renders inside the always-mounted shell header, so keeping motion here
 * (rather than in the eager trigger button file) keeps the "motion" vendor chunk out of the
 * app's main entry bundle.
 */
export const AccentColorPickerPanel: React.FC<AccentColorPickerPanelProps> = ({
  isOpen,
  panelId,
  panelStyle,
  accentHex,
  onSwatchSelect,
}) => (
  <AnimatePresence>
    {isOpen && panelStyle && (
      <motion.div
        id={panelId}
        role="dialog"
        aria-label="Accent color picker"
        initial={{ opacity: 0, y: -6, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -4, scale: 0.98 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        style={{
          top: panelStyle.top,
          ...(panelStyle.left != null
            ? { left: panelStyle.left }
            : { right: panelStyle.right }),
        }}
        className="fixed z-[200] w-[min(94vw,380px)] overflow-hidden rounded-xl border border-border-subtle bg-white shadow-elevated-modal"
      >
        <div className="relative px-3 py-2 border-b border-border-subtle bg-gradient-to-br from-slate-50/90 via-white to-primary-subtle/35">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
            <Sparkles className="w-2.5 h-2.5 text-primary-700" />
            Accent Theme
          </div>
        </div>

        <div className="px-3 py-3">
          <div className="grid grid-cols-[52px_repeat(5,minmax(0,1fr))] items-center gap-x-1.5 gap-y-1.5">
            <div />
            {ACCENT_INTENSITY_LABELS.map((label) => (
              <div
                key={label}
                className={cn(
                  'pb-0.5 text-center text-[9px] font-bold uppercase tracking-[0.08em]',
                  label === 'Light' ? 'text-slate-800' : 'text-slate-500',
                )}
              >
                {label}
              </div>
            ))}

            {ACCENT_COLOR_MATRIX.map((row) => (
              <React.Fragment key={row.id}>
                <div className="truncate pe-1 text-[10px] font-semibold text-slate-600">
                  {row.name}
                </div>
                {row.swatches.map((swatch) => {
                  const isSelected = accentHex === swatch.hex.toUpperCase();
                  const darkFg = swatchNeedsDarkForeground(swatch.hex);
                  return (
                    <button
                      key={swatch.id}
                      type="button"
                      title={`${row.name} — ${ACCENT_INTENSITY_LABELS[swatch.intensity - 1]} (${swatch.hex})`}
                      onClick={() => onSwatchSelect(swatch)}
                      className={cn(
                        'relative h-8 w-full rounded-md border transition-all duration-150',
                        darkFg
                          ? isSelected
                            ? 'border-slate-500 shadow-[0_0_0_2px_rgb(15_23_42/0.22)] scale-105 z-10'
                            : 'border-slate-300/90 shadow-sm hover:scale-105 hover:shadow-md hover:z-10'
                          : isSelected
                            ? 'border-white shadow-cyan-ring-md scale-105 z-10'
                            : 'border-white/80 shadow-sm hover:scale-105 hover:shadow-md hover:z-10',
                      )}
                      style={{ backgroundColor: swatch.hex }}
                    >
                      {isSelected && (
                        <Check
                          className={cn(
                            'absolute inset-0 m-auto h-3.5 w-3.5 drop-shadow-sm',
                            darkFg ? 'text-slate-950' : 'text-white',
                          )}
                          strokeWidth={3.5}
                        />
                      )}
                    </button>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);
