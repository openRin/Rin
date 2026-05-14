import { attachImageMetadataToUrl } from "../utils/image-upload";
import { FeedCard, type FeedCardProps } from "./feed_card";
import { type FeedCardVariant } from "./feed-card-options";
import { SettingsPreviewCard } from "./settings-preview-card";

const PREVIEW_IMAGE_URL = attachImageMetadataToUrl(
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 720'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop stop-color='%23f3d7bf'/%3E%3Cstop offset='0.55' stop-color='%23d9e7f5'/%3E%3Cstop offset='1' stop-color='%23f8c4cf'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='1200' height='720' fill='url(%23g)'/%3E%3Ccircle cx='220' cy='180' r='110' fill='rgba(255,255,255,0.45)'/%3E%3Ccircle cx='960' cy='132' r='84' fill='rgba(255,255,255,0.32)'/%3E%3Cpath d='M0 566C108 490 206 462 295 482c117 26 175 132 292 132 102 0 156-66 252-66 102 0 179 72 361 172H0Z' fill='rgba(34,34,34,0.12)'/%3E%3Cpath d='M0 610c97-40 182-49 256-28 96 28 153 101 258 101 103 0 173-70 286-70 109 0 201 53 400 107H0Z' fill='rgba(255,255,255,0.36)'/%3E%3C/svg%3E",
  {
    blurhash: "LEHV6nWB2yk8pyo0adR*.7kCMdnj",
    width: 1200,
    height: 720,
  },
);

const PREVIEW_PROPS: FeedCardProps = {
  id: "preview-feed-card",
  title: "A quieter card with stronger hierarchy",
  summary:
    "This preview shows how article lists feel before you save. The image, metadata, and tags all respond to the selected feed card style.",
  avatar: PREVIEW_IMAGE_URL,
  hashtags: [
    { id: 1, name: "design" },
    { id: 2, name: "reading" },
  ],
  createdAt: new Date("2026-03-01T10:00:00.000Z"),
  updatedAt: new Date("2026-03-03T12:00:00.000Z"),
  draft: 0,
  listed: 1,
  top: 1,
};

export function FeedCardPreview({
  description,
  selected,
  title,
  variant,
  onClick,
}: {
  description: string;
  selected: boolean;
  title: string;
  variant: FeedCardVariant;
  onClick: () => void;
}) {
  return (
    <SettingsPreviewCard
      title={title}
      description={description}
      selected={selected}
      onClick={onClick}
      preview={<FeedCard {...PREVIEW_PROPS} preview variant={variant} />}
    />
  );
}
