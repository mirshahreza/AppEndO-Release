import { useCallback, useState } from 'react';

export function useServerFunctionLogs() {
  const [logs, setLogs] = useState<Array<{ id: string; time: string; msg: string; type: 'info' | 'success' | 'warn' }>>([]);

  const addLog = useCallback((msg: string, type: 'info' | 'success' | 'warn' = 'info') => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs((prev) => [
      { id: Math.random().toString(), time, msg, type },
      ...prev.slice(0, 15),
    ]);
  }, []);

  return { logs, addLog };
}
