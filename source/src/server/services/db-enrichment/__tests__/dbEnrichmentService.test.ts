import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiSettings } from '../../../../shared/api/contracts/ai/types';
import { HttpError } from '../../../errors/HttpError';
import { aiManager } from '../../../../core/ai/AiManager';
import type { DataSourcesService } from '../../data-sources.service';
import * as dbEnrichmentRepository from '../../../domain/db-enrichment/dbEnrichmentRepository';
import { getEdgeModelStudioMetaBySchemaKey } from '../../data-api/edgeModelStudioMetaStore';
import { readModelStoryFromExtensions } from '../../../../shared/lib/edgeModelStory';
import { assertAiAvailableForEnrichment, draftQuestionAnswer, isAiAvailableForEnrichment, runEnrichment } from '../dbEnrichmentService';
import type { DbEnrichmentJobEnvelope } from '../../../domain/jobs/jobTypes';

vi.mock('../../../../core/ai/AiManager', () => ({
  aiManager: {
    getSettings: vi.fn(),
    processChat: vi.fn(),
    resolveModel: vi.fn((modelId: string) => ({
      entry: {
        id: modelId,
        name: 'GPT Test',
        provider: 'openai',
        modelId: 'gpt-4.1',
        enabled: true,
        capabilities: { chat: true },
      },
    })),
  },
}));

vi.mock('../../../domain/db-enrichment/dbEnrichmentRepository', () => ({
  startRun: vi.fn().mockResolvedValue(undefined),
  appendRunLog: vi.fn().mockResolvedValue(undefined),
  updateRunProgress: vi.fn().mockResolvedValue(undefined),
  completeRun: vi.fn().mockResolvedValue(undefined),
  failRun: vi.fn().mockResolvedValue(undefined),
  upsertKnowledge: vi.fn().mockResolvedValue(undefined),
  getKnowledgeForObject: vi.fn().mockResolvedValue(undefined),
  listKnowledgeForDataSource: vi.fn().mockResolvedValue([]),
  createQuestion: vi.fn().mockResolvedValue(1),
  getQuestion: vi.fn(),
}));

vi.mock('../../data-api/edgeModelStudioMetaStore', () => ({
  getEdgeModelStudioMetaBySchemaKey: vi.fn().mockReturnValue(null),
}));

vi.mock('../../../../shared/lib/edgeModelStory', () => ({
  readModelStoryFromExtensions: vi.fn().mockReturnValue(''),
}));

vi.mock('../../notifications/notificationDispatch', () => ({
  dispatchNotificationForRole: vi.fn().mockResolvedValue(undefined),
}));

const CHAT_MODEL = {
  id: 'gpt-test',
  name: 'GPT Test',
  provider: 'openai' as const,
  modelId: 'gpt-4.1',
  enabled: true,
  capabilities: { chat: true },
};

const enabledSettings = {
  enabled: true,
  defaultModelId: 'gpt-test',
  models: [CHAT_MODEL],
} as unknown as AiSettings;

type FieldRow = { name: string; dataType: string; isPrimaryKey: boolean };

const BASE_USER_PROFILES_FIELDS: FieldRow[] = [
  { name: 'id', dataType: 'bigint', isPrimaryKey: true },
  { name: 'display_name', dataType: 'varchar', isPrimaryKey: false },
  { name: 'nickname', dataType: 'varchar', isPrimaryKey: false },
  { name: 'national_code', dataType: 'varchar', isPrimaryKey: false },
  { name: 'gender_code', dataType: 'varchar', isPrimaryKey: false },
];

const BASE_INFO_FIELDS: FieldRow[] = [
  { name: 'id', dataType: 'varchar', isPrimaryKey: true },
  { name: 'value_fa', dataType: 'varchar', isPrimaryKey: false },
];

