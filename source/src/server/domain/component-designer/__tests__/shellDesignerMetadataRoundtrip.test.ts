import { describe, expect, it } from 'vitest';
import { validShellRecipe } from '../../../../shared/api/contracts/shell-designer/__tests__/shellDesignerTestFixture';
import { parseDraftRecord } from '../draftIo';

const HASH = 'a'.repeat(64);

const record = () => ({
  schema: 'component-designer-draft',
  id: 'shell-draft',
  name: 'my-shell',
  folder: 'portal-layouts',
  document: {
    schemaVersion: '1.0.0',
    id: 'shell-draft',
    name: 'my-shell',
    rootNodeId: 'root',
    nodes: {
      root: { id: 'root', type: 'html.container', props: {}, children: [] },
    },
    metadata: {
      createdAt: '2026-08-03T00:00:00.000Z',
      updatedAt: '2026-08-03T00:00:00.000Z',
      genericDesignerMetadata: { preserved: true },
      shellDesigner: {
        owner: 'shell-designer',
        schemaVersion: '1.0.0',
        registryVersion: '1.0.0',
        generatorVersion: '0.0.0+shell.1',
        experienceMode: 'app',
        recipeId: 'app-classic',
        recipe: validShellRecipe(),
        compiledHash: HASH,
        compiledDocumentHash: HASH,
        managedStructureHash: HASH,
        managedNodeIds: ['ss-0123456789abcdef'],
        customizationState: 'recipe-managed',
        starterLanding: {
          pageKey: 'landing-page',
          routePath: '/landing',
          relationship: 'starter-landing',
        },
      },
    },
    diagnostics: [],
  },
  bindingDefinitions: {},
  metadata: {
    createdAt: '2026-08-03T00:00:00.000Z',
    updatedAt: '2026-08-03T00:00:00.000Z',
    stateVersion: 3,
  },
});

describe('Shell Designer metadata persistence', () => {
  it('preserves typed ownership, starter links, generic metadata and stateVersion', () => {
    const parsed = parseDraftRecord(JSON.parse(JSON.stringify(record())));
    expect(parsed?.metadata.stateVersion).toBe(3);
    expect(parsed?.document.metadata.shellDesigner?.starterLanding).toEqual({
      pageKey: 'landing-page',
      routePath: '/landing',
      relationship: 'starter-landing',
    });
    expect(parsed?.document.metadata.genericDesignerMetadata).toEqual({ preserved: true });
    expect(parseDraftRecord(JSON.parse(JSON.stringify(parsed)))?.document.metadata.shellDesigner?.recipe.identity.shellKey).toBe('my-shell');
  });

  it('throws a stable typed error instead of stripping invalid claimed ownership', () => {
    const invalid = record();
    invalid.document.metadata.shellDesigner.compiledHash = 'not-a-hash';
    expect(() => parseDraftRecord(invalid)).toThrowError(
      expect.objectContaining({ code: 'SHELL_METADATA_INVALID' }),
    );
  });

  it('requires stateVersion only for managed documents', () => {
    const managed = record();
    delete (managed.metadata as { stateVersion?: number }).stateVersion;
    expect(() => parseDraftRecord(managed)).toThrowError(
      expect.objectContaining({ code: 'SHELL_METADATA_INVALID' }),
    );

    const foreign = record();
    delete (foreign.metadata as { stateVersion?: number }).stateVersion;
    delete (foreign.document.metadata as { shellDesigner?: unknown }).shellDesigner;
    expect(parseDraftRecord(foreign)?.metadata.stateVersion).toBeUndefined();
  });
});
