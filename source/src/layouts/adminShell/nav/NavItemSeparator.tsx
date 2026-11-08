import { cn } from '../../../lib/utils';
import {
  DEFAULT_ADMIN_NAV_SEPARATOR_OPTIONS,
  resolveAdminNavSeparatorEdgeStyle,
  type AdminNavSeparatorOptions,
} from './navSeparatorOptions';

type NavItemSeparatorProps = {
  className?: string;
  collapsed?: boolean;
  options?: AdminNavSeparatorOptions;
};

export function NavItemSeparator({
  className,
  collapsed = false,
  options,
}: NavItemSeparatorProps) {
  const merged = {
    ...DEFAULT_ADMIN_NAV_SEPARATOR_OPTIONS,
    ...options,
  };
  const thicknessPx = Math.max(1, merged.thicknessPx);
  const edgeStyle = resolveAdminNavSeparatorEdgeStyle(options);
  const isInset = edgeStyle === 'inset';

  return (
    <div
      role="presentation"
      className={cn(
        'admin-nav-separator shrink-0',
        edgeStyle === 'outset' && 'admin-nav-separator--outset',
        collapsed ? 'mx-auto w-[22px]' : cn('w-full', isInset && 'mx-3 w-auto'),
        className,
      )}
      style={{
        borderTopWidth: `${thicknessPx}px`,
        borderTopColor: merged.color,
      }}
    />
  );
}
