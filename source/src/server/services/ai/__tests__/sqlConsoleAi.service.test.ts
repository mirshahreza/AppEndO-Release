import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiSettings } from '../../../../shared/api/contracts/ai/types';
import { HttpError } from '../../../errors/HttpError';
import { aiManager } from '../../../../core/ai/AiManager';
import type { DataSourcesService } from '../../data-sources.service';
import { SqlConsoleAiService } from '../sqlConsoleAi.service';

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

const makeFakeDataSourcesService = () => ({
  list: vi.fn().mockReturnValue({
    body: {
      success: true,
      items: [{ id: 'ds-1', name: 'Main DB', type: 'PostgreSQL' }],
      totalCount: 1,
    },
  }),
  listSchemaCatalog: vi.fn().mockResolvedValue({
    body: {
      success: true,
      catalog: {
        TABLE: ['users', 'orders'],
        VIEW: [],
        PROCEDURE: [],
        FUNCTION: [],
      },
    },
  }),
  listObjectFields: vi.fn().mockResolvedValue({
    body: {
      success: true,
      items: [
        { name: 'id', dataType: 'int', isPrimaryKey: true },
        { name: 'email', dataType: 'varchar', isPrimaryKey: false },
      ],
    },
  }),
  listObjectRelations: vi.fn().mockResolvedValue({
    body: {
      success: true,
      data: { focusObject: 'orders', objectType: 'TABLE', tables: [], relations: [] },
    },
  }),
  executeDataSourceQuery: vi.fn().mockResolvedValue({
    body: { success: true, data: [], count: 0, truncated: false },
  }),
}) as unknown as DataSourcesService;

