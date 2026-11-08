import { describe, expect, it } from 'vitest';
import {
  isWorkerAllowedForOperation,
  resolveWorkerRoleForOperation,
} from '../engineeringOrchestratorScaffold';

describe('engineeringOrchestratorScaffold', () => {
  it('maps server function operations to ServerEngineering worker', () => {
    expect(resolveWorkerRoleForOperation('CREATE_SERVER_FUNCTION')).toBe('ServerEngineering');
    expect(isWorkerAllowedForOperation('ServerEngineering', 'CREATE_SERVER_FUNCTION')).toBe(true);
    expect(isWorkerAllowedForOperation('UIEngineering', 'CREATE_SERVER_FUNCTION')).toBe(false);
  });
});
