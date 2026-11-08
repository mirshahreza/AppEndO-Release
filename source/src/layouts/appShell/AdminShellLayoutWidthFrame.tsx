import * as React from 'react';
import { ShellBoundedLayoutCanvas } from '../../shared/ui/shell-foundation/ShellBoundedLayoutCanvas';
import {
  readShellBoundedEdge,
  readShellBoundedMaxWidth,
  resolveShellLayoutBackdropStyle,
  useOptionalShellLayoutWidth,
} from '../../shared/ui/shell-foundation';

export type AdminShellLayoutWidthFrameProps = {
  className?: string;
  children: React.ReactNode;
};

/** Applies bounded column chrome to the built-in admin `AppShell` when the portal layout requests it. */
export const AdminShellLayoutWidthFrame: React.FC<AdminShellLayoutWidthFrameProps> = ({
  className,
  children,
}) => {
  const layout = useOptionalShellLayoutWidth();
  const document = layout?.document;
  const backdropStyle = React.useMemo(
    () => (document ? resolveShellLayoutBackdropStyle(document) : undefined),
    [document],
  );

  if (!layout || !document) {
    return <>{children}</>;
  }

  return (
    <ShellBoundedLayoutCanvas
      layoutWidth={layout.activeWidth}
      boundedMaxWidth={readShellBoundedMaxWidth(document)}
      boundedEdge={readShellBoundedEdge(document)}
      backdropStyle={backdropStyle}
      className={className}
    >
      {children}
    </ShellBoundedLayoutCanvas>
  );
};
