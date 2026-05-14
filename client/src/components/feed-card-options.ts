export const FEED_CARD_VARIANTS = ["default", "editorial"] as const;

export type FeedCardVariant = (typeof FEED_CARD_VARIANTS)[number];

export function normalizeFeedCardVariant(value: string): FeedCardVariant {
  return FEED_CARD_VARIANTS.includes(value as FeedCardVariant) ? (value as FeedCardVariant) : "default";
}
