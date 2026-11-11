export type { RoleRecord } from '@/src/shared/api/contracts/roles/types';

export type RoleFormState = {
  name: string;
  note: string;
};

export type RoleTypeFilter = 'ALL' | 'BUILT_IN' | 'CUSTOM';

export type RoleSortField = 'created_at' | 'id' | 'name' | 'note';

export type ToastState = {
  type: 'success' | 'error';
  text: string;
};
