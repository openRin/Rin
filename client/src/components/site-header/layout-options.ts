export const HEADER_LAYOUT_OPTIONS = ["classic", "compact"] as const;
export const HEADER_BEHAVIOR_OPTIONS = ["fixed", "static", "reveal"] as const;

export type HeaderLayoutOption = (typeof HEADER_LAYOUT_OPTIONS)[number];
export type HeaderBehaviorOption = (typeof HEADER_BEHAVIOR_OPTIONS)[number];

export function normalizeHeaderLayout(value: string | undefined | null): HeaderLayoutOption {
  if (value && HEADER_LAYOUT_OPTIONS.includes(value as HeaderLayoutOption)) {
    return value as HeaderLayoutOption;
  }

  return "classic";
}

export function normalizeHeaderBehavior(value: string | undefined | null): HeaderBehaviorOption {
  if (value && HEADER_BEHAVIOR_OPTIONS.includes(value as HeaderBehaviorOption)) {
    return value as HeaderBehaviorOption;
  }

  return "fixed";
}
