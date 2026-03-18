import type { ReactNode } from "react";
import ReactLoading from "react-loading";

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