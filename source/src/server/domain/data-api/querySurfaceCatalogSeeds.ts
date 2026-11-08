import type { QueryPresetDefinition, QuerySurfacesDocument } from '../../../shared/api/contracts/data-api';
import { queryPresetWhereEq, queryPresetWhereIsTrue } from '../../../shared/lib/querySurfaceWhere';

const preset = (
  partial: Omit<QueryPresetDefinition, 'application'> & { application?: QueryPresetDefinition['application'] },
): QueryPresetDefinition => ({
  application: 'optional',
  visibility: 'public',
  ...partial,
});

const catalogByObjectName: Record<string, QueryPresetDefinition[]> = {
  cms_contents: [
    preset({
      id: 'published',
      label: 'Published',
      description: 'Editorial status is published.',
      where: queryPresetWhereEq('statusCode', 'published'),
      sortOrder: 10,
      icon: 'lucide:check-circle',
    }),
    preset({
      id: 'drafts',
      label: 'Drafts',
      description: 'Work in progress — not public.',
      where: queryPresetWhereEq('statusCode', 'draft'),
      sortOrder: 20,
      icon: 'lucide:file-pen-line',
    }),
    preset({
      id: 'in-review',
      label: 'In review',
      where: queryPresetWhereEq('statusCode', 'in_review'),
      sortOrder: 30,
      icon: 'lucide:eye',
    }),
  ],
  crm_customers: [
    preset({
      id: 'leads',
      label: 'Leads',
      where: queryPresetWhereEq('lifecycle_stage_code', 'lead'),
      sortOrder: 10,
      icon: 'lucide:sparkles',
    }),
    preset({
      id: 'customers',
      label: 'Customers',
      where: queryPresetWhereEq('lifecycle_stage_code', 'customer'),
      defaultSelected: true,
      sortOrder: 20,
      icon: 'lucide:user-check',
    }),
  ],
  crm_opportunities: [
    preset({
      id: 'open-pipeline',
      label: 'Open pipeline',
      where: {
        kind: 'group',
        id: 'open-pipeline-root',
        op: 'and',
        children: [{
          kind: 'condition',
          id: 'closed-at-empty',
          field: 'closed_at',
          operator: 'isNull',
          value: '',
        }],
      },
      defaultSelected: true,
      sortOrder: 10,
    }),
    preset({
      id: 'won',
      label: 'Won',
      where: queryPresetWhereEq('stage_code', 'won'),
      sortOrder: 20,
    }),
    preset({
      id: 'lost',
      label: 'Lost',
      where: queryPresetWhereEq('stage_code', 'lost'),
      sortOrder: 30,
    }),
  ],
  crm_tickets: [
    preset({
      id: 'open-tickets',
      label: 'Open',
      where: queryPresetWhereEq('status_code', 'open'),
      defaultSelected: true,
      sortOrder: 10,
    }),
    preset({
      id: 'resolved',
      label: 'Resolved',
      where: queryPresetWhereEq('status_code', 'resolved'),
      sortOrder: 20,
    }),
  ],
  base_users: [
    preset({
      id: 'active-users',
      label: 'Active',
      where: queryPresetWhereEq('locked', '0'),
      defaultSelected: true,
      sortOrder: 10,
    }),
    preset({
      id: 'locked-users',
      label: 'Locked',
      where: queryPresetWhereEq('locked', '1'),
      visibility: 'restricted',
      sortOrder: 20,
    }),
  ],
  base_work_items: [
    preset({
      id: 'open-work',
      label: 'Open',
      where: queryPresetWhereEq('status', 'OPEN'),
      defaultSelected: true,
      sortOrder: 10,
    }),
    preset({
      id: 'completed-work',
      label: 'Completed',
      where: queryPresetWhereEq('status', 'COMPLETED'),
      sortOrder: 20,
    }),
  ],
  hwy_members: [
    preset({
      id: 'active-members',
      label: 'Active members',
      where: queryPresetWhereIsTrue('is_active'),
      defaultSelected: true,
      sortOrder: 10,
      icon: 'lucide:users',
    }),
  ],
  hwy_families: [
    preset({
      id: 'active-families',
      label: 'Active',
      where: queryPresetWhereIsTrue('is_active'),
      defaultSelected: true,
      sortOrder: 10,
    }),
  ],
};

export const querySurfacePresetsForObjectName = (objectName: string): QueryPresetDefinition[] => (
  catalogByObjectName[objectName] ?? []
);

export const buildQuerySurfacesDocumentForObject = (objectName: string): QuerySurfacesDocument | null => {
  const presets = querySurfacePresetsForObjectName(objectName);
  if (presets.length === 0) {
    return null;
  }
  return {
    schemaVersion: '1.0.0',
    presets,
  };
};
