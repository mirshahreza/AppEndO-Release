import { useMemo, useState } from 'react';
import { filterBaseComponentsNav } from '../filterBaseComponentsNav';

export function useBaseComponentsNavSearch() {
  const [query, setQuery] = useState('');
  const groups = useMemo(() => filterBaseComponentsNav(query), [query]);
  const matchCount = useMemo(
    () => groups.reduce((count, group) => count + group.sections.length, 0),
    [groups],
  );

  return { query, setQuery, groups, matchCount };
}
