export type FeedScope = "for-you" | "following";

export function filterCreatorFeedItems<T extends { handle: string }>(
  items: readonly T[],
  scope: FeedScope,
  following: readonly string[],
): readonly T[] {
  if (scope === "for-you") return items;
  return items.filter((item) => following.includes(item.handle));
}
