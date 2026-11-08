import { useEffect, useState } from 'react';

export function useDocumentVisibility(): boolean {
  const [visible, setVisible] = useState(
    () => (typeof document === 'undefined' ? true : document.visibilityState === 'visible'),
  );

  useEffect(() => {
    const onVisibilityChange = () => {
      setVisible(document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  return visible;
}

export function useVisibilityAwareRefetchInterval(intervalMs: number): number | false {
  const visible = useDocumentVisibility();
  return visible ? intervalMs : false;
}
