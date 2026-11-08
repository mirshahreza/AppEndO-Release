import * as React from 'react';
import type {
  CreativeMotionEnvironment,
  CreativeMotionExperience,
  CreativeMotionProviderProps,
  CreativeMotionViewport,
} from './types';

type ConnectionLike = {
  saveData?: boolean;
  effectiveType?: string;
  addEventListener?: (type: 'change', listener: () => void) => void;
  removeEventListener?: (type: 'change', listener: () => void) => void;
};

type CreativeMotionContextValue = {
  environment: Omit<CreativeMotionEnvironment, 'offscreen'>;
  setPaused: (paused: boolean) => void;
};

const CreativeMotionContext = React.createContext<CreativeMotionContextValue | null>(null);

function useMedia(query: string, serverValue: boolean): boolean {
  const [matches, setMatches] = React.useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return serverValue;
    return window.matchMedia(query).matches;
  });
  React.useEffect(() => {
    if (!window.matchMedia) return;
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, [query]);
  return matches;
}

function useDocumentHidden(): boolean {
  const [hidden, setHidden] = React.useState(
    typeof document === 'undefined' ? true : document.hidden,
  );
  React.useEffect(() => {
    const update = () => setHidden(document.hidden);
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return hidden;
}

function useReducedData(): boolean {
  const read = React.useCallback(() => {
    if (typeof navigator === 'undefined') return true;
    const connection = (navigator as Navigator & { connection?: ConnectionLike }).connection;
    return Boolean(
      connection?.saveData
      || connection?.effectiveType === '2g'
      || connection?.effectiveType === 'slow-2g',
    );
  }, []);
  const [reduced, setReduced] = React.useState(read);
  React.useEffect(() => {
    const connection = (navigator as Navigator & { connection?: ConnectionLike }).connection;
    const update = () => setReduced(read());
    update();
    connection?.addEventListener?.('change', update);
    return () => connection?.removeEventListener?.('change', update);
  }, [read]);
  return reduced;
}

function projectedViewport(
  explicit: CreativeMotionViewport | undefined,
  phone: boolean,
  tablet: boolean,
): CreativeMotionViewport {
  if (explicit) return explicit;
  if (phone) return 'phone';
  if (tablet) return 'tablet';
  return 'desktop';
}

export function CreativeMotionProvider({
  children,
  experienceMode = 'site',
  viewport,
  paused: controlledPaused,
}: CreativeMotionProviderProps) {
  const [internalPaused, setInternalPaused] = React.useState(false);
  const reducedMotion = useMedia('(prefers-reduced-motion: reduce)', true);
  const forcedColors = useMedia('(forced-colors: active)', false);
  const coarsePointer = useMedia('(pointer: coarse)', true);
  const phone = useMedia('(max-width: 639px)', false);
  const tablet = useMedia('(max-width: 1023px)', false);
  const reducedData = useReducedData();
  const documentHidden = useDocumentHidden();

  const value = React.useMemo<CreativeMotionContextValue>(
    () => ({
      environment: {
        experienceMode,
        viewport: projectedViewport(viewport, phone, tablet),
        reducedMotion,
        reducedData,
        coarsePointer,
        documentHidden,
        paused: controlledPaused ?? internalPaused,
        forcedColors,
      },
      setPaused: setInternalPaused,
    }),
    [
      coarsePointer,
      controlledPaused,
      documentHidden,
      experienceMode,
      forcedColors,
      internalPaused,
      phone,
      reducedData,
      reducedMotion,
      tablet,
      viewport,
    ],
  );

  return (
    <CreativeMotionContext.Provider value={value}>
      {children}
    </CreativeMotionContext.Provider>
  );
}

export function useCreativeMotionHost(): CreativeMotionContextValue {
  const context = React.useContext(CreativeMotionContext);
  if (context) return context;
  return {
    environment: {
      experienceMode: 'site' as CreativeMotionExperience,
      viewport: 'desktop',
      reducedMotion: true,
      reducedData: true,
      coarsePointer: true,
      documentHidden: typeof document === 'undefined' ? true : document.hidden,
      paused: false,
      forcedColors: false,
    },
    setPaused: () => undefined,
  };
}
