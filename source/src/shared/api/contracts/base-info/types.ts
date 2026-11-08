export type BaseInfoRow = {
  id: string;
  parent_id: string | null;
  label: string;
  title?: string | null;
  title_path?: string | null;
  short_name?: string | null;
  note?: string | null;
  note_display?: string | null;
  view_order?: number | null;
  is_active: boolean;
  ui_color?: string | null;
  ui_html?: string | null;
  metadata?: string | null;
  value?: number | null;
  has_children?: boolean;
};
