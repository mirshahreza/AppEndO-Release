import * as React from 'react';
import { cn } from '../../../lib/utils';
import { type ShellElementProps, type ShellLogicalSide, type ShellVisibility, visibilityClass } from './shellFoundation';

export type ShellLogoAsset = { source: 'platform-default'; node: React.ReactNode } | { source: 'local-asset'; assetRef: string };
export type ShellLogoRegionProps = Omit<ShellElementProps<HTMLDivElement>, 'children'> & {
  asset: ShellLogoAsset;
  compactAsset?: ShellLogoAsset;
  compact?: boolean;
  alt: string;
  decorative?: boolean;
  href?: string;
  fit?: 'contain' | 'cover';
  renderStyle?: 'original' | 'monochrome' | 'accent-tinted';
  display?: 'full' | 'mark-only' | 'text-and-mark';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  placement?: ShellLogicalSide | 'center';
  visibility?: ShellVisibility;
};

const sizes = { xs: 'h-5 max-w-24', sm: 'h-7 max-w-32', md: 'h-9 max-w-40', lg: 'h-12 max-w-48', xl: 'h-16 max-w-56' };

const renderAsset = (asset: ShellLogoAsset, alt: string, decorative: boolean, fit: 'contain' | 'cover', renderStyle: ShellLogoRegionProps['renderStyle']) => (
  asset.source === 'platform-default'
    ? asset.node
    : <img src={asset.assetRef} alt={decorative ? '' : alt} aria-hidden={decorative || undefined} className={cn('size-full', fit === 'contain' ? 'object-contain' : 'object-cover', renderStyle === 'monochrome' && 'grayscale', renderStyle === 'accent-tinted' && 'opacity-80')} />
);

export const ShellLogoRegion = React.forwardRef<HTMLDivElement, ShellLogoRegionProps>(function ShellLogoRegion({
  asset,
  compactAsset,
  compact = false,
  alt,
  decorative = false,
  href,
  fit = 'contain',
  renderStyle = 'original',
  display = 'full',
  size = 'md',
  placement = 'start',
  visibility,
  className,
  ...props
}, ref) {
  const content = renderAsset(compact && compactAsset ? compactAsset : asset, alt, decorative, fit, renderStyle);
  const external = href?.startsWith('https://');
  return (
    <div
      ref={ref}
      data-shell-logo=""
      data-display={display}
      className={cn(
        'flex min-w-0 items-center',
        placement === 'start' && 'me-auto',
        placement === 'end' && 'ms-auto',
        placement === 'center' && 'mx-auto',
        visibilityClass(visibility),
        className,
      )}
      {...props}
    >
      {href ? (
        <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined} className={cn('inline-flex focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus', sizes[size])} aria-label={decorative ? alt : undefined}>
          {content}
        </a>
      ) : (
        <span className={cn('inline-flex', sizes[size])}>{content}</span>
      )}
    </div>
  );
});
