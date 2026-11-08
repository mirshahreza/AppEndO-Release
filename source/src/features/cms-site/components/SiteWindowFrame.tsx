import React from 'react';

type SiteWindowFrameProps = {
  src: string;
  alt?: string;
  label?: string;
  variant?: 'lg' | 'sm';
  ratio?: string;
  className?: string;
  onOpen?: () => void;
};

/**
 * Every real Studio screenshot on the site renders inside this same "window"
 * chrome, so annotated product evidence reads as one consistent system
 * instead of ad-hoc thumbnails at inconsistent sizes.
 */
export const SiteWindowFrame: React.FC<SiteWindowFrameProps> = ({
  src,
  alt = '',
  label,
  variant = 'lg',
  ratio = '16 / 10',
  className,
  onOpen,
}) => (
  <div className={['site-window', `site-window-${variant}`, className].filter(Boolean).join(' ')}>
    {variant === 'lg' ? (
      <div className="site-window-bar">
        <span className="site-window-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        {label ? <span className="site-window-address">{label}</span> : null}
      </div>
    ) : null}
    {onOpen ? (
      <button
        type="button"
        className="site-window-zoom"
        style={{ aspectRatio: ratio }}
        onClick={onOpen}
        aria-label={alt.trim() ? `View larger: ${alt}` : 'View screenshot larger'}
      >
        <img src={src} alt={alt} loading="lazy" />
        <span className="site-window-zoom-hint">View larger</span>
      </button>
    ) : (
      <div className="site-window-body" style={{ aspectRatio: ratio }}>
        <img src={src} alt={alt} loading="lazy" />
      </div>
    )}
  </div>
);

export const SiteWindowPlaceholder: React.FC<{ label?: string; variant?: 'lg' | 'sm'; ratio?: string; className?: string }> = ({
  label = 'Capture pending',
  variant = 'lg',
  ratio = '16 / 10',
  className,
}) => (
  <div className={['site-window', 'site-window-placeholder', `site-window-${variant}`, className].filter(Boolean).join(' ')}>
    {variant === 'lg' ? (
      <div className="site-window-bar">
        <span className="site-window-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </div>
    ) : null}
    <div className="site-window-body site-window-body-empty" style={{ aspectRatio: ratio }} aria-hidden="true">
      <svg viewBox="0 0 36 36" className="site-window-empty-mark">
        <path d="M18 1 L34 9.5 L34 26.5 L18 35 L2 26.5 L2 9.5 Z" />
      </svg>
      <span>{label}</span>
    </div>
  </div>
);