const makeFakeDataSourcesService = () => ({
  list: vi.fn().mockReturnValue({
    body: { success: true, items: [{ id: 'ds-1', name: 'Main DB', type: 'PostgreSQL' }], totalCount: 1 },
  }),
  listSchemaCatalog: vi.fn().mockResolvedValue({
    body: { success: true, catalog: { TABLE: ['base_user_profiles'], VIEW: [], PROCEDURE: [], FUNCTION: [] } },
  }),
  listObjectFields: vi.fn().mockImplementation(async (_dataSourceId: string, _objectType: string, objectName: string) => ({
    body: {
      success: true,
      items: objectName === 'base_info' ? BASE_INFO_FIELDS : BASE_USER_PROFILES_FIELDS,
    },
  })),
  listObjectRelations: vi.fn().mockResolvedValue({
    body: {
      success: true,
      data: {
        focusObject: 'base_user_profiles',
        objectType: 'TABLE',
        tables: [],
        relations: [
          { fromTable: 'base_user_profiles', fromColumn: 'gender_code', toTable: 'base_info', toColumn: 'id' },
        ],
      },
    },
  }),
  executeDataSourceQuery: vi.fn().mockImplementation(async ({ sql }: { sql: string }) => {
    if (sql.includes('base_info')) {
      return {
        body: {
          success: true,
          data: [
            { id: '100.1.1', value_fa: 'Male' },
            { id: '100.1.2', value_fa: 'Female' },
          ],
        },
      };
    }
    // nickname's own distinct-value probe: pretend it came back empty (undiscoverable).
    return { body: { success: true, data: [] } };
  }),
}) as unknown as DataSourcesService;

/** Points a fake data-sources service at a single wide table with `columnCount` sampleable int columns, all under one name pattern. */
const setupWideAttrsTable = (
  fakeDataSourcesService: ReturnType<typeof makeFakeDataSourcesService>,
  columnCount: number,
): void => {
  const wideFields: FieldRow[] = [
    { name: 'id', dataType: 'bigint', isPrimaryKey: true },
    ...Array.from({ length: columnCount }, (_, i) => ({ name: `attr_${i + 1}`, dataType: 'int', isPrimaryKey: false })),
  ];

  vi.mocked(fakeDataSourcesService.listSchemaCatalog).mockResolvedValue({
    body: { success: true, catalog: { TABLE: ['wide_attrs'], VIEW: [], PROCEDURE: [], FUNCTION: [] } },
  } as never);
  vi.mocked(fakeDataSourcesService.listObjectFields).mockImplementation(async () => ({
    body: { success: true, items: wideFields },
  }) as never);
  vi.mocked(fakeDataSourcesService.listObjectRelations).mockResolvedValue({
    body: { success: true, data: { focusObject: 'wide_attrs', objectType: 'TABLE', tables: [], relations: [] } },
  } as never);
  vi.mocked(fakeDataSourcesService.executeDataSourceQuery).mockResolvedValue({
    body: { success: true, data: [{ v: 1 }, { v: 2 }, { v: 3 }] },
  } as never);
};

