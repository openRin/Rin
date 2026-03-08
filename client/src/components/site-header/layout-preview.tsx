import type { HeaderLayoutOption } from "./layout-options";
import { getHeaderLayoutDefinition } from "./layout-registry";
import type { HeaderLayoutPreviewData } from "./layout-types";
import { SettingsPreviewCard } from "../settings-preview-card";

export function HeaderLayoutPreview({
  data,
  layout,
  selected,
  title,
  description,
  onClick,
}: {
  data: HeaderLayoutPreviewData;
  layout: HeaderLayoutOption;
  selected: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  const layoutDefinition = getHeaderLayoutDefinition(layout);

  return (
    <SettingsPreviewCard
      title={title}
      description={description}
      selected={selected}
      onClick={onClick}
      preview={layoutDefinition.renderPreview(data)}
    />
  );
}