describe('SqlConsoleAiService', () => {
  let fakeDataSourcesService: ReturnType<typeof makeFakeDataSourcesService>;
  let service: SqlConsoleAiService;

  beforeEach(() => {
    fakeDataSourcesService = makeFakeDataSourcesService();
    service = new SqlConsoleAiService(fakeDataSourcesService);
    vi.mocked(aiManager.getSettings).mockReset().mockReturnValue(enabledSettings);
    vi.mocked(aiManager.processChat).mockReset().mockResolvedValue(
      '{"text":"Here are the newest users","commands":["SELECT id, email FROM users ORDER BY id DESC"]}',
    );
  });

  it('requires prompt', async () => {
    await expect(service.assist({ prompt: '   ' })).rejects.toMatchObject({
      statusCode: 400,
      message: 'prompt is required.',
    } satisfies Partial<HttpError>);
  });

  it('answers without touching the schema when no data source is connected', async () => {
    const result = await service.assist({ prompt: 'show me the users' });

    expect(result.body.commands).toEqual(['SELECT id, email FROM users ORDER BY id DESC']);
    expect(fakeDataSourcesService.listSchemaCatalog).not.toHaveBeenCalled();
    expect(aiManager.processChat).toHaveBeenCalledWith(
      expect.any(Array),
      'gpt-test',
      expect.stringContaining('read-only SQL assistant'),
    );
    const userContent = vi.mocked(aiManager.processChat).mock.calls[0][0].at(-1)?.content ?? '';
    expect(userContent).toContain('No data source is connected');
  });

  it('embeds the schema summary for the given data source', async () => {
    const result = await service.assist({
      prompt: 'newest users by id',
      dataSourceId: 'ds-1',
      sqlSnapshot: 'SELECT 1',
    });

    expect(fakeDataSourcesService.listSchemaCatalog).toHaveBeenCalledWith('ds-1');
    expect(result.body.text).toBe('Here are the newest users');
    expect(result.body.commands).toEqual(['SELECT id, email FROM users ORDER BY id DESC']);

    const userContent = vi.mocked(aiManager.processChat).mock.calls[0][0].at(-1)?.content ?? '';
    expect(userContent).toContain('Target database dialect: PostgreSQL');
    expect(userContent).toContain('TABLE users (id PK:int, email:varchar)');
  });

  it('embeds foreign-key relationships so the model can join correctly', async () => {
    fakeDataSourcesService.listObjectRelations = vi.fn().mockImplementation((_id: string, _type: string, name: string) => Promise.resolve({
      body: {
        success: true,
        data: {
          focusObject: name,
          objectType: 'TABLE',
          tables: [],
          relations: name === 'orders'
            ? [{ fromTable: 'orders', fromColumn: 'user_id', toTable: 'users', toColumn: 'id' }]
            : [],
        },
      },
    }));

    await service.assist({ prompt: 'orders for a user', dataSourceId: 'ds-1' });

    const userContent = vi.mocked(aiManager.processChat).mock.calls[0][0].at(-1)?.content ?? '';
    expect(userContent).toContain('Relationships (foreign keys');
    expect(userContent).toContain('orders.user_id->users.id');
  });

  it('samples actual rows from a small foreign-key-target lookup table, generically (no gender/base_info hardcoding)', async () => {
    fakeDataSourcesService.listSchemaCatalog = vi.fn().mockResolvedValue({
      body: { success: true, catalog: { TABLE: ['orders', 'statuses'], VIEW: [], PROCEDURE: [], FUNCTION: [] } },
    });
    fakeDataSourcesService.listObjectFields = vi.fn().mockImplementation((_id: string, _type: string, name: string) => Promise.resolve({
      body: {
        success: true,
        items: name === 'statuses'
          ? [{ name: 'id', dataType: 'text', isPrimaryKey: true }, { name: 'label', dataType: 'text', isPrimaryKey: false }]
          : [{ name: 'id', dataType: 'int', isPrimaryKey: true }, { name: 'status_code', dataType: 'text', isPrimaryKey: false }],
      },
    }));
    fakeDataSourcesService.listObjectRelations = vi.fn().mockImplementation((_id: string, _type: string, name: string) => Promise.resolve({
      body: {
        success: true,
        data: {
          focusObject: name,
          objectType: 'TABLE',
          tables: [],
          relations: name === 'orders'
            ? [{ fromTable: 'orders', fromColumn: 'status_code', toTable: 'statuses', toColumn: 'id' }]
            : [],
        },
      },
    }));
    fakeDataSourcesService.executeDataSourceQuery = vi.fn().mockResolvedValue({
      body: {
        success: true,
        data: [{ id: 'S1', label: 'Open' }, { id: 'S2', label: 'Closed' }],
        count: 2,
        truncated: false,
      },
    });

    await service.assist({ prompt: 'orders that are open', dataSourceId: 'ds-1' });

    expect(fakeDataSourcesService.executeDataSourceQuery).toHaveBeenCalledWith({
      dataSourceId: 'ds-1',
      sql: 'SELECT * FROM statuses WHERE id IN (SELECT DISTINCT status_code FROM orders WHERE status_code IS NOT NULL) LIMIT 31',
    });
    const userContent = vi.mocked(aiManager.processChat).mock.calls[0][0].at(-1)?.content ?? '';
    expect(userContent).toContain('Reference data for statuses');
    expect(userContent).toContain('"label":"Open"');
  });

  it('never samples row data from a foreign-key-target table with a sensitive-looking column', async () => {
    fakeDataSourcesService.listSchemaCatalog = vi.fn().mockResolvedValue({
      body: { success: true, catalog: { TABLE: ['orders', 'base_users'], VIEW: [], PROCEDURE: [], FUNCTION: [] } },
    });
    fakeDataSourcesService.listObjectFields = vi.fn().mockImplementation((_id: string, _type: string, name: string) => Promise.resolve({
      body: {
        success: true,
        items: name === 'base_users'
          ? [{ name: 'id', dataType: 'int', isPrimaryKey: true }, { name: 'password_hash', dataType: 'text', isPrimaryKey: false }]
          : [{ name: 'id', dataType: 'int', isPrimaryKey: true }, { name: 'created_by', dataType: 'int', isPrimaryKey: false }],
      },
    }));
    fakeDataSourcesService.listObjectRelations = vi.fn().mockImplementation((_id: string, _type: string, name: string) => Promise.resolve({
      body: {
        success: true,
        data: {
          focusObject: name,
          objectType: 'TABLE',
          tables: [],
          relations: name === 'orders'
            ? [{ fromTable: 'orders', fromColumn: 'created_by', toTable: 'base_users', toColumn: 'id' }]
            : [],
        },
      },
    }));
    const executeSpy = vi.fn().mockResolvedValue({ body: { success: true, data: [], count: 0, truncated: false } });
    fakeDataSourcesService.executeDataSourceQuery = executeSpy;

    await service.assist({ prompt: 'orders created by me', dataSourceId: 'ds-1' });

    expect(executeSpy).not.toHaveBeenCalled();
    const userContent = vi.mocked(aiManager.processChat).mock.calls[0][0].at(-1)?.content ?? '';
    expect(userContent).not.toContain('Reference data for base_users');
  });

  it('ranks by relevance and bounds column lookups for a huge schema, without hiding any table name', async () => {
    const bigTableNames = Array.from({ length: 250 }, (_, i) => `table_${i}`);
    bigTableNames.push('invoices');
    fakeDataSourcesService.listSchemaCatalog = vi.fn().mockResolvedValue({
      body: {
        success: true,
        catalog: { TABLE: bigTableNames, VIEW: [], PROCEDURE: [], FUNCTION: [] },
      },
    });

    const result = await service.assist({ prompt: 'list recent invoices', dataSourceId: 'ds-1' });

    expect(result.body.commands).toEqual(['SELECT id, email FROM users ORDER BY id DESC']);
    const fieldCalls = vi.mocked(fakeDataSourcesService.listObjectFields).mock.calls;
    expect(fieldCalls.length).toBeLessThanOrEqual(80);
    expect(fieldCalls.some((call) => call[2] === 'invoices')).toBe(true);

    const userContent = vi.mocked(aiManager.processChat).mock.calls[0][0].at(-1)?.content ?? '';
    expect(userContent).toContain('TABLE invoices (');
    expect(userContent).toContain('Other tables/views without columns shown here');
    expect(userContent).toContain('table_0');
  });

  it('drops suggested SQL that is not read-only', async () => {
    vi.mocked(aiManager.processChat).mockResolvedValue(
      '{"text":"Done","commands":["DROP TABLE users"]}',
    );

    const result = await service.assist({ prompt: 'delete the users table' });

    expect(result.body.commands).toEqual([]);
    expect(result.body.text).toContain('withheld');
  });

  it('feeds the previous query result back in so the model uses real values instead of re-guessing', async () => {
    await service.assist({
      prompt: 'now filter to just the males using that code',
      dataSourceId: 'ds-1',
      previousResultPreview: 'Query: SELECT DISTINCT gender_code, title FROM x\nRows (1): [{"gender_code":"100.1.1","title":"Male"}]',
    });

    const userContent = vi.mocked(aiManager.processChat).mock.calls[0][0].at(-1)?.content ?? '';
    expect(userContent).toContain('Result of the most recent query the operator ran');
    expect(userContent).toContain('100.1.1');
  });

  it('keeps write commands when allowWrite is true, but still drops DDL', async () => {
    vi.mocked(aiManager.processChat).mockResolvedValue(
      `{"text":"Updating the record","commands":["UPDATE users SET email = 'x@y.test' WHERE id = 1", "DROP TABLE users"]}`,
    );

    const result = await service.assist({ prompt: 'update user 1 email', dataSourceId: 'ds-1', allowWrite: true });

    expect(result.body.commands).toEqual(["UPDATE users SET email = 'x@y.test' WHERE id = 1"]);
    expect(aiManager.processChat).toHaveBeenCalledWith(
      expect.any(Array),
      'gpt-test',
      expect.stringContaining('read-and-write SQL assistant'),
    );
  });

  it('filters out write commands when allowWrite is not set, using the read-only prompt', async () => {
    vi.mocked(aiManager.processChat).mockResolvedValue(
      `{"text":"Here","commands":["UPDATE users SET email = 'x@y.test' WHERE id = 1"]}`,
    );

    const result = await service.assist({ prompt: 'update user 1 email', dataSourceId: 'ds-1' });

    expect(result.body.commands).toEqual([]);
    expect(aiManager.processChat).toHaveBeenCalledWith(
      expect.any(Array),
      'gpt-test',
      expect.stringContaining('read-only SQL assistant'),
    );
  });

  it('rejects an unknown data source', async () => {
    await expect(service.assist({ prompt: 'x', dataSourceId: 'missing' })).rejects.toMatchObject({
      statusCode: 404,
    } satisfies Partial<HttpError>);
  });
});
