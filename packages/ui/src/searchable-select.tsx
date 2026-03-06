import { useEffect, useMemo, useRef, useState } from "react";

export type SearchableSelectOption = {
  label: string;
  value: string;
};

export function SearchableSelect({
  value,
  options,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  customValueLabel,
  allowCustomValue = false,
  searchable = true,
}: {
  value: string;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  customValueLabel?: (value: string) => string;
  allowCustomValue?: boolean;
  searchable?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const selectedOption = options.find((option) => option.value === value);
  const filteredOptions = useMemo(() => {
    if (!searchable) {
      return options;
    }

    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) => {
      const haystacks = [option.label, option.value];
      return haystacks.some((candidate) => candidate.toLowerCase().includes(normalizedQuery));
    });
  }, [normalizedQuery, options]);
  const canUseCustomValue =
    searchable &&
    allowCustomValue &&
    query.trim().length > 0 &&
    !options.some((option) => option.value.toLowerCase() === normalizedQuery || option.label.toLowerCase() === normalizedQuery);

  const buttonLabel = selectedOption?.label ?? value ?? placeholder ?? "";

  return (
    <div ref={rootRef} className="relative min-w-[15rem]">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-black/10 bg-w px-4 py-3 text-left text-sm t-primary transition-colors hover:border-black/20 focus:outline-none focus:ring-2 focus:ring-theme/20 dark:border-white/10 dark:hover:border-white/20"
        onClick={() => {
          setIsOpen((current) => !current);
          setQuery(value);
        }}
      >
        <span className={`min-w-0 truncate ${buttonLabel ? "t-primary" : "text-neutral-400 dark:text-neutral-500"}`}>
          {buttonLabel || placeholder}
        </span>
        <i className={`ri-arrow-down-s-line text-lg text-neutral-500 transition-transform dark:text-neutral-400 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 rounded-xl border border-black/10 bg-w p-3 shadow-lg dark:border-white/10">
          {searchable ? (
            <input
              autoFocus
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              placeholder={searchPlaceholder || placeholder}
              className="w-full rounded-lg border border-black/10 bg-w px-3 py-2 text-sm t-primary outline-none ring-0 placeholder:text-neutral-400 focus:border-black/20 dark:border-white/10 dark:placeholder:text-neutral-500 dark:focus:border-white/20"
            />
          ) : null}

          <div className={`${searchable ? "mt-3" : ""} max-h-64 overflow-auto`}>
            {filteredOptions.length === 0 && !canUseCustomValue ? (
              <p className="px-3 py-2 text-sm text-neutral-500 dark:text-neutral-400">{emptyLabel || "No results"}</p>
            ) : null}

            {filteredOptions.map((option) => {
              const selected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    selected
                      ? "bg-theme/10 text-theme"
                      : "text-neutral-700 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-white/5"
                  }`}
                  onClick={() => {
                    onChange(option.value);
                    setQuery(option.value);
                    setIsOpen(false);
                  }}
                >
                  <span className="truncate">{option.label}</span>
                  <span className="ml-3 shrink-0 text-xs text-neutral-400">{option.value}</span>
                </button>
              );
            })}

            {canUseCustomValue ? (
              <button
                type="button"
                className="mt-1 flex w-full items-center justify-between rounded-lg border border-dashed border-black/10 px-3 py-2 text-left text-sm text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-white/10 dark:text-neutral-200 dark:hover:bg-white/5"
                onClick={() => {
                  const nextValue = query.trim();
                  onChange(nextValue);
                  setQuery(nextValue);
                  setIsOpen(false);
                }}
              >
                <span className="truncate">
                  {customValueLabel ? customValueLabel(query.trim()) : query.trim()}
                </span>
                <span className="ml-3 shrink-0 text-[11px] uppercase tracking-[0.18em] text-neutral-400">Custom</span>
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
