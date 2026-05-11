import type { ButtonHTMLAttributes } from "react";
import { cn } from "../lib/cn";

type Variant = "primary" | "outline" | "ghost" | "destructive";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const base =
  "inline-flex items-center justify-center px-6 py-3 rounded-xl border-2 font-black uppercase tracking-widest text-sm transition-[transform,background-color,border-color] duration-150 active:translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:translate-y-0";

const variants: Record<Variant, string> = {
  primary: "bg-sapphire text-on-accent border-sapphire hover:bg-sapphire/90",
  outline:
    "bg-surface-0 text-text border-surface-2 hover:border-overlay-0",
  ghost: "bg-transparent text-text border-transparent hover:bg-surface-0",
  destructive: "bg-red text-on-accent border-red hover:bg-red/90",
};

export function Button({ variant = "primary", className, ...rest }: Props) {
  return <button {...rest} className={cn(base, variants[variant], className)} />;
}
