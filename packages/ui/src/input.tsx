import type { Dispatch, SetStateAction } from "react";
import { forwardRef } from "react";

interface InputProps {
  autofocus?: boolean;
  value: string;
  className?: string;
  placeholder: string;
  id?: number;
  setValue: (value: string) => void;
  onSubmit?: () => void;
  disabled?: boolean;
  type?: string;
  variant?: "default" | "flat";
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ autofocus, value, setValue, className, placeholder, onSubmit, disabled, type = "text", variant = "default" }, ref) => {
    const variantClass =
      variant === "flat"
        ? "border border-black/10 bg-w shadow-none dark:border-white/10"
        : "border border-black/10 bg-w shadow-none dark:border-white/10";

    return (
      <input
        ref={ref}
        type={type}
        disabled={disabled}
        autoFocus={autofocus}
        placeholder={placeholder}
        value={value}
        onKeyDown={(event) => {
          if (event.key === "Enter" && onSubmit) {
            onSubmit();
          }
        }}
        onChange={(event) => {
          setValue(event.target.value);
        }}
        className={`w-full rounded-xl px-4 py-2 t-primary transition-colors placeholder:text-neutral-400 focus:border-black/20 focus:outline-none focus:ring-2 focus:ring-theme/10 disabled:cursor-not-allowed disabled:opacity-50 dark:placeholder:text-neutral-500 dark:focus:border-white/20 ${variantClass} ${className ?? ""}`}
      />
    );
  },
);

Input.displayName = "Input";

export function Checkbox({
  value,
  setValue,
  className,
  placeholder,
}: {
  value: boolean;
  className?: string;
  placeholder: string;
  id: string;
  setValue: Dispatch<SetStateAction<boolean>>;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={placeholder}
      aria-checked={value}
      onClick={(event) => {
        event.stopPropagation();
        setValue((current) => !current);
      }}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-theme/20 ${
        value ? "bg-theme" : "bg-neutral-200 dark:bg-neutral-600"
      } ${className ?? ""}`}
    >
      <span
        className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${value ? "translate-x-6" : "translate-x-1"}`}
      />
    </button>
  );
}
