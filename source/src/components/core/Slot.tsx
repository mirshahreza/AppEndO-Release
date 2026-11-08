import React, { useSyncExternalStore, useCallback } from 'react';
import { slotRegistry } from '../../core/slots/SlotRegistry';

interface SlotProps {
  name: string;
  children?: React.ReactNode;
  [key: string]: any;
}

export const Slot: React.FC<SlotProps> = ({ name, children, ...props }) => {
  const subscribe = useCallback((listener: () => void) => slotRegistry.subscribe(listener), []);
  const getSnapshot = useCallback(() => slotRegistry.getComponents(name), [name]);

  const components = useSyncExternalStore(subscribe, getSnapshot);

  if (components.length === 0) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      {components.map((Comp) => (
        <Comp.component key={Comp.id} {...props} />
      ))}
    </>
  );
};
