/**
 * Group `items` into a `Map` keyed by `key(item)`, preserving input order
 * within each group. (`Map.groupBy` is ES2024; this keeps us on the ES2022
 * target and returns a plain `Map`.)
 */
export const groupBy = <T, K>(
  items: readonly T[],
  key: (item: T) => K,
): Map<K, T[]> => {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const existing = groups.get(k);
    if (existing) existing.push(item);
    else groups.set(k, [item]);
  }
  return groups;
};
