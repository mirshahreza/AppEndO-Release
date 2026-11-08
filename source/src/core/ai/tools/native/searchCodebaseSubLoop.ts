import type { SearchMatch } from './searchCodebase';

export const COMPLEX_SEARCH_MIN_CHARS = 72;
export const COMPLEX_SEARCH_MIN_WORDS = 6;

export const isComplexSearchQuery = (query: string): boolean => {
  const trimmed = query.trim();
  if (!trimmed) return false;
  if (trimmed.length >= COMPLEX_SEARCH_MIN_CHARS) return true;
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= COMPLEX_SEARCH_MIN_WORDS) return true;
  return /(?:\band\b|\bor\b)/i.test(trimmed);
};

export const refineSearchQueryFromMatches = (
  query: string,
  matches: SearchMatch[],
): string => {
  const hints = new Set<string>();
  matches.slice(0, 6).forEach((match) => {
    const fileName = match.path.split('/').pop() ?? '';
    const stem = fileName.replace(/\.[^.]+$/, '');
    if (stem.length >= 3) hints.add(stem);
    if (match.pageKey) hints.add(match.pageKey);
  });

  const extra = [...hints].slice(0, 3).filter((hint) => !query.includes(hint));
  if (!extra.length) return query;
  return `${query} ${extra.join(' ')}`.trim();
};

export const mergeSearchMatchLists = (
  primary: SearchMatch[],
  secondary: SearchMatch[],
  maxResults: number,
): SearchMatch[] => {
  const seen = new Set<string>();
  const merged: SearchMatch[] = [];

  const push = (match: SearchMatch) => {
    const key = `${match.path}:${match.line}`;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(match);
  };

  primary.forEach(push);
  secondary.forEach(push);

  return merged.slice(0, maxResults);
};

export const deriveRefineScopePaths = (matches: SearchMatch[]): string[] => {
  const paths = new Set<string>();
  matches.slice(0, 5).forEach((match) => {
    const parts = match.path.split('/');
    if (parts.length > 1) {
      paths.add(parts.slice(0, -1).join('/'));
    } else {
      paths.add(match.path);
    }
  });
  return [...paths];
};