/** Generic mock: echoes back a non-ambiguous answer for whatever columns were actually asked about in this call's prompt. */
const mockProcessChatEchoingRequestedColumns = () => {
  vi.mocked(aiManager.processChat).mockReset().mockImplementation(async (messages) => {
    const content = (messages as { content: string }[])[0]?.content ?? '';
    const columnNames = Array.from(content.matchAll(/^- (\w+) \(/gm)).map((match) => match[1]);
    return JSON.stringify({
      tablePurpose: 'Stores wide attribute data.',
      columns: columnNames.map((name) => ({ columnName: name, meaning: `Meaning of ${name}.`, ambiguous: false })),
    });
  });
};

describe('assertAiAvailableForEnrichment / isAiAvailableForEnrichment', () => {
  const restoreResolveModel = () => {
    vi.mocked(aiManager.resolveModel).mockImplementation((modelId: string) => ({
      entry: {
        id: modelId,
        name: 'GPT Test',
        provider: 'openai',
        modelId: 'gpt-4.1',
        enabled: true,
        capabilities: { chat: true },
      },
    }));
  };

  beforeEach(() => {
    vi.mocked(aiManager.getSettings).mockReset();
    restoreResolveModel();
  });

  it('throws 503 when AI is disabled in platform settings', () => {
    vi.mocked(aiManager.getSettings).mockReturnValue({ ...enabledSettings, enabled: false });
    expect(() => assertAiAvailableForEnrichment()).toThrow(HttpError);
    expect(isAiAvailableForEnrichment()).toBe(false);
  });

  it('throws 503 when no chat-capable model is configured', () => {
    vi.mocked(aiManager.getSettings).mockReturnValue({ ...enabledSettings, models: [] });
    expect(() => assertAiAvailableForEnrichment()).toThrow(HttpError);
    expect(isAiAvailableForEnrichment()).toBe(false);
  });

  it('returns the resolved model id when AI is enabled with a chat model', () => {
    vi.mocked(aiManager.getSettings).mockReturnValue(enabledSettings);
    expect(assertAiAvailableForEnrichment()).toBe('gpt-test');
    expect(isAiAvailableForEnrichment()).toBe(true);
  });

  it('returns the requested chat model when it is available', () => {
    const extra = { ...CHAT_MODEL, id: 'gpt-strong', name: 'GPT Strong' };
    vi.mocked(aiManager.getSettings).mockReturnValue({
      ...enabledSettings,
      models: [CHAT_MODEL, extra],
    } as unknown as AiSettings);
    expect(assertAiAvailableForEnrichment('gpt-strong')).toBe('gpt-strong');
  });

  it('throws 400 when the requested model is not available for chat', () => {
    vi.mocked(aiManager.getSettings).mockReturnValue(enabledSettings);
    vi.mocked(aiManager.resolveModel).mockImplementation(() => {
      throw new Error('unknown model');
    });
    let thrown: unknown;
    try {
      assertAiAvailableForEnrichment('missing-model');
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(HttpError);
    expect((thrown as HttpError).statusCode).toBe(400);
  });
});

describe('runEnrichment', () => {
  let fakeDataSourcesService: ReturnType<typeof makeFakeDataSourcesService>;
  const envelope: DbEnrichmentJobEnvelope = {
    runId: 1,
    dataSourceId: 'ds-1',
    scope: 'FULL',
    title: 'DB enrichment for ds-1',
  };

  beforeEach(() => {
    fakeDataSourcesService = makeFakeDataSourcesService();
    vi.mocked(aiManager.getSettings).mockReset().mockReturnValue(enabledSettings);
    vi.mocked(aiManager.resolveModel).mockImplementation((modelId: string) => ({
      entry: {
        id: modelId,
        name: 'GPT Test',
        provider: 'openai',
        modelId: 'gpt-4.1',
        enabled: true,
        capabilities: { chat: true },
      },
    }));
    vi.mocked(getEdgeModelStudioMetaBySchemaKey).mockReset().mockReturnValue(null);
    vi.mocked(readModelStoryFromExtensions).mockReset().mockReturnValue('');
    vi.mocked(dbEnrichmentRepository.startRun).mockClear();
    vi.mocked(aiManager.processChat).mockReset().mockResolvedValue(JSON.stringify({
      tablePurpose: 'Stores profile details for users.',
      columns: [
        {
          columnName: 'gender_code',
          meaning: "A code identifying the user's gender.",
          valueGlossary: [
            { value: '100.1.1', meaning: 'Male' },
            { value: '100.1.2', meaning: 'Female' },
          ],
          ambiguous: false,
        },
      ],
    }));
    vi.mocked(dbEnrichmentRepository.upsertKnowledge).mockClear();
    vi.mocked(dbEnrichmentRepository.createQuestion).mockClear();
    vi.mocked(dbEnrichmentRepository.listKnowledgeForDataSource).mockReset().mockResolvedValue([]);
  });

  it('fails fast without creating a run when AI is not available at dispatch time', async () => {
    vi.mocked(aiManager.getSettings).mockReturnValue({ ...enabledSettings, enabled: false });

    await expect(runEnrichment(envelope, fakeDataSourcesService)).rejects.toThrow(HttpError);
    expect(dbEnrichmentRepository.startRun).not.toHaveBeenCalled();
  });

  it('uses the envelope modelId instead of the platform default', async () => {
    const extra = { ...CHAT_MODEL, id: 'gpt-strong', name: 'GPT Strong' };
    vi.mocked(aiManager.getSettings).mockReturnValue({
      ...enabledSettings,
      models: [CHAT_MODEL, extra],
    } as unknown as AiSettings);

    await runEnrichment({ ...envelope, modelId: 'gpt-strong' }, fakeDataSourcesService);

    expect(dbEnrichmentRepository.startRun).toHaveBeenCalledWith(1, 'gpt-strong');
    expect(vi.mocked(aiManager.processChat).mock.calls[0][1]).toBe('gpt-strong');
  });

  it('never sends a human-authored column to the LLM (ground-truth precedence)', async () => {
    vi.mocked(getEdgeModelStudioMetaBySchemaKey).mockReturnValue({
      edgeModelId: 'em-1',
      tags: [],
      columnMeta: [
        { columnName: 'display_name', displayLabel: "The user's public display name." },
      ],
      associationMeta: [],
      extensions: {},
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    } as never);

    await runEnrichment(envelope, fakeDataSourcesService);

    const userContent = vi.mocked(aiManager.processChat).mock.calls[0][0].at(-1)?.content ?? '';
    const candidateSection = userContent.slice(userContent.indexOf('Columns needing your help'));
    expect(candidateSection).not.toContain('display_name');

    const knowledgeCall = vi.mocked(dbEnrichmentRepository.upsertKnowledge).mock.calls[0][0];
    const displayNameColumn = knowledgeCall.columns.find((column) => column.columnName === 'display_name');
    expect(displayNameColumn).toMatchObject({
      confidenceBasis: 'human_authored',
      confidence: 1,
      meaning: "The user's public display name.",
    });
  });

  it('resolves an FK lookup column via sampled data at fk_lookup_sampled confidence', async () => {
    await runEnrichment(envelope, fakeDataSourcesService);

    const knowledgeCall = vi.mocked(dbEnrichmentRepository.upsertKnowledge).mock.calls[0][0];
    const genderColumn = knowledgeCall.columns.find((column) => column.columnName === 'gender_code');
    expect(genderColumn).toMatchObject({
      confidenceBasis: 'fk_lookup_sampled',
      confidence: 0.9,
    });
    expect(genderColumn?.valueGlossary).toEqual([
      { value: '100.1.1', meaning: 'Male' },
      { value: '100.1.2', meaning: 'Female' },
    ]);
  });

  it('never samples a sensitive non-FK column and raises a question for it instead', async () => {
    await runEnrichment(envelope, fakeDataSourcesService);

    const sampledSqlCalls = vi.mocked(fakeDataSourcesService.executeDataSourceQuery).mock.calls
      .map(([args]) => (args as { sql: string }).sql);
    expect(sampledSqlCalls.some((sql) => sql.includes('national_code'))).toBe(false);

    expect(dbEnrichmentRepository.createQuestion).toHaveBeenCalledWith(
      expect.objectContaining({ columnName: 'national_code', objectName: 'base_user_profiles' }),
    );

    const knowledgeCall = vi.mocked(dbEnrichmentRepository.upsertKnowledge).mock.calls[0][0];
    const nationalCodeColumn = knowledgeCall.columns.find((column) => column.columnName === 'national_code');
    expect(nationalCodeColumn).toMatchObject({ confidenceBasis: 'unresolved', confidence: 0 });
  });

  it('raises a question when a column has no sample and no name-pattern signal (undiscoverable)', async () => {
    await runEnrichment(envelope, fakeDataSourcesService);

    expect(dbEnrichmentRepository.createQuestion).toHaveBeenCalledWith(
      expect.objectContaining({ columnName: 'nickname', objectName: 'base_user_profiles' }),
    );
  });

  it('raises a question when the LLM itself flags a sampled column as ambiguous', async () => {
    vi.mocked(aiManager.processChat).mockResolvedValue(JSON.stringify({
      tablePurpose: 'Stores profile details for users.',
      columns: [
        {
          columnName: 'gender_code',
          meaning: '',
          ambiguous: true,
          ambiguityReason: 'The sampled values do not map to a clear meaning.',
        },
      ],
    }));

    await runEnrichment(envelope, fakeDataSourcesService);

    expect(dbEnrichmentRepository.createQuestion).toHaveBeenCalledWith(
      expect.objectContaining({ columnName: 'gender_code', kind: 'column_meaning' }),
    );
    const knowledgeCall = vi.mocked(dbEnrichmentRepository.upsertKnowledge).mock.calls[0][0];
    const genderColumn = knowledgeCall.columns.find((column) => column.columnName === 'gender_code');
    expect(genderColumn).toMatchObject({ confidenceBasis: 'unresolved', confidence: 0 });
  });

  it('resolves a column via a majority tie-break pass when the two initial self-consistency passes disagree', async () => {
    vi.mocked(aiManager.processChat)
      .mockReset()
      .mockResolvedValueOnce(JSON.stringify({
        tablePurpose: 'Stores profile details for users.',
        columns: [{ columnName: 'gender_code', meaning: 'A code identifying gender.', ambiguous: false }],
      }))
      .mockResolvedValueOnce(JSON.stringify({
        tablePurpose: 'Stores profile details for users.',
        columns: [{ columnName: 'gender_code', meaning: '', ambiguous: true, ambiguityReason: 'Not confident.' }],
      }))
      .mockResolvedValueOnce(JSON.stringify({
        tablePurpose: 'Stores profile details for users.',
        columns: [{ columnName: 'gender_code', meaning: 'A code identifying gender.', ambiguous: false }],
      }));

    await runEnrichment(envelope, fakeDataSourcesService);

    // 2 initial self-consistency passes (disagree) + 1 shared tie-break pass - no wasted extra calls.
    expect(aiManager.processChat).toHaveBeenCalledTimes(3);
    expect(dbEnrichmentRepository.createQuestion).not.toHaveBeenCalledWith(
      expect.objectContaining({ columnName: 'gender_code' }),
    );
    const knowledgeCall = vi.mocked(dbEnrichmentRepository.upsertKnowledge).mock.calls[0][0];
    const genderColumn = knowledgeCall.columns.find((column) => column.columnName === 'gender_code');
    // Resolved only via the tie-break pass, not immediate unanimous agreement, so confidence is
    // discounted from the basis value (0.9 * TIE_BREAK_CONFIDENCE_DISCOUNT of 0.9 = 0.81).
    expect(genderColumn).toMatchObject({
      confidenceBasis: 'fk_lookup_sampled',
      confidence: 0.81,
      meaning: 'A code identifying gender.',
    });
  });

  it('treats two "not ambiguous" passes that describe different things as a tie, and resolves via tie-break agreement', async () => {
    vi.mocked(aiManager.processChat)
      .mockReset()
      .mockResolvedValueOnce(JSON.stringify({
        tablePurpose: 'Stores profile details for users.',
        columns: [{ columnName: 'gender_code', meaning: "A code identifying the user's gender.", ambiguous: false }],
      }))
      .mockResolvedValueOnce(JSON.stringify({
        tablePurpose: 'Stores profile details for users.',
        columns: [{ columnName: 'gender_code', meaning: "The customer's subscription billing tier.", ambiguous: false }],
      }))
      .mockResolvedValueOnce(JSON.stringify({
        tablePurpose: 'Stores profile details for users.',
        columns: [{ columnName: 'gender_code', meaning: "A code identifying the user's gender.", ambiguous: false }],
      }));

    await runEnrichment(envelope, fakeDataSourcesService);

    // Both initial passes said "not ambiguous", but they disagreed on the actual meaning - that
    // still counts as a tie and pulls in the shared tie-break pass, which then breaks 2-to-1.
    expect(aiManager.processChat).toHaveBeenCalledTimes(3);
    expect(dbEnrichmentRepository.createQuestion).not.toHaveBeenCalledWith(
      expect.objectContaining({ columnName: 'gender_code' }),
    );
    const knowledgeCall = vi.mocked(dbEnrichmentRepository.upsertKnowledge).mock.calls[0][0];
    const genderColumn = knowledgeCall.columns.find((column) => column.columnName === 'gender_code');
    expect(genderColumn).toMatchObject({
      confidenceBasis: 'fk_lookup_sampled',
      meaning: "A code identifying the user's gender.",
    });
  });

  it('falls back to ambiguous with a semantic-disagreement reason when passes never converge on the same meaning', async () => {
    vi.mocked(aiManager.processChat)
      .mockReset()
      .mockResolvedValueOnce(JSON.stringify({
        tablePurpose: 'Stores profile details for users.',
        columns: [{ columnName: 'gender_code', meaning: "A code identifying the user's gender.", ambiguous: false }],
      }))
      .mockResolvedValueOnce(JSON.stringify({
        tablePurpose: 'Stores profile details for users.',
        columns: [{ columnName: 'gender_code', meaning: "The customer's subscription billing tier.", ambiguous: false }],
      }))
      .mockResolvedValueOnce(JSON.stringify({
        tablePurpose: 'Stores profile details for users.',
        columns: [{ columnName: 'gender_code', meaning: 'An internal processing priority flag.', ambiguous: false }],
      }));

    await runEnrichment(envelope, fakeDataSourcesService);

    expect(aiManager.processChat).toHaveBeenCalledTimes(3);
    expect(dbEnrichmentRepository.createQuestion).toHaveBeenCalledWith(
      expect.objectContaining({
        columnName: 'gender_code',
        reason: ["Repeated attempts to determine this column's meaning produced different, disagreeing answers, so it needs human confirmation."],
      }),
    );
    const knowledgeCall = vi.mocked(dbEnrichmentRepository.upsertKnowledge).mock.calls[0][0];
    const genderColumn = knowledgeCall.columns.find((column) => column.columnName === 'gender_code');
    expect(genderColumn).toMatchObject({ confidenceBasis: 'unresolved', confidence: 0 });
  });

  it('falls back to ambiguous when the tie-break pass does not produce a majority either', async () => {
    vi.mocked(aiManager.processChat)
      .mockReset()
      .mockResolvedValueOnce(JSON.stringify({
        tablePurpose: 'Stores profile details for users.',
        columns: [{ columnName: 'gender_code', meaning: 'A code identifying gender.', ambiguous: false }],
      }))
      .mockResolvedValueOnce(JSON.stringify({
        tablePurpose: 'Stores profile details for users.',
        columns: [{ columnName: 'gender_code', meaning: '', ambiguous: true, ambiguityReason: 'Not confident.' }],
      }))
      .mockResolvedValueOnce(JSON.stringify({
        tablePurpose: 'Stores profile details for users.',
        columns: [{ columnName: 'gender_code', meaning: '', ambiguous: true, ambiguityReason: 'Still not confident.' }],
      }));

    await runEnrichment(envelope, fakeDataSourcesService);

    expect(aiManager.processChat).toHaveBeenCalledTimes(3);
    expect(dbEnrichmentRepository.createQuestion).toHaveBeenCalledWith(
      expect.objectContaining({
        columnName: 'gender_code',
        reason: ["Repeated attempts to determine this column's meaning did not agree with each other, so it needs human confirmation."],
      }),
    );
    const knowledgeCall = vi.mocked(dbEnrichmentRepository.upsertKnowledge).mock.calls[0][0];
    const genderColumn = knowledgeCall.columns.find((column) => column.columnName === 'gender_code');
    expect(genderColumn).toMatchObject({ confidenceBasis: 'unresolved', confidence: 0 });
  });

  it('chunks LLM candidates into multiple batches instead of silently dropping columns past a fixed cap', async () => {
    setupWideAttrsTable(fakeDataSourcesService, 12);
    mockProcessChatEchoingRequestedColumns();

    await runEnrichment(envelope, fakeDataSourcesService);

    // 12 candidates chunked into batches of 10 -> 2 batches, x2 self-consistency passes each.
    expect(aiManager.processChat).toHaveBeenCalledTimes(4);

    const knowledgeCall = vi.mocked(dbEnrichmentRepository.upsertKnowledge).mock.calls[0][0];
    expect(knowledgeCall.columns).toHaveLength(12);
    expect(knowledgeCall.columns.every((column) => column.confidenceBasis !== 'unresolved')).toBe(true);
  });

  it('feeds already-resolved column meanings from an earlier batch as context into a later batch of the same table', async () => {
    setupWideAttrsTable(fakeDataSourcesService, 12);
    mockProcessChatEchoingRequestedColumns();

    await runEnrichment(envelope, fakeDataSourcesService);

    const allContents = vi.mocked(aiManager.processChat).mock.calls
      .map(([messages]) => (messages as { content: string }[])[0]?.content ?? '');
    const firstBatchCalls = allContents.filter((content) => content.includes('- attr_1 ('));
    const secondBatchCalls = allContents.filter((content) => content.includes('- attr_11 ('));

    expect(firstBatchCalls.length).toBeGreaterThan(0);
    expect(firstBatchCalls.every((content) => content.includes('(none yet)'))).toBe(true);

    expect(secondBatchCalls.length).toBeGreaterThan(0);
    expect(secondBatchCalls.every((content) => content.includes('attr_1: Meaning of attr_1.'))).toBe(true);
  });

  it('splits a batch and retries the halves when the whole batch call fails outright, instead of giving up on it', async () => {
    setupWideAttrsTable(fakeDataSourcesService, 12);

    vi.mocked(aiManager.processChat).mockReset().mockImplementation(async (messages) => {
      const content = (messages as { content: string }[])[0]?.content ?? '';
      const columnNames = Array.from(content.matchAll(/^- (\w+) \(/gm)).map((match) => match[1]);
      if (columnNames.length > 1) {
        throw new Error('simulated context-window overflow for this batch size');
      }
      return JSON.stringify({
        tablePurpose: 'Stores wide attribute data.',
        columns: columnNames.map((name) => ({ columnName: name, meaning: `Meaning of ${name}.`, ambiguous: false })),
      });
    });

    await runEnrichment(envelope, fakeDataSourcesService);

    const knowledgeCall = vi.mocked(dbEnrichmentRepository.upsertKnowledge).mock.calls[0][0];
    expect(knowledgeCall.columns).toHaveLength(12);
    expect(knowledgeCall.columns.every((column) => column.confidenceBasis !== 'unresolved')).toBe(true);
  });

  it('treats agreeing meanings with conflicting value-glossary labels as unresolved, not silently accepted', async () => {
    vi.mocked(aiManager.processChat)
      .mockReset()
      .mockResolvedValueOnce(JSON.stringify({
        tablePurpose: 'Stores profile details for users.',
        columns: [{
          columnName: 'gender_code',
          meaning: 'A code identifying gender.',
          ambiguous: false,
          valueGlossary: [{ value: '100.1.1', meaning: 'Male' }, { value: '100.1.2', meaning: 'Female' }],
        }],
      }))
      .mockResolvedValueOnce(JSON.stringify({
        tablePurpose: 'Stores profile details for users.',
        columns: [{
          columnName: 'gender_code',
          meaning: 'A code identifying gender.',
          ambiguous: false,
          valueGlossary: [{ value: '100.1.1', meaning: 'Active' }, { value: '100.1.2', meaning: 'Inactive' }],
        }],
      }))
      .mockResolvedValueOnce(JSON.stringify({
        tablePurpose: 'Stores profile details for users.',
        columns: [{
          columnName: 'gender_code',
          meaning: 'A code identifying gender.',
          ambiguous: false,
          valueGlossary: [{ value: '100.1.1', meaning: 'Enabled' }, { value: '100.1.2', meaning: 'Disabled' }],
        }],
      }));

    await runEnrichment(envelope, fakeDataSourcesService);

    // Meaning text agreed every time, but the tie-break pass was still triggered (and still
    // couldn't settle it) because the sampled values were mapped to different labels each time.
    expect(aiManager.processChat).toHaveBeenCalledTimes(3);
    expect(dbEnrichmentRepository.createQuestion).toHaveBeenCalledWith(
      expect.objectContaining({
        columnName: 'gender_code',
        reason: ['The agreed-upon meaning is consistent, but the sampled values were mapped to conflicting labels across attempts, so it needs human confirmation.'],
      }),
    );
    const knowledgeCall = vi.mocked(dbEnrichmentRepository.upsertKnowledge).mock.calls[0][0];
    const genderColumn = knowledgeCall.columns.find((column) => column.columnName === 'gender_code');
    expect(genderColumn).toMatchObject({ confidenceBasis: 'unresolved', confidence: 0 });
  });

  it('injects cross-table context for same-named columns already resolved elsewhere in the data source', async () => {
    setupWideAttrsTable(fakeDataSourcesService, 3);
    mockProcessChatEchoingRequestedColumns();
    vi.mocked(dbEnrichmentRepository.listKnowledgeForDataSource).mockResolvedValue([
      {
        dataSourceId: 'ds-1',
        objectType: 'TABLE',
        objectName: 'other_table',
        tablePurpose: null,
        tableConfidence: 0.9,
        columns: [
          { columnName: 'attr_1', meaning: 'Pre-known meaning of attr_1.', confidence: 0.9, confidenceBasis: 'value_sampled' },
        ],
        relations: [],
        sourceOfTruth: 'INFERRED',
        lastEnrichedRunId: null,
      },
    ] as never);

    await runEnrichment(envelope, fakeDataSourcesService);

    const allContents = vi.mocked(aiManager.processChat).mock.calls
      .map(([messages]) => (messages as { content: string }[])[0]?.content ?? '');
    expect(allContents.some((content) => content.includes('attr_1: Pre-known meaning of attr_1.'))).toBe(true);
  });

  it("enriches the FK relationship line with the target column's already-known meaning", async () => {
    vi.mocked(dbEnrichmentRepository.listKnowledgeForDataSource).mockResolvedValue([
      {
        dataSourceId: 'ds-1',
        objectType: 'TABLE',
        objectName: 'base_info',
        tablePurpose: null,
        tableConfidence: 0.9,
        columns: [
          { columnName: 'id', meaning: 'Generic lookup code identifier.', confidence: 0.9, confidenceBasis: 'value_sampled' },
        ],
        relations: [],
        sourceOfTruth: 'INFERRED',
        lastEnrichedRunId: null,
      },
    ] as never);

    await runEnrichment(envelope, fakeDataSourcesService);

    const userContent = vi.mocked(aiManager.processChat).mock.calls[0][0].at(-1)?.content ?? '';
    expect(userContent).toContain('gender_code -> base_info.id (Generic lookup code identifier.)');
  });

  it('samples non-FK columns by frequency and never fully discards a high-cardinality column past the old fixed cap', async () => {
    setupWideAttrsTable(fakeDataSourcesService, 1);
    const manyRows = Array.from({ length: 41 }, (_, i) => ({ value: `code-${i}`, frequency: 41 - i }));
    vi.mocked(fakeDataSourcesService.executeDataSourceQuery).mockResolvedValue({
      body: { success: true, data: manyRows },
    } as never);
    mockProcessChatEchoingRequestedColumns();

    await runEnrichment(envelope, fakeDataSourcesService);

    const sampledSqlCalls = vi.mocked(fakeDataSourcesService.executeDataSourceQuery).mock.calls
      .map(([args]) => (args as { sql: string }).sql);
    expect(sampledSqlCalls.some((sql) => sql.includes('GROUP BY') && sql.includes('ORDER BY COUNT(*) DESC'))).toBe(true);

    // Previously, more than MAX_DISTINCT_VALUES rows meant the column was abandoned entirely (undiscoverable).
    expect(dbEnrichmentRepository.createQuestion).not.toHaveBeenCalledWith(
      expect.objectContaining({ columnName: 'attr_1', kind: 'value_glossary' }),
    );

    const allContents = vi.mocked(aiManager.processChat).mock.calls
      .map(([messages]) => (messages as { content: string }[])[0]?.content ?? '');
    const withSample = allContents.find((content) => content.includes('"code-0"×41'));
    expect(withSample).toBeDefined();
    expect(withSample).toContain('showing only the most frequent values');
  });
});

describe('draftQuestionAnswer', () => {
  const openQuestion = {
    id: 42,
    dataSourceId: 'ds-1',
    runId: 1,
    objectType: 'TABLE' as const,
    objectName: 'cms_contents',
    columnName: 'body',
    kind: 'value_glossary' as const,
    question: "What does the 'body' column on 'cms_contents' mean?",
    reason: ['No foreign key found for this column.'],
    candidates: [],
    status: 'open' as const,
    answer: null,
    answeredBy: null,
    answeredAt: null,
    createdAt: '2026-08-28T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.mocked(aiManager.getSettings).mockReturnValue(enabledSettings);
    vi.mocked(aiManager.processChat).mockReset().mockResolvedValue('HTML body of the CMS page.');
    vi.mocked(dbEnrichmentRepository.getQuestion).mockReset().mockResolvedValue(openQuestion);
    vi.mocked(dbEnrichmentRepository.getKnowledgeForObject).mockReset().mockResolvedValue(undefined);
    vi.mocked(dbEnrichmentRepository.upsertKnowledge).mockClear();
  });

  it('returns a draft without persisting the answer', async () => {
    const draft = await draftQuestionAnswer(42, 'gpt-test');
    expect(draft).toBe('HTML body of the CMS page.');
    expect(aiManager.processChat).toHaveBeenCalledOnce();
    expect(dbEnrichmentRepository.upsertKnowledge).not.toHaveBeenCalled();
  });

  it('throws 404 when the question is missing', async () => {
    vi.mocked(dbEnrichmentRepository.getQuestion).mockResolvedValue(undefined);
    await expect(draftQuestionAnswer(99)).rejects.toMatchObject({ statusCode: 404 });
  });
});
