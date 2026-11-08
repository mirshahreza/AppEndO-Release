import React from 'react';
import { cn } from '../../lib/utils';

const MonitorIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={24}
    height={24}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <rect width="20" height="14" x="2" y="3" rx="2" />
    <line x1="8" x2="16" y1="21" y2="21" />
    <line x1="12" x2="12" y1="17" y2="21" />
  </svg>
);

export type ViewportUnavailablePanelProps = {
  title?: string;
  message?: string;
  action?: React.ReactNode;
  className?: string;
};

const DEFAULT_TITLE = 'Desktop only';
const DEFAULT_MESSAGE =
  'This workspace is available on desktop screens (1024px and wider). Open AppEndO on a larger display to continue.';

export const ViewportUnavailablePanel: React.FC<ViewportUnavailablePanelProps> = ({
  title = DEFAULT_TITLE,
  message = DEFAULT_MESSAGE,
  action,
  className,
}) => (
  <div
    data-ui-viewport-unavailable=""
    className={cn(
      'flex min-h-[min(100%,480px)] w-full flex-col items-center justify-center gap-4 p-6 text-center',
      className,
    )}
  >
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
      <MonitorIcon className="h-7 w-7 text-slate-400" />
    </div>
    <div className="max-w-md space-y-2">
      <h2 className="text-lg font-bold tracking-tight text-slate-800">{title}</h2>
      <p className="text-sm leading-relaxed text-slate-500">{message}</p>
    </div>
    {action}
  </div>
);
