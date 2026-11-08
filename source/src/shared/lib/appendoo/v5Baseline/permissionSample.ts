/**
 * Stable, owned fixture target for V5 Phase P00 baseline trajectories (`permission_change`
 * scenario). Not wired into any real authorization path — a minimal, isolated target so a
 * scripted agent trajectory can propose a real `draft_file_patch` for a permission-shaped edit.
 */
export const REPORTS_ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['view', 'edit'],
  viewer: ['view'],
};
