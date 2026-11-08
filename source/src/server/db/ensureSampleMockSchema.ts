import type { ControlPlaneDatabaseSettings, ControlPlaneDbProvider } from './controlPlaneDatabase';
import { getPrismaControlPlane } from './prismaControlPlane';

const SAMPLE_MOCK_TABLE = 'base_sample_mock_statuses';

const POSTGRES_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS base_sample_mock_statuses (
    id BIGSERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by BIGINT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by BIGINT
  )`,
  `CREATE TABLE IF NOT EXISTS base_sample_mock_people (
    id BIGSERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by BIGINT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by BIGINT
  )`,
  `CREATE TABLE IF NOT EXISTS base_sample_mock_tags (
    id BIGSERIAL PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by BIGINT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by BIGINT
  )`,
  `CREATE TABLE IF NOT EXISTS base_sample_mock_records (
    id BIGSERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    subtitle TEXT,
    website TEXT,
    photo TEXT,
    parent_id BIGINT,
    status_id BIGINT NOT NULL,
    owner_id BIGINT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    locked BOOLEAN NOT NULL DEFAULT FALSE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    approved_at TIMESTAMPTZ,
    approved_by BIGINT,
    locked_at TIMESTAMPTZ,
    locked_by BIGINT,
    unlocked_at TIMESTAMPTZ,
    unlocked_by BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by BIGINT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by BIGINT,
    CONSTRAINT fk_base_sample_mock_records_parent FOREIGN KEY (parent_id) REFERENCES base_sample_mock_records(id) ON DELETE SET NULL,
    CONSTRAINT fk_base_sample_mock_records_status FOREIGN KEY (status_id) REFERENCES base_sample_mock_statuses(id),
    CONSTRAINT fk_base_sample_mock_records_owner FOREIGN KEY (owner_id) REFERENCES base_sample_mock_people(id) ON DELETE SET NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_base_sample_mock_records_parent ON base_sample_mock_records(parent_id)`,
  `CREATE INDEX IF NOT EXISTS idx_base_sample_mock_records_status ON base_sample_mock_records(status_id)`,
  `CREATE INDEX IF NOT EXISTS idx_base_sample_mock_records_owner ON base_sample_mock_records(owner_id)`,
  `CREATE INDEX IF NOT EXISTS idx_base_sample_mock_records_sort ON base_sample_mock_records(sort_order)`,
  `CREATE TABLE IF NOT EXISTS base_sample_mock_details (
    id BIGSERIAL PRIMARY KEY,
    record_id BIGINT NOT NULL UNIQUE,
    city TEXT NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by BIGINT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by BIGINT,
    CONSTRAINT fk_base_sample_mock_details_record FOREIGN KEY (record_id) REFERENCES base_sample_mock_records(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS base_sample_mock_comments (
    id BIGSERIAL PRIMARY KEY,
    record_id BIGINT NOT NULL,
    author_id BIGINT,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by BIGINT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by BIGINT,
    CONSTRAINT fk_base_sample_mock_comments_record FOREIGN KEY (record_id) REFERENCES base_sample_mock_records(id) ON DELETE CASCADE,
    CONSTRAINT fk_base_sample_mock_comments_author FOREIGN KEY (author_id) REFERENCES base_sample_mock_people(id) ON DELETE SET NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_base_sample_mock_comments_record ON base_sample_mock_comments(record_id)`,
  `CREATE TABLE IF NOT EXISTS base_sample_mock_record_tags (
    record_id BIGINT NOT NULL,
    tag_id BIGINT NOT NULL,
    PRIMARY KEY (record_id, tag_id),
    CONSTRAINT fk_base_sample_mock_record_tags_record FOREIGN KEY (record_id) REFERENCES base_sample_mock_records(id) ON DELETE CASCADE,
    CONSTRAINT fk_base_sample_mock_record_tags_tag FOREIGN KEY (tag_id) REFERENCES base_sample_mock_tags(id) ON DELETE CASCADE
  )`,
];

const SQLITE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS base_sample_mock_statuses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME,
    created_by INTEGER,
    updated_at DATETIME,
    updated_by INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS base_sample_mock_people (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    email TEXT,
    created_at DATETIME,
    created_by INTEGER,
    updated_at DATETIME,
    updated_by INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS base_sample_mock_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    created_at DATETIME,
    created_by INTEGER,
    updated_at DATETIME,
    updated_by INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS base_sample_mock_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    subtitle TEXT,
    website TEXT,
    photo TEXT,
    parent_id INTEGER,
    status_id INTEGER NOT NULL,
    owner_id INTEGER,
    sort_order INTEGER NOT NULL DEFAULT 0,
    locked INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    latitude REAL,
    longitude REAL,
    approved_at DATETIME,
    approved_by INTEGER,
    locked_at DATETIME,
    locked_by INTEGER,
    unlocked_at DATETIME,
    unlocked_by INTEGER,
    created_at DATETIME,
    created_by INTEGER,
    updated_at DATETIME,
    updated_by INTEGER,
    FOREIGN KEY (parent_id) REFERENCES base_sample_mock_records(id) ON DELETE SET NULL,
    FOREIGN KEY (status_id) REFERENCES base_sample_mock_statuses(id),
    FOREIGN KEY (owner_id) REFERENCES base_sample_mock_people(id) ON DELETE SET NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_base_sample_mock_records_parent ON base_sample_mock_records(parent_id)`,
  `CREATE INDEX IF NOT EXISTS idx_base_sample_mock_records_status ON base_sample_mock_records(status_id)`,
  `CREATE INDEX IF NOT EXISTS idx_base_sample_mock_records_owner ON base_sample_mock_records(owner_id)`,
  `CREATE INDEX IF NOT EXISTS idx_base_sample_mock_records_sort ON base_sample_mock_records(sort_order)`,
  `CREATE TABLE IF NOT EXISTS base_sample_mock_details (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id INTEGER NOT NULL UNIQUE,
    city TEXT NOT NULL,
    note TEXT,
    created_at DATETIME,
    created_by INTEGER,
    updated_at DATETIME,
    updated_by INTEGER,
    FOREIGN KEY (record_id) REFERENCES base_sample_mock_records(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS base_sample_mock_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id INTEGER NOT NULL,
    author_id INTEGER,
    body TEXT NOT NULL,
    created_at DATETIME,
    created_by INTEGER,
    updated_at DATETIME,
    updated_by INTEGER,
    FOREIGN KEY (record_id) REFERENCES base_sample_mock_records(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES base_sample_mock_people(id) ON DELETE SET NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_base_sample_mock_comments_record ON base_sample_mock_comments(record_id)`,
  `CREATE TABLE IF NOT EXISTS base_sample_mock_record_tags (
    record_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (record_id, tag_id),
    FOREIGN KEY (record_id) REFERENCES base_sample_mock_records(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES base_sample_mock_tags(id) ON DELETE CASCADE
  )`,
];

const sqlServerCreateIfMissing = (table: string, body: string): string => `
IF OBJECT_ID(N'${table}', N'U') IS NULL
BEGIN
  ${body}
END
`;

const SQLSERVER_STATEMENTS = [
  sqlServerCreateIfMissing('base_sample_mock_statuses', `CREATE TABLE base_sample_mock_statuses (
    id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    code NVARCHAR(MAX) NOT NULL,
    title NVARCHAR(MAX) NOT NULL,
    sort_order INT NOT NULL CONSTRAINT df_base_sample_mock_statuses_sort DEFAULT 0,
    created_at DATETIME2 NULL,
    created_by BIGINT NULL,
    updated_at DATETIME2 NULL,
    updated_by BIGINT NULL,
    CONSTRAINT uq_base_sample_mock_statuses_code UNIQUE (code)
  )`),
  sqlServerCreateIfMissing('base_sample_mock_people', `CREATE TABLE base_sample_mock_people (
    id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    username NVARCHAR(256) NOT NULL,
    display_name NVARCHAR(MAX) NOT NULL,
    email NVARCHAR(MAX) NULL,
    created_at DATETIME2 NULL,
    created_by BIGINT NULL,
    updated_at DATETIME2 NULL,
    updated_by BIGINT NULL,
    CONSTRAINT uq_base_sample_mock_people_username UNIQUE (username)
  )`),
  sqlServerCreateIfMissing('base_sample_mock_tags', `CREATE TABLE base_sample_mock_tags (
    id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    slug NVARCHAR(256) NOT NULL,
    title NVARCHAR(MAX) NOT NULL,
    created_at DATETIME2 NULL,
    created_by BIGINT NULL,
    updated_at DATETIME2 NULL,
    updated_by BIGINT NULL,
    CONSTRAINT uq_base_sample_mock_tags_slug UNIQUE (slug)
  )`),
  sqlServerCreateIfMissing('base_sample_mock_records', `CREATE TABLE base_sample_mock_records (
    id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    code NVARCHAR(256) NOT NULL,
    title NVARCHAR(MAX) NOT NULL,
    subtitle NVARCHAR(MAX) NULL,
    website NVARCHAR(MAX) NULL,
    photo NVARCHAR(MAX) NULL,
    parent_id BIGINT NULL,
    status_id BIGINT NOT NULL,
    owner_id BIGINT NULL,
    sort_order INT NOT NULL CONSTRAINT df_base_sample_mock_records_sort DEFAULT 0,
    locked BIT NOT NULL CONSTRAINT df_base_sample_mock_records_locked DEFAULT 0,
    active BIT NOT NULL CONSTRAINT df_base_sample_mock_records_active DEFAULT 1,
    latitude FLOAT NULL,
    longitude FLOAT NULL,
    approved_at DATETIME2 NULL,
    approved_by BIGINT NULL,
    locked_at DATETIME2 NULL,
    locked_by BIGINT NULL,
    unlocked_at DATETIME2 NULL,
    unlocked_by BIGINT NULL,
    created_at DATETIME2 NULL,
    created_by BIGINT NULL,
    updated_at DATETIME2 NULL,
    updated_by BIGINT NULL,
    CONSTRAINT uq_base_sample_mock_records_code UNIQUE (code),
    CONSTRAINT fk_base_sample_mock_records_parent FOREIGN KEY (parent_id) REFERENCES base_sample_mock_records(id) ON DELETE SET NULL,
    CONSTRAINT fk_base_sample_mock_records_status FOREIGN KEY (status_id) REFERENCES base_sample_mock_statuses(id),
    CONSTRAINT fk_base_sample_mock_records_owner FOREIGN KEY (owner_id) REFERENCES base_sample_mock_people(id) ON DELETE SET NULL
  )`),
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_base_sample_mock_records_parent')
    CREATE INDEX idx_base_sample_mock_records_parent ON base_sample_mock_records(parent_id)`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_base_sample_mock_records_status')
    CREATE INDEX idx_base_sample_mock_records_status ON base_sample_mock_records(status_id)`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_base_sample_mock_records_owner')
    CREATE INDEX idx_base_sample_mock_records_owner ON base_sample_mock_records(owner_id)`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_base_sample_mock_records_sort')
    CREATE INDEX idx_base_sample_mock_records_sort ON base_sample_mock_records(sort_order)`,
  sqlServerCreateIfMissing('base_sample_mock_details', `CREATE TABLE base_sample_mock_details (
    id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    record_id BIGINT NOT NULL,
    city NVARCHAR(MAX) NOT NULL,
    note NVARCHAR(MAX) NULL,
    created_at DATETIME2 NULL,
    created_by BIGINT NULL,
    updated_at DATETIME2 NULL,
    updated_by BIGINT NULL,
    CONSTRAINT uq_base_sample_mock_details_record UNIQUE (record_id),
    CONSTRAINT fk_base_sample_mock_details_record FOREIGN KEY (record_id) REFERENCES base_sample_mock_records(id) ON DELETE CASCADE
  )`),
  sqlServerCreateIfMissing('base_sample_mock_comments', `CREATE TABLE base_sample_mock_comments (
    id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    record_id BIGINT NOT NULL,
    author_id BIGINT NULL,
    body NVARCHAR(MAX) NOT NULL,
    created_at DATETIME2 NULL,
    created_by BIGINT NULL,
    updated_at DATETIME2 NULL,
    updated_by BIGINT NULL,
    CONSTRAINT fk_base_sample_mock_comments_record FOREIGN KEY (record_id) REFERENCES base_sample_mock_records(id) ON DELETE CASCADE,
    CONSTRAINT fk_base_sample_mock_comments_author FOREIGN KEY (author_id) REFERENCES base_sample_mock_people(id) ON DELETE SET NULL
  )`),
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_base_sample_mock_comments_record')
    CREATE INDEX idx_base_sample_mock_comments_record ON base_sample_mock_comments(record_id)`,
  sqlServerCreateIfMissing('base_sample_mock_record_tags', `CREATE TABLE base_sample_mock_record_tags (
    record_id BIGINT NOT NULL,
    tag_id BIGINT NOT NULL,
    CONSTRAINT pk_base_sample_mock_record_tags PRIMARY KEY (record_id, tag_id),
    CONSTRAINT fk_base_sample_mock_record_tags_record FOREIGN KEY (record_id) REFERENCES base_sample_mock_records(id) ON DELETE CASCADE,
    CONSTRAINT fk_base_sample_mock_record_tags_tag FOREIGN KEY (tag_id) REFERENCES base_sample_mock_tags(id) ON DELETE CASCADE
  )`),
];

const mysqlCreateIfMissing = (sql: string): string => sql.replace(/^CREATE TABLE IF NOT EXISTS/i, 'CREATE TABLE IF NOT EXISTS');

const MYSQL_STATEMENTS = POSTGRES_STATEMENTS.map((sql) => (
  mysqlCreateIfMissing(sql)
    .replace(/BIGSERIAL PRIMARY KEY/g, 'BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY')
    .replace(/TIMESTAMPTZ/g, 'DATETIME(3)')
    .replace(/NOW\(\)/g, 'CURRENT_TIMESTAMP(3)')
    .replace(/BOOLEAN/g, 'TINYINT(1)')
    .replace(/FALSE/g, '0')
    .replace(/TRUE/g, '1')
    .replace(/::text/g, '')
));

const statementsFor = (provider: ControlPlaneDbProvider): string[] => {
  switch (provider) {
    case 'postgresql':
      return POSTGRES_STATEMENTS;
    case 'sqlite':
      return SQLITE_STATEMENTS;
    case 'sqlserver':
      return SQLSERVER_STATEMENTS;
    case 'mysql':
      return MYSQL_STATEMENTS;
    default:
      return POSTGRES_STATEMENTS;
  }
};

const geoAlterStatements = (provider: ControlPlaneDbProvider): string[] => {
  switch (provider) {
    case 'sqlite':
      return [
        'ALTER TABLE base_sample_mock_records ADD COLUMN latitude REAL',
        'ALTER TABLE base_sample_mock_records ADD COLUMN longitude REAL',
      ];
    case 'sqlserver':
      return [
        `IF COL_LENGTH(N'base_sample_mock_records', N'latitude') IS NULL
          ALTER TABLE base_sample_mock_records ADD latitude FLOAT NULL`,
        `IF COL_LENGTH(N'base_sample_mock_records', N'longitude') IS NULL
          ALTER TABLE base_sample_mock_records ADD longitude FLOAT NULL`,
      ];
    case 'mysql':
      return [
        'ALTER TABLE base_sample_mock_records ADD COLUMN latitude DOUBLE NULL',
        'ALTER TABLE base_sample_mock_records ADD COLUMN longitude DOUBLE NULL',
      ];
    default:
      return [
        'ALTER TABLE base_sample_mock_records ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION',
        'ALTER TABLE base_sample_mock_records ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION',
      ];
  }
};

const ensureSampleMockGeoColumns = async (provider: ControlPlaneDbProvider): Promise<void> => {
  const prisma = getPrismaControlPlane();
  for (const sql of geoAlterStatements(provider)) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch {
      // Column already present (SQLite/MySQL ADD COLUMN without IF NOT EXISTS).
    }
  }
};

export async function sampleMockTablesExist(provider: ControlPlaneDbProvider): Promise<boolean> {
  const prisma = getPrismaControlPlane();
  try {
    switch (provider) {
      case 'postgresql': {
        const rows = await prisma.$queryRaw<Array<{ exists: string | null }>>`
          SELECT to_regclass('public.base_sample_mock_statuses')::text AS exists
        `;
        return Boolean(rows[0]?.exists);
      }
      case 'sqlite': {
        const rows = await prisma.$queryRaw<Array<{ name: string }>>`
          SELECT name FROM sqlite_master WHERE type = 'table' AND name = ${SAMPLE_MOCK_TABLE}
        `;
        return rows.length > 0;
      }
      case 'sqlserver': {
        const rows = await prisma.$queryRaw<Array<{ id: unknown }>>`
          SELECT OBJECT_ID(N'base_sample_mock_statuses', N'U') AS id
        `;
        return rows[0]?.id != null;
      }
      case 'mysql': {
        const rows = await prisma.$queryRaw<Array<{ c: bigint | number }>>`
          SELECT COUNT(*) AS c
          FROM information_schema.tables
          WHERE table_schema = DATABASE()
            AND table_name = ${SAMPLE_MOCK_TABLE}
        `;
        return Number(rows[0]?.c) > 0;
      }
      default:
        return false;
    }
  } catch {
    return false;
  }
}

/** Additive create of base_sample_mock_* — does not drop or rewrite existing tables. */
export async function ensureSampleMockSchema(
  settings: Pick<ControlPlaneDatabaseSettings, 'provider' | 'url'>,
): Promise<(() => void) | undefined> {
  if (!(await sampleMockTablesExist(settings.provider))) {
    console.log('[AppEndO] Creating base_sample_mock_* tables…');
    const prisma = getPrismaControlPlane();
    for (const sql of statementsFor(settings.provider)) {
      await prisma.$executeRawUnsafe(sql);
    }
  }
  await ensureSampleMockGeoColumns(settings.provider);
  return undefined;
}
