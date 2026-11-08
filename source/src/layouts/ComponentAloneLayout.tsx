import React from 'react';
import { ShellRouteOutlet } from '../app/platform/ShellRouteOutlet';

/** Minimal built-in shell for component-alone preview routes (outlet only, no chrome). */
export const ComponentAloneLayout: React.FC = () => (
  <div
    className="flex h-screen w-full flex-col overflow-hidden bg-white"
    data-testid="component-alone-layout"
  >
    <ShellRouteOutlet />
  </div>
);
