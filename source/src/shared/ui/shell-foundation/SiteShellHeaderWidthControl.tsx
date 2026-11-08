import * as React from 'react';
import { ShellPageWidthHeaderControl } from './ShellPageWidthHeaderControl';

/** Renders inside `site-shell-header-controls` on CMS site shells (no AppShellHeader chrome slot). */
export const SiteShellHeaderWidthControl: React.FC = () => (
  <span className="site-shell-header-width-control inline-flex items-center" data-designer-chrome-interactive="true">
    <ShellPageWidthHeaderControl className="inline-flex" />
  </span>
);
