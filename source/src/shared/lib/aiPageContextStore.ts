import { useEffect, useSyncExternalStore } from 'react';
import type { AiPageContextEnrichment } from '../api/contracts/ai/pageContext';

type Listener = () => void;

let enrichment: AiPageContextEnrichment = {};
const listeners = new Set<Listener>();

export const getAiPageContextEnrichment = (): AiPageContextEnrichment => enrichment;

export const subscribeAiPageContextEnrichment = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const setAiPageContextEnrichment = (next: AiPageContextEnrichment | null): void => {
  enrichment = next ?? {};
  listeners.forEach((listener) => listener());
};

export const useAiPageContextEnrichment = (): AiPageContextEnrichment => (
  useSyncExternalStore(subscribeAiPageContextEnrichment, getAiPageContextEnrichment, getAiPageContextEnrichment)
);

export const usePublishAiPageContext = (next: AiPageContextEnrichment | null): void => {
  const serialized = next ? JSON.stringify(next) : '';

  useEffect(() => {
    setAiPageContextEnrichment(next);
    return () => {
      setAiPageContextEnrichment(null);
    };
  }, [serialized]);
};
