import { describe, expect, it } from 'vitest';
import {
  partitionStandardCardLayout,
  resolveCardLayout,
} from '../appTableGridCardLayout';
import type { AppTableGridColumnDef } from '../appTableGridQuery';

type Row = { photo: string; title: string; subtitle: string; status: string; owner: string };

describe('resolveCardLayout', () => {
  it('extracts media role columns for the standard card', () => {
    const columns: AppTableGridColumnDef<Row>[] = [
      {
        id: 'photo',
        label: 'Photo',
        card: { role: 'media' },
        renderCell: (row) => row.photo,
      },
      {
        id: 'title',
        label: 'Title',
        card: { role: 'title' },
        renderCell: (row) => row.title,
      },
      {
        id: 'status',
        label: 'Status',
        card: { role: 'field' },
        renderCell: (row) => row.status,
      },
    ];

    const layout = resolveCardLayout(columns, 'desktop');

    expect(layout.media?.column.id).toBe('photo');
    expect(layout.media?.label).toBe('');
    expect(layout.title?.column.id).toBe('title');
    expect(layout.fields.map((entry) => entry.column.id)).toEqual(['status']);
  });
});

describe('partitionStandardCardLayout', () => {
  it('keeps the first three data fields unlabeled and pushes the rest below', () => {
    const columns: AppTableGridColumnDef<Row>[] = [
      {
        id: 'photo',
        label: 'Photo',
        card: { role: 'media' },
        renderCell: (row) => row.photo,
      },
      {
        id: 'title',
        label: 'Title',
        card: { role: 'title' },
        renderCell: (row) => row.title,
      },
      {
        id: 'subtitle',
        label: 'Subtitle',
        card: { role: 'subtitle' },
        renderCell: (row) => row.subtitle,
      },
      {
        id: 'status',
        label: 'Status',
        card: { role: 'field' },
        renderCell: (row) => row.status,
      },
      {
        id: 'owner',
        label: 'Owner',
        card: { role: 'field' },
        renderCell: (row) => row.owner,
      },
    ];

    const layout = resolveCardLayout(columns, 'desktop');
    const partition = partitionStandardCardLayout(layout);

    expect(partition.media?.column.id).toBe('photo');
    expect(partition.primaryFields.map((entry) => entry.column.id)).toEqual([
      'title',
      'subtitle',
      'status',
    ]);
    expect(partition.labeledFields.map((entry) => entry.column.id)).toEqual(['owner']);
  });
});
