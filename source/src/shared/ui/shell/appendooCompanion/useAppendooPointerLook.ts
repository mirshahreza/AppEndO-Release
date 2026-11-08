import { useEffect, useState, type RefObject } from 'react';
import {
  APPENDOO_POINTER_LOOK_REST,
  resolveAppendooPointerLook,
  type AppendooPointerLook,
} from './appendooPointerLook';

export const useAppendooPointerLook = (
  hostRef: RefObject<HTMLElement | null>,
  enabled: boolean,
): AppendooPointerLook => {
  const [look, setLook] = useState<AppendooPointerLook>(APPENDOO_POINTER_LOOK_REST);

  useEffect(() => {
    if (!enabled) {
      setLook(APPENDOO_POINTER_LOOK_REST);
      return undefined;
    }
    const onMove = (event: PointerEvent) => {
      const host = hostRef.current;
      if (!host) return;
      const rect = host.getBoundingClientRect();
      setLook(resolveAppendooPointerLook(event.clientX, event.clientY, {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      }));
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
    };
  }, [enabled, hostRef]);

  return look;
};
