import { useEffect, useState } from 'react';
import { EDGE_STATE_STORAGE_KEY } from '../constants';
import type { ServerFunctionCatalogState } from './useServerFunctionCatalog';

type UseServerFunctionSettingsInput = {
  catalog: ServerFunctionCatalogState;
  addLog: (msg: string, type?: 'info' | 'success' | 'warn') => void;
};

export function useServerFunctionSettings({ catalog, addLog }: UseServerFunctionSettingsInput) {
  const { activeId, functions } = catalog;

  const [globalDefaultVMMode, setGlobalDefaultVMMode] = useState<'v18.x' | 'v20.x'>('v20.x');
  const [globalDefaultRAM, setGlobalDefaultRAM] = useState<number>(128);
  const [globalDefaultTimeout, setGlobalDefaultTimeout] = useState<number>(1500);

  const [testVMMode, setTestVMMode] = useState<'v18.x' | 'v20.x'>('v20.x');
  const [testRAM, setTestRAM] = useState<number>(128);
  const [testTimeout, setTestTimeout] = useState<number>(1500);

  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkVMMode, setBulkVMMode] = useState<'v18.x' | 'v20.x'>('v20.x');
  const [bulkRAM, setBulkRAM] = useState<number>(128);
  const [bulkTimeout, setBulkTimeout] = useState<number>(1500);

  useEffect(() => {
    if (activeId) {
      const active = functions.find((f) => f.id === activeId);
      if (active) {
        setTestVMMode(active.runtimeVersion);
        setTestRAM(active.memoryLimit);
        setTestTimeout(active.timeoutMs);
      }
    } else {
      setTestVMMode(globalDefaultVMMode);
      setTestRAM(globalDefaultRAM);
      setTestTimeout(globalDefaultTimeout);
    }
  }, [activeId, globalDefaultVMMode, globalDefaultRAM, globalDefaultTimeout, functions]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(EDGE_STATE_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.globalDefaultVMMode === 'v18.x' || parsed?.globalDefaultVMMode === 'v20.x') {
        setGlobalDefaultVMMode(parsed.globalDefaultVMMode);
      }
      if (typeof parsed?.globalDefaultRAM === 'number') {
        setGlobalDefaultRAM(parsed.globalDefaultRAM);
      }
      if (typeof parsed?.globalDefaultTimeout === 'number') {
        setGlobalDefaultTimeout(parsed.globalDefaultTimeout);
      }
    } catch {
      addLog('Stored edge settings were invalid and were ignored.', 'warn');
    }
  }, [addLog]);

  return {
    globalDefaultVMMode,
    setGlobalDefaultVMMode,
    globalDefaultRAM,
    setGlobalDefaultRAM,
    globalDefaultTimeout,
    setGlobalDefaultTimeout,
    testVMMode,
    setTestVMMode,
    testRAM,
    setTestRAM,
    testTimeout,
    setTestTimeout,
    isBulkOpen,
    setIsBulkOpen,
    bulkVMMode,
    setBulkVMMode,
    bulkRAM,
    setBulkRAM,
    bulkTimeout,
    setBulkTimeout,
  };
}

export type ServerFunctionSettingsState = ReturnType<typeof useServerFunctionSettings>;
