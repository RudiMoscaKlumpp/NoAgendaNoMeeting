import type { TextareaHTMLAttributes } from "react";
import { cn } from "../lib/cn";

export function Textarea({
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...rest}
      className={cn(
        "w-full bg-surface-0 border-2 border-surface-2 rounded-lg px-4 py-3 text-base text-text placeholder:text-overlay-1 outline-none transition-[border-color,box-shadow] duration-150 focus:border-sapphire focus:ring-2 focus:ring-sapphire/30 resize-y",
        className
      )}
    />
  );
}
