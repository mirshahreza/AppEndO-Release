import * as React from 'react';
import { Download } from 'lucide-react';
import { AppButton } from './AppButton';
import { PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS } from './surfaceClasses';
import type { DesignerExportFormat } from '../../domain/component-designer/designerDataExport';

export type ToolbarExportButtonProps = {
  onExport: (format: DesignerExportFormat) => void;
  disabled?: boolean;
  defaultFormat?: DesignerExportFormat;
  /** When false, omits the leading separator. */
  separatorBefore?: boolean;
};

/**
 * Phase 48 — Export control for designer grid page toolbars.
 * Primary click uses `defaultFormat` (CSV); a compact format menu covers Excel/PDF.
 */
export const ToolbarExportButton: React.FC<ToolbarExportButtonProps> = ({
  onExport,
  disabled = false,
  defaultFormat = 'csv',
  separatorBefore = true,
}) => {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [menuOpen]);

  return (
    <>
      {separatorBefore ? (
        <span className={PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS} aria-hidden="true" />
      ) : null}
      <div ref={rootRef} className="relative inline-flex items-center gap-0.5">
        <AppButton
          type="button"
          size="sm"
          intent="utility"
          disabled={disabled}
          aria-label="Export"
          data-testid="designer-grid-toolbar-export"
          onClick={() => onExport(defaultFormat)}
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Export
        </AppButton>
        <AppButton
          type="button"
          size="icon-sm"
          intent="utility"
          disabled={disabled}
          aria-label="Export format"
          aria-expanded={menuOpen}
          data-testid="designer-grid-toolbar-export-menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="text-[10px] font-bold leading-none">▾</span>
        </AppButton>
        {menuOpen ? (
          <div
            className="absolute end-0 top-full z-20 mt-1 min-w-[7.5rem] rounded-md border border-slate-200 bg-white py-1 shadow-md"
            role="menu"
          >
            {([
              { format: 'csv' as const, label: 'CSV' },
              { format: 'xlsx' as const, label: 'Excel' },
              { format: 'pdf' as const, label: 'PDF' },
            ]).map((option) => (
              <button
                key={option.format}
                type="button"
                role="menuitem"
                className="flex w-full px-3 py-1.5 text-start text-xs text-slate-700 hover:bg-slate-50"
                data-testid={`designer-grid-toolbar-export-${option.format}`}
                onClick={() => {
                  setMenuOpen(false);
                  onExport(option.format);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
};
