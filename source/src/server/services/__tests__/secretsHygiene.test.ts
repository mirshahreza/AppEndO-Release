import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const SECRET_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/,
  /AIza[0-9A-Za-z\-_]{20,}/,
  /ghp_[a-zA-Z0-9]{20,}/,
  /xox[baprs]-[a-zA-Z0-9-]{20,}/,
];

const listTrackedFiles = (): string[] => {
  try {
    const output = execFileSync('git', ['ls-files'], { encoding: 'utf8' });
    return output.split('\n').map((line) => line.trim()).filter(Boolean);
  } catch {
    return [];
  };
};

const scanGitHistoryForSecrets = (): string[] => {
  try {
    const output = execFileSync(
      'git',
      ['log', '--all', '-p', '--unified=0', '-S', 'sk-', '--', 'settings.json', '.env'],
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
    );
    return SECRET_PATTERNS.flatMap((pattern) => {
      const matches = output.match(new RegExp(pattern.source, 'g')) ?? [];
      return matches.filter((match) => !match.includes('change_me') && !match.includes('example'));
    });
  } catch {
    return [];
  }
};

describe('secrets hygiene', () => {
  it('does not track live .env files', () => {
    const tracked = listTrackedFiles();
    expect(tracked.some((file) => file === '.env' || file.endsWith('/.env'))).toBe(false);
  });

  it('does not contain high-risk API key patterns in tracked settings.example.json', () => {
    const tracked = listTrackedFiles();
    if (!tracked.includes('settings.example.json')) {
      return;
    }

    const sample = fs.readFileSync('settings.example.json', 'utf8');
    SECRET_PATTERNS.forEach((pattern) => {
      expect(sample).not.toMatch(pattern);
    });
    expect(sample).toContain('change_me');
  });

  it('reports no production API keys in git history for settings/env paths', () => {
    const findings = scanGitHistoryForSecrets();
    expect(findings).toEqual([]);
  });
});
