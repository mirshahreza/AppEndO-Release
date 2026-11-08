import { describe, expect, it } from 'vitest';
import {
  applyHwyNakhebinVoterNameDisplayLines,
  formatHwyPersonListNameSecondLine,
  readHwyNakhebinVoterNameLine1,
  readHwyNakhebinVoterNameLine2,
} from '../hwyNakhebinVoterDisplay';

describe('hwyNakhebinVoterDisplay', () => {
  it('builds two-line voter label from camelCase fields', () => {
    const row: Record<string, unknown> = {
      firstName: 'Soad',
      fatherName: 'Khader',
      grandfatherName: 'Abbas',
      familyName: 'Al-Azawi',
    };
    applyHwyNakhebinVoterNameDisplayLines(row);
    expect(row.voterNameLine1).toBe('Soad Khader Abbas');
    expect(row.voterNameLine2).toBe('Al-Azawi');
  });

  it('reads voter lines from snake_case without precomputed fields', () => {
    const row: Record<string, unknown> = {
      first_name: 'سعاد',
      father_name: 'خضير',
      grandfather_name: 'عباس',
      family_name: 'العزاوي',
    };
    expect(readHwyNakhebinVoterNameLine1(row)).toBe('سعاد خضير عباس');
    expect(readHwyNakhebinVoterNameLine2(row)).toBe('العزاوي');
  });

  it('formats list line 2 as family | birth year', () => {
    expect(formatHwyPersonListNameSecondLine('Al-Azawi', 1980)).toBe('Al-Azawi | 1980');
    expect(formatHwyPersonListNameSecondLine('Al-Azawi', '')).toBe('Al-Azawi');
    expect(formatHwyPersonListNameSecondLine('', 1980)).toBe('1980');
    const row: Record<string, unknown> = {
      family_name: 'العزاوي',
      birth_year: 1991,
    };
    expect(readHwyNakhebinVoterNameLine2(row)).toBe('العزاوي | 1991');
  });
});
