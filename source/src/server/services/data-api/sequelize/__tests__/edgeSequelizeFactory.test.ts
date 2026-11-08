import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { Sequelize } from 'sequelize';
import type { SchemaFieldInfo } from '../../../../utils/dataSourceSchemaIntrospection';
import {
  buildDynamicModelAttributes,
  buildModelDefinitionDraft,
  defineDynamicModel,
  resolvePrimaryKeyFromFields,
} from '../buildDynamicModel';
import { buildSequelizeOptions } from '../dialectConfig';
import { EdgeSequelizeFactory, resetEdgeSequelizeFactoryCache } from '../edgeSequelizeFactory';
import type { StoredDataSource } from '../../../../db/dataSourcesStore';

const sampleFields: SchemaFieldInfo[] = [
  {
    name: 'id',
    dataType: 'INTEGER',
    suggestedFieldType: 'integer',
    nullable: false,
    isPrimaryKey: true,
  },
  {
    name: 'name',
    dataType: 'TEXT',
    suggestedFieldType: 'string',
    nullable: false,
    isPrimaryKey: false,
  },
];

describe('buildDynamicModel', () => {
  it('maps introspection fields to edge model columns and primary key', () => {
    const draft = buildModelDefinitionDraft({
      dataSourceId: 'ds_sqlite',
      objectName: 'widgets',
      fields: sampleFields,
    });

    expect(draft.columns).toHaveLength(2);
    expect(draft.primaryKey).toBe('id');
    expect(draft.sequelize.modelName).toBe('Widgets');
    expect(resolvePrimaryKeyFromFields(sampleFields)).toBe('id');
  });

  it('builds Sequelize attributes for dynamic define', () => {
    const draft = buildModelDefinitionDraft({
      dataSourceId: 'ds_sqlite',
      objectName: 'widgets',
      fields: sampleFields,
    });
    const attributes = buildDynamicModelAttributes(draft.columns, draft.primaryKey);
    expect(attributes.id).toBeTruthy();
    expect(attributes.name).toBeTruthy();
  });
});

describe('EdgeSequelizeFactory sqlite smoke', () => {
  let tmpDir = '';
  let dbPath = '';

  afterEach(async () => {
    await resetEdgeSequelizeFactoryCache();
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('defines a model and runs findAll with limit', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sea0-sqlite-'));
    dbPath = path.join(tmpDir, 'widgets.sqlite');

    const sqlite = new Database(dbPath);
    sqlite.exec(`
      CREATE TABLE widgets (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL
      );
      INSERT INTO widgets (id, name) VALUES (1, 'Alpha'), (2, 'Beta');
    `);
    sqlite.close();

    const source: StoredDataSource = {
      id: 'ds_sqlite_local',
      name: 'SQLite Local',
      type: 'SQLite',
      host: 'localhost',
      port: 0,
      database: dbPath,
      status: 'connected',
      isDefault: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const options = buildSequelizeOptions(source);
    expect(options.dialect).toBe('sqlite');

    const factory = new EdgeSequelizeFactory({
      getDataSources: () => [source],
    });

    const sequelize = await factory.getOrCreate(source.id);
    const draft = buildModelDefinitionDraft({
      dataSourceId: source.id,
      objectName: 'widgets',
      fields: sampleFields,
    });

    const Model = defineDynamicModel(sequelize, {
      sequelize: draft.sequelize,
      columns: draft.columns,
      primaryKey: draft.primaryKey,
      objectType: 'TABLE',
    });

    const rows = await Model.findAll({ limit: 10 });
    expect(rows).toHaveLength(2);
    expect(rows[0].get('name')).toBe('Alpha');
  });

  it('creates independent Sequelize pool config from StoredDataSource credentials', () => {
    const source: StoredDataSource = {
      id: 'ds_pg',
      name: 'Postgres',
      type: 'PostgreSQL',
      host: 'localhost',
      port: 5432,
      database: 'append',
      username: 'postgres',
      password: 'secret',
      status: 'connected',
      isDefault: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const options = buildSequelizeOptions(source);
    expect(options.dialect).toBe('postgres');
    expect((options.pool as { max?: number })?.max).toBe(5);
  });
});
