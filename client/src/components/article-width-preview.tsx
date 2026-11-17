import { type ArticleWidth } from "./article-width-options";
import { SettingsPreviewCard } from "./settings-preview-card";

// 预览中正文行的宽度比例，对应 wauto / wauto-wide / wauto-full 的相对关系
const CONTENT_LINE_WIDTHS: Record<ArticleWidth, string> = {
  normal: "w-[55%]",
  wide: "w-[78%]",
  full: "w-full",
};

export function ArticleWidthPreview({
  description,
  selected,
  title,
  width,
  onClick,
}: {
  description: string;
  selected: boolean;
  title: string;
  width: ArticleWidth;
  onClick: () => void;
}) {
  const lineWidth = CONTENT_LINE_WIDTHS[width];

  return (
    <SettingsPreviewCard
      title={title}
      description={description}
      selected={selected}
      onClick={onClick}
      preview={
        <div className="flex w-full items-stretch gap-2">
          <div className="flex flex-1 flex-col justify-center gap-2 rounded-xl bg-black/5 p-3 dark:bg-white/5">
            <div className={`h-1.5 rounded-full bg-black/20 dark:bg-white/25 ${lineWidth}`} />
            <div className={`h-1.5 rounded-full bg-black/15 dark:bg-white/20 ${lineWidth}`} />
            <div className={`h-1.5 rounded-full bg-black/10 dark:bg-white/15 ${lineWidth}`} />
          </div>
          <div className="flex w-8 shrink-0 flex-col gap-2 rounded-xl bg-black/5 p-2 dark:bg-white/5">
            <div className="h-1 rounded-full bg-black/15 dark:bg-white/20" />
            <div className="h-1 w-2/3 rounded-full bg-black/10 dark:bg-white/15" />
            <div className="h-1 w-3/4 rounded-full bg-black/10 dark:bg-white/15" />
          </div>
        </div>
      }
    />
  );
}
