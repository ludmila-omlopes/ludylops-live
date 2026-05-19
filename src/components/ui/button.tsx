"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "btn-brutal inline-flex shrink-0 items-center justify-center whitespace-nowrap outline-none disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "ink-button text-[var(--color-accent-ink)]",
        accent: "accent-button text-[var(--color-accent-ink)]",
        neutral: "bg-[var(--color-paper)] text-[var(--color-ink)]",
        success: "bg-[var(--color-mint)] text-[var(--color-accent-ink)]",
        info: "bg-[var(--color-sky)] text-[var(--color-ink)]",
        danger: "bg-[var(--color-rose)] text-[var(--color-ink)]",
        pink: "bg-[var(--color-pink)] text-[var(--color-accent-ink)]",
        admin: "admin-action text-[var(--color-admin-ink)]",
      },
      size: {
        xs: "px-3 py-2 text-[11px]",
        sm: "px-4 py-2 text-xs",
        default: "px-5 py-2.5 text-sm",
        lg: "px-6 py-3 text-sm",
        icon: "px-3 py-2 text-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
