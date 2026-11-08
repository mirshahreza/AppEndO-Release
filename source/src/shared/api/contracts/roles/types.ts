export type RoleRecord = {
  id: number;
  name: string;
  note: string | null;
  created_at: string;
  created_by?: number | null;
  created_by_username?: string | null;
  updated_at?: string;
  updated_by?: number | null;
  updated_by_username?: string | null;
};

export type CreateRolePayload = {
  name: string;
  note?: string;
};

export type UpdateRolePayload = {
  note: string | null;
};
