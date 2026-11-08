import React from 'react';
import { describe, expect, it } from 'vitest';
import type { DbEnrichmentQuestion } from '../../../shared/api/contracts/db-enrichment';
import {
  createEnrichmentQuestionGridColumns,
  createEnrichmentQuestionRowActions,
  ENRICHMENT_QUESTION_SORT_OPTIONS,
} from '../components/dataEnrichmentQuestionGridColumns';

const handlers = {
  onAnswer: () => undefined,
  onView: () => undefined,
  onDismiss: () => undefined,
};

describe('createEnrichmentQuestionGridColumns', () => {
  it('omits Created, center-aligns Status, and keeps actions unhideable', () => {
    const columns = createEnrichmentQuestionGridColumns(handlers);
    const ids = columns.map((column) => column.id);

    expect(ids).not.toContain('createdAt');
    expect(ids).toEqual(['question', 'objectName', 'columnName', 'kind', 'status', 'answer', 'actions']);

    const status = columns.find((column) => column.id === 'status');
    expect(status?.cellClassName).toContain('text-center');
    expect(status?.headerClassName).toContain('text-center');
    expect(status?.headerClassName).toContain('[&>div]:justify-center');
    expect(status?.sort).toBe(false);

    const actions = columns.find((column) => column.id === 'actions');
    expect(actions?.layout).toEqual({ hideable: false });

    expect(columns.find((column) => column.id === 'question')?.wrap).toBe(true);
    expect(columns.find((column) => column.id === 'question')?.sort).toBe(false);
    expect(columns.find((column) => column.id === 'answer')?.wrap).toBe(true);
    expect(ENRICHMENT_QUESTION_SORT_OPTIONS.map((option) => option.value)).toEqual([
      'createdAt',
      'objectName',
      'kind',
    ]);
  });

  it('keeps Answer and Dismiss in the Answer column and omits them from row actions', () => {
    const columns = createEnrichmentQuestionGridColumns(handlers);
    const openRow = {
      status: 'open',
      answer: null,
    } as DbEnrichmentQuestion;
    const answeredRow = {
      status: 'answered',
      answer: 'Email address',
    } as DbEnrichmentQuestion;

    expect(createEnrichmentQuestionRowActions(openRow, handlers)).toEqual([]);
    expect(createEnrichmentQuestionRowActions(answeredRow, handlers).map((action) => action.id)).toEqual(['view']);

    const answerColumn = columns.find((column) => column.id === 'answer');
    const openCell = answerColumn?.renderCell(openRow);
    expect(React.isValidElement(openCell)).toBe(true);
  });
});
