export const ARTICLE_WIDTH_OPTIONS = ["normal", "wide", "full"] as const;

export type ArticleWidth = (typeof ARTICLE_WIDTH_OPTIONS)[number];

export function normalizeArticleWidth(value: string): ArticleWidth {
  return ARTICLE_WIDTH_OPTIONS.includes(value as ArticleWidth) ? (value as ArticleWidth) : "normal";
}

// 与 base.css 中的 wauto / wauto-wide / wauto-full 保持一致
export const ARTICLE_WIDTH_CLASS: Record<ArticleWidth, string> = {
  normal: "wauto",
  wide: "wauto-wide",
  full: "wauto-full",
};
