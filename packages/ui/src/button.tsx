import type { ButtonHTMLAttributes } from "react";
import { Spinner } from "./loading";

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  title: string;
  secondary?: boolean;
};

export function Button({
  title,
  secondary = false,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={`${secondary ? "bg-secondary t-primary bg-button" : "bg-theme text-white active:bg-theme-active hover:bg-theme-hover"} h-min text-nowrap rounded-full px-4 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme/30 disabled:cursor-not-allowed disabled:opacity-50 ${className ?? ""}`}
    >
      {title}
    </button>
  );
}

export function ButtonWithLoading({
  title,
  onClick,
  loading,
  secondary = false,
  className,
}: {
  title: string;
  secondary?: boolean;
  loading: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      type="button"
      className={`${secondary ? "bg-secondary t-primary bg-button" : "bg-theme text-white active:bg-theme-active hover:bg-theme-hover"} flex h-min flex-row items-center space-x-2 text-nowrap rounded-full px-4 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme/30 disabled:cursor-not-allowed disabled:opacity-50 ${className ?? ""}`}
    >
      {loading && <Spinner size="1em" label={`${title}…`} className="text-current" />}
      <span>{title}</span>
    </button>
  );
}
