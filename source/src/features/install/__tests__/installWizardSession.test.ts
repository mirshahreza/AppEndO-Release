import { describe, expect, it, beforeEach } from 'vitest';
import {
  clearInstallWizardSession,
  readInitialInstallWizardState,
} from '../installWizardSession';

const STORAGE_KEY = 'appendo:install-wizard:v1';

describe('installWizardSession', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => { store.set(key, value); },
        removeItem: (key: string) => { store.delete(key); },
      },
    });
  });

  it('always starts at welcome after readInitialInstallWizardState', () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      stepIndex: 5,
      furthestStepIndex: 5,
    }));

    const state = readInitialInstallWizardState();
    expect(state.stepIndex).toBe(0);
    expect(state.furthestStepIndex).toBe(0);
    expect(state.installProgress).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('clearInstallWizardSession removes persisted wizard data', () => {
    sessionStorage.setItem(STORAGE_KEY, '{"stepIndex":3,"furthestStepIndex":3}');
    clearInstallWizardSession();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
