import type { ReactNode } from "react";
import ReactLoading from "react-loading";

export function Spinner({
  size = "1.25em",
  label = "Loading",
  className = "text-theme",
}: {
  size?: string;
  label?: string;
  className?: string;
}) {
  return (
    <span role="status" aria-label={label} className={`inline-flex shrink-0 ${className}`}>
      <ReactLoading width={size} height={size} type="spin" color="currentColor" />
    </span>
  );
}

export function Waiting({
  for: wait,
  children,
}: {
  for?: unknown;
  children?: ReactNode;
}) {
  return !wait ? (
    <div className="w-full h-96 flex flex-col justify-center items-center mb-8 ani-show-fast text-theme">
      <ReactLoading type="cylon" color="currentColor" />
    </div>
  ) : (
    <>{children}</>
  );
}
