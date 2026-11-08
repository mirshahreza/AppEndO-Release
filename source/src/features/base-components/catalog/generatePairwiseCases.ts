export type PairwiseOptionDomain = {
  id: string;
  values: readonly unknown[];
};

export type PairwiseCase = Record<string, unknown>;

export type GeneratePairwiseCasesOptions = {
  isValid?: (candidate: Readonly<PairwiseCase>) => boolean;
  maxSearchesPerPair?: number;
};

const valueKey = (value: unknown): string => JSON.stringify(value);
const assignmentKey = (candidate: PairwiseCase): string =>
  JSON.stringify(
    Object.keys(candidate)
      .sort()
      .map((key) => [key, candidate[key]]),
  );

const pairKey = (
  leftId: string,
  leftValue: unknown,
  rightId: string,
  rightValue: unknown,
): string =>
  `${leftId}=${valueKey(leftValue)}|${rightId}=${valueKey(rightValue)}`;

const coveredPairs = (
  candidate: PairwiseCase,
  domains: readonly PairwiseOptionDomain[],
): Set<string> => {
  const result = new Set<string>();
  for (let left = 0; left < domains.length; left += 1) {
    for (let right = left + 1; right < domains.length; right += 1) {
      result.add(
        pairKey(
          domains[left].id,
          candidate[domains[left].id],
          domains[right].id,
          candidate[domains[right].id],
        ),
      );
    }
  }
  return result;
};

const findValidCompletion = (
  domains: readonly PairwiseOptionDomain[],
  seed: PairwiseCase,
  isValid: (candidate: Readonly<PairwiseCase>) => boolean,
  maxSearches: number,
): PairwiseCase | undefined => {
  const remaining = domains.filter(({ id }) => !(id in seed));
  let searches = 0;

  const visit = (index: number, candidate: PairwiseCase): PairwiseCase | undefined => {
    if (searches >= maxSearches) return undefined;
    if (index === remaining.length) {
      searches += 1;
      return isValid(candidate) ? { ...candidate } : undefined;
    }
    const domain = remaining[index];
    for (const value of domain.values) {
      candidate[domain.id] = value;
      const match = visit(index + 1, candidate);
      if (match) return match;
    }
    delete candidate[domain.id];
    return undefined;
  };

  return visit(0, { ...seed });
};

/**
 * Builds deterministic pairwise cases without materializing a full Cartesian
 * product. Constraints are honored by completing each pair into a valid case;
 * impossible pairs are excluded from the coverage universe.
 */
export const generatePairwiseCases = (
  domains: readonly PairwiseOptionDomain[],
  options: GeneratePairwiseCasesOptions = {},
): PairwiseCase[] => {
  if (domains.length === 0) return [];
  const ids = new Set<string>();
  for (const domain of domains) {
    if (!domain.id.trim()) throw new Error('Pairwise option IDs cannot be empty.');
    if (ids.has(domain.id)) throw new Error(`Duplicate pairwise option ID "${domain.id}".`);
    if (domain.values.length === 0) {
      throw new Error(`Pairwise option "${domain.id}" requires at least one value.`);
    }
    ids.add(domain.id);
  }

  const isValid = options.isValid ?? (() => true);
  const maxSearches = options.maxSearchesPerPair ?? 2_000;
  const baseline = Object.fromEntries(domains.map((domain) => [domain.id, domain.values[0]]));

  if (domains.length === 1) {
    return domains[0].values
      .map((value) => ({ [domains[0].id]: value }))
      .filter(isValid);
  }

  const candidates = new Map<string, PairwiseCase>();
  const requiredPairs = new Set<string>();
  for (let left = 0; left < domains.length; left += 1) {
    for (let right = left + 1; right < domains.length; right += 1) {
      for (const leftValue of domains[left].values) {
        for (const rightValue of domains[right].values) {
          const seed = {
            [domains[left].id]: leftValue,
            [domains[right].id]: rightValue,
          };
          const candidate = isValid({ ...baseline, ...seed })
            ? { ...baseline, ...seed }
            : findValidCompletion(domains, seed, isValid, maxSearches);
          if (!candidate) continue;
          candidates.set(assignmentKey(candidate), candidate);
          requiredPairs.add(
            pairKey(domains[left].id, leftValue, domains[right].id, rightValue),
          );
        }
      }
    }
  }

  const remaining = new Set(requiredPairs);
  const result: PairwiseCase[] = [];
  const candidateList = [...candidates.values()];
  while (remaining.size > 0) {
    let best: PairwiseCase | undefined;
    let bestCoverage = new Set<string>();
    for (const candidate of candidateList) {
      const coverage = new Set(
        [...coveredPairs(candidate, domains)].filter((key) => remaining.has(key)),
      );
      if (coverage.size > bestCoverage.size) {
        best = candidate;
        bestCoverage = coverage;
      }
    }
    if (!best || bestCoverage.size === 0) break;
    result.push(best);
    for (const key of bestCoverage) remaining.delete(key);
    candidateList.splice(candidateList.indexOf(best), 1);
  }

  return result;
};
