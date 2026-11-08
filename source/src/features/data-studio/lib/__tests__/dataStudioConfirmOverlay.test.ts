import { describe, expect, it } from 'vitest';
import {
  buildDataStudioDeleteApiOverlayToken,
  buildDataStudioDeleteObjectOverlayToken,
  parseDataStudioConfigureApiOverlayToken,
  parseDataStudioDeleteApiOverlayToken,
  resolveDataStudioWorkspaceOverlayToken,
} from '../dataStudioConfirmOverlay';

describe('dataStudioConfirmOverlay', () => {
  it('builds and parses delete API tokens', () => {
    const token = buildDataStudioDeleteApiOverlayToken('api-1');
    expect(parseDataStudioDeleteApiOverlayToken(token)).toBe('api-1');
  });

  it('builds object-scoped delete tokens', () => {
    const token = buildDataStudioDeleteObjectOverlayToken('TABLE', 'Orders');
    expect(token).toBe('dialog/delete-object/TABLE/Orders');
  });

  it('parses configure API create vs edit', () => {
    expect(parseDataStudioConfigureApiOverlayToken('dialog/configure-api/create')).toBe('create');
    expect(parseDataStudioConfigureApiOverlayToken('dialog/configure-api/abc')).toBe('abc');
  });

  it('prefers confirm dialogs over floating panels', () => {
    const token = resolveDataStudioWorkspaceOverlayToken({
      createObjectDialogOpen: false,
      designerPanels: [{ zOrder: 10 }],
      datasheetPanels: [],
      relationsPanels: [],
      sqlPanels: [],
      runPanels: [],
      syncModelsOpen: false,
      deleteApiTarget: { id: 'x' } as never,
      deleteObjectTarget: null,
      truncateTableTarget: null,
      configureApiTarget: null,
      configureFunctionApiTarget: null,
    });
    expect(token).toBe('dialog/delete-api/x');
  });
});
