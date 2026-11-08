import { describe, expect, it } from 'vitest';
import {
  associationMetaToStudioLayout,
  studioLayoutToAssociationMeta,
} from '../edgeModelAssociationStudioMeta';

describe('relation cube dimensions', () => {
  it('round-trips cubeDimension on association studio-meta', () => {
    const layout = associationMetaToStudioLayout([
      {
        relationKey: 'region',
        cubeDimension: {
          hierarchies: [{ name: 'Geo', levels: ['region', 'city'] }],
          attributes: ['code'],
          isTimeDimension: false,
        },
      },
    ]);
    expect(layout.relationCubeDimensions?.region?.hierarchies?.[0]?.levels).toEqual(['region', 'city']);
    const meta = studioLayoutToAssociationMeta(layout);
    expect(meta[0]?.cubeDimension?.hierarchies?.[0]?.name).toBe('Geo');
    expect(meta[0]?.cubeDimension?.attributes).toEqual(['code']);
  });

  it('round-trips history on association studio-meta', () => {
    const layout = associationMetaToStudioLayout([
      {
        relationKey: 'roles',
        history: {
          trackAssignRemove: true,
        },
      },
    ]);
    expect(layout.relationHistories?.roles?.trackAssignRemove).toBe(true);
    const meta = studioLayoutToAssociationMeta(layout);
    expect(meta[0]?.history).toEqual({
      trackAssignRemove: true,
    });
  });
});
