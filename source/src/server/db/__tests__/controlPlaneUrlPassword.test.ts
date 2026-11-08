import { describe, expect, it } from 'vitest';
import { stripControlPlaneUrlPassword, withControlPlaneUrlPassword } from '../controlPlaneUrlPassword';

describe('controlPlaneUrlPassword', () => {
  it('strips and restores a postgresql url password', () => {
    const live = 'postgresql://postgres:secret@localhost:5432/AppEnd';
    const stored = stripControlPlaneUrlPassword('postgresql', live);
    expect(stored).not.toContain('secret');
    expect(withControlPlaneUrlPassword('postgresql', stored, 'secret')).toContain('secret');
    expect(withControlPlaneUrlPassword('postgresql', stored, 'secret')).toContain('postgres');
  });

  it('strips sqlserver password segments without dropping flags', () => {
    const live = 'sqlserver://localhost\\SQL2025;database=AppEnd;user=sa;password=secret;encrypt=true;trustServerCertificate=true';
    const stored = stripControlPlaneUrlPassword('sqlserver', live);
    expect(stored).toContain('sqlserver://localhost\\SQL2025');
    expect(stored).toContain('database=AppEnd');
    expect(stored).not.toMatch(/password=/i);
    const restored = withControlPlaneUrlPassword('sqlserver', stored, 'secret');
    expect(restored).toContain('password=secret');
    expect(restored).toContain('user=sa');
  });

  it('leaves sqlite urls unchanged', () => {
    const url = 'file:data/appendo-control.db';
    expect(stripControlPlaneUrlPassword('sqlite', url)).toBe(url);
    expect(withControlPlaneUrlPassword('sqlite', url, 'ignored')).toBe(url);
  });
});
