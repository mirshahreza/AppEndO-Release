import React from 'react';

/**
 * Local copies of the 7 lucide-react icons AppToast needs. AppToast is rendered from
 * GlobalApiErrorToast, which main.tsx mounts unconditionally at boot — a static `lucide-react`
 * import here forces Vite to modulepreload the entire shared "lucide" chunk (used by 250+ files
 * app-wide) before the app is interactive. Inlining these few paths keeps AppToast out of that
 * chunk's eager-load graph; lucide-react itself still loads normally once a lazy route needs it.
 */
export type AppToastIconComponent = React.FC<React.SVGProps<SVGSVGElement>>;

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

export const AlertCircleIcon: AppToastIconComponent = (props) => (
  <svg {...baseProps} {...props}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" x2="12" y1="8" y2="12" />
    <line x1="12" x2="12.01" y1="16" y2="16" />
  </svg>
);

export const AlertTriangleIcon: AppToastIconComponent = (props) => (
  <svg {...baseProps} {...props}>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </svg>
);

export const CheckCircle2Icon: AppToastIconComponent = (props) => (
  <svg {...baseProps} {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

export const InfoIcon: AppToastIconComponent = (props) => (
  <svg {...baseProps} {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </svg>
);

export const LockIcon: AppToastIconComponent = (props) => (
  <svg {...baseProps} {...props}>
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

export const LockOpenIcon: AppToastIconComponent = (props) => (
  <svg {...baseProps} {...props}>
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 9.9-1" />
  </svg>
);

export const AppToastXIcon: AppToastIconComponent = (props) => (
  <svg {...baseProps} {...props}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);
