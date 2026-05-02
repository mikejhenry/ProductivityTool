/**
 * Reorders `items` to match the sequence given by `orderedIds`.
 * Items whose id is not in orderedIds are omitted.
 * Used by optimistic updates in useTasks and useShoppingItems.
 */
export function reorderByIds<T extends { id: string }>(items: T[], orderedIds: string[]): T[] {
  const map = new Map(items.map(item => [item.id, item]))
  return orderedIds
    .map(id => map.get(id))
    .filter((item): item is T => item !== undefined)
}
