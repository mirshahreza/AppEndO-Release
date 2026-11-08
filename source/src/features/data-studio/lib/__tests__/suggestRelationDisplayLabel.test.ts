import { describe, expect, it } from 'vitest';
import { suggestRelationDisplayLabel } from '../suggestRelationDisplayLabel';

const peers = [
  { id: 'em_users', objectName: 'base_users', labels: { title: 'Users' } },
  { id: 'em_members', objectName: 'hwy_members', labels: { title: 'HWY Members' } },
  {
    id: 'em_sessions',
    objectName: 'base_ai_chat_sessions',
    labels: { title: 'AI Chat Sessions' },
  },
] as const;

describe('suggestRelationDisplayLabel', () => {
  it('labels inbound user_id collections on base_users', () => {
    const label = suggestRelationDisplayLabel({
      focusObjectName: 'base_users',
      peerModels: peers,
      row: {
        key: 'physical',
        nature: 'physical',
        name: 'base_ai_chat_sessions_user_id_fkey',
        kindLabel: 'Has many',
        cascadeLabel: null,
        fromLabel: 'base_ai_chat_sessions.user_id',
        toLabel: 'base_users.id',
        relation: {
          fromTable: 'base_ai_chat_sessions',
          fromColumn: 'user_id',
          toTable: 'base_users',
          toColumn: 'id',
          constraintName: 'base_ai_chat_sessions_user_id_fkey',
        },
      },
    });
    expect(label).toBe('AI Chat Sessions');
  });

  it('labels outbound created_by on a member table', () => {
    const label = suggestRelationDisplayLabel({
      focusObjectName: 'hwy_members',
      peerModels: peers,
      row: {
        key: 'logical',
        nature: 'logical',
        name: 'createdByUser',
        kindLabel: 'Belongs to',
        cascadeLabel: null,
        fromLabel: 'hwy_members',
        toLabel: 'Users · created_by',
        association: {
          id: 'ea_test',
          kind: 'belongsTo',
          targetModelId: 'em_users',
          foreignKey: 'created_by',
          as: 'createdByUser',
          source: 'manual',
        },
      },
    });
    expect(label).toBe('Created by');
  });
});
