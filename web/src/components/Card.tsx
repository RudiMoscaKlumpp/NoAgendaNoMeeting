import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={cn(
        "bg-surface-0 border-2 border-surface-2 rounded-xl p-6",
        className
      )}
    />
  );
}
