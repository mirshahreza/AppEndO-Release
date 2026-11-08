import { describe, expect, it } from 'vitest';
import { buildDataSourcesQuestionsShellHeaderOverride } from '../hooks/useDataSourcesQuestionsShellHeader';

describe('data sources questions shell header', () => {
  it('appends Questions to the Data Sources trail', () => {
    expect(buildDataSourcesQuestionsShellHeaderOverride(
      'Data Sources',
      'Configure SQLite, Postgres, and external database connections.',
    )).toEqual({
      icon: 'Database',
      label: 'Data Sources',
      description: 'Configure SQLite, Postgres, and external database connections.',
      titleTrail: ['Data Sources', 'Questions'],
    });
  });
});
