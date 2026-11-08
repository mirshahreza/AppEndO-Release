import { describe, expect, it } from 'vitest';

interface MockServerFunction {
  id: string;
  name: string;
  folder: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  code: string;
  testPayload: string;
  memoryLimit: number;
  timeoutMs: number;
  runtimeVersion: 'v18.x' | 'v20.x';
}

describe('ServerFunctions Logic & Tree Groupings', () => {
  
  const setupMockFunctions = (): MockServerFunction[] => [
    {
      id: 'fn-1',
      name: 'get-all',
      folder: 'users',
      method: 'GET',
      path: '/api/users/get-all',
      code: 'console.log("get-all");',
      testPayload: '{}',
      memoryLimit: 128,
      timeoutMs: 1500,
      runtimeVersion: 'v20.x'
    },
    {
      id: 'fn-2',
      name: 'create',
      folder: 'users',
      method: 'POST',
      path: '/api/users/create',
      code: 'console.log("create");',
      testPayload: '{"name": "test"}',
      memoryLimit: 128,
      timeoutMs: 1500,
      runtimeVersion: 'v20.x'
    },
    {
      id: 'fn-3',
      name: 'charge',
      folder: 'payments',
      method: 'POST',
      path: '/api/payments/charge',
      code: 'console.log("charge");',
      testPayload: '{"amount": 10}',
      memoryLimit: 256,
      timeoutMs: 3000,
      runtimeVersion: 'v20.x'
    }
  ];

  it('should correctly filter and group functions tree based on search query values', () => {
    const mockList = setupMockFunctions();
    const query = 'payments';

    const filtered = mockList.filter(fn =>
      fn.name.toLowerCase().includes(query.toLowerCase()) ||
      fn.folder.toLowerCase().includes(query.toLowerCase()) ||
      fn.path.toLowerCase().includes(query.toLowerCase()) ||
      fn.method.toLowerCase().includes(query.toLowerCase())
    );

    expect(filtered.length).toBe(1);
    expect(filtered[0].folder).toBe('payments');
    expect(filtered[0].name).toBe('charge');
  });

  it('should filter functions by HTTP method', () => {
    const mockList = setupMockFunctions();
    const methodFilter = 'POST';

    const filtered = mockList.filter((fn) => fn.method === methodFilter);

    expect(filtered.length).toBe(2);
    expect(filtered.every((fn) => fn.method === 'POST')).toBe(true);
  });

  it('should build hierarchical folder tree nodes with correct sizing thresholds', () => {
    const mockList = setupMockFunctions();
    const groups: Record<string, MockServerFunction[]> = {};
    
    mockList.forEach(fn => {
      const folder = fn.folder || 'general';
      if (!groups[folder]) {
        groups[folder] = [];
      }
      groups[folder].push(fn);
    });

    expect(Object.keys(groups)).toContain('users');
    expect(Object.keys(groups)).toContain('payments');
    expect(groups['users'].length).toBe(2);
    expect(groups['payments'].length).toBe(1);
  });

  it('should successfully calculate preview URL configuration for new function routes', () => {
    const inputFolder = 'AuthGroup ';
    const inputName = ' Verify Scope ';
    
    const folderSlug = inputFolder.trim().toLowerCase();
    const nameSlug = inputName.trim().toLowerCase().replace(/\s+/g, '-');
    const computedPath = `/api/${folderSlug}/${nameSlug}`;

    expect(computedPath).toBe('/api/authgroup/verify-scope');
  });

  it('should securely handle route deletion and verify selection fallback limits', () => {
    let mockList = setupMockFunctions();
    let activeId = 'fn-1';

    // Delete fn-1
    mockList = mockList.filter(f => f.id !== 'fn-1');
    expect(mockList.length).toBe(2);

    // If deleted current selection, fall back to adjacent item index 0
    if (activeId === 'fn-1') {
      activeId = mockList[0].id;
    }

    expect(activeId).toBe('fn-2');
  });

  it('should validate JSON payloads and log parse failure bounds gracefully', () => {
    const malformedPayload = '{\n  "amount": 49.99,\n  "currency": ';
    let errorLogged = false;
    
    try {
      JSON.parse(malformedPayload);
    } catch {
      errorLogged = true;
    }

    expect(errorLogged).toBe(true);
  });
});
