import React from 'react';

/**
 * Local copies of the 3 lucide-react icons PwaManager needs (RefreshCw, Smartphone, X).
 * PwaManager renders unconditionally at boot, so a static `lucide-react` import here forces
 * Vite to modulepreload the entire shared "lucide" chunk (used by 250+ files app-wide) before
 * the app is interactive. Inlining these few paths keeps PwaManager out of that chunk's
 * eager-load graph; lucide-react itself still loads normally once a lazy route needs it.
 */
type IconProps = React.SVGProps<SVGSVGElement>;

const baseProps = {
  xmlns: 'http://www.w3.org/2000/svg',
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': 'true' as const,
};

export const RefreshCwIcon: React.FC<IconProps> = (props) => (
  <svg {...baseProps} {...props}>
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M8 16H3v5" />
  </svg>
);

export const SmartphoneIcon: React.FC<IconProps> = (props) => (
  <svg {...baseProps} {...props}>
    <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
    <path d="M12 18h.01" />
  </svg>
);

export const XIcon: React.FC<IconProps> = (props) => (
  <svg {...baseProps} {...props}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);
