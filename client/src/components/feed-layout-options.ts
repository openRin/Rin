export const FEED_LAYOUT_OPTIONS = ["list", "masonry"] as const;

export type FeedLayout = (typeof FEED_LAYOUT_OPTIONS)[number];

export function normalizeFeedLayout(value: string): FeedLayout {
  return FEED_LAYOUT_OPTIONS.includes(value as FeedLayout) ? (value as FeedLayout) : "list";
}
