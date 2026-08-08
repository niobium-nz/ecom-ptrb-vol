import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

export const buttonVariants = cva("button ui-button", {
  variants: {
    intent: {
      accent: "button--accent",
      primary: "button--primary",
      secondary: "button--secondary",
    },
    fullWidth: {
      false: "",
      true: "button--full",
    },
  },
  defaultVariants: {
    intent: "primary",
    fullWidth: false,
  },
});

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export function Button({
  asChild = false,
  className,
  fullWidth,
  intent,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      className={buttonVariants({ className, fullWidth, intent })}
      {...props}
    />
  );
}
