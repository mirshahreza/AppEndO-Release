export type SemverBump = 'patch' | 'minor' | 'major';

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:-([\w.]+))?(?:\+([\w.]+))?$/;

export function parseSemver(version: string): { major: number; minor: number; patch: number } {
  const match = SEMVER_RE.exec(version.trim());
  if (!match) {
    throw new Error(`Invalid semver: ${version}`);
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

export function formatSemver(parts: { major: number; minor: number; patch: number }): string {
  return `${parts.major}.${parts.minor}.${parts.patch}`;
}

export function bumpSemver(version: string, bump: SemverBump): string {
  const parts = parseSemver(version);
  if (bump === 'major') {
    return formatSemver({ major: parts.major + 1, minor: 0, patch: 0 });
  }
  if (bump === 'minor') {
    return formatSemver({ major: parts.major, minor: parts.minor + 1, patch: 0 });
  }
  return formatSemver({ major: parts.major, minor: parts.minor, patch: parts.patch + 1 });
}
