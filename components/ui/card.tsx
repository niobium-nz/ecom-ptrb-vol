import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

export const cardVariants = cva("ui-card", {
  variants: {
    surface: {
      base: "ui-card--base",
      checkout: "checkout-card",
      proof: "testimonial-card",
    },
  },
  defaultVariants: {
    surface: "base",
  },
});

export type CardProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof cardVariants> & {
    asChild?: boolean;
  };

export function Card({ asChild = false, className, surface, ...props }: CardProps) {
  const Component = asChild ? Slot : "div";
  return <Component className={cardVariants({ className, surface })} {...props} />;
}
