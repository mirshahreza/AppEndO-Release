import { describe, expect, it } from 'vitest';
import { isControlPlaneSchemaObjectName } from '../controlPlaneSchemaObjects';

describe('isControlPlaneSchemaObjectName', () => {
  it('matches base_ control-plane object names', () => {
    expect(isControlPlaneSchemaObjectName('base_users')).toBe(true);
    expect(isControlPlaneSchemaObjectName('base_contact_messages_v')).toBe(true);
    expect(isControlPlaneSchemaObjectName('BASE_ROLES')).toBe(true);
  });

  it('does not match edge or user-defined object names', () => {
    expect(isControlPlaneSchemaObjectName('customers')).toBe(false);
    expect(isControlPlaneSchemaObjectName('my_base_table')).toBe(false);
    expect(isControlPlaneSchemaObjectName('')).toBe(false);
  });
});
