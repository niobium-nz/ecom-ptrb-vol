import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

export const badgeVariants = cva("ui-badge", {
  variants: {
    tone: {
      quiet: "ui-badge--quiet",
      recommended: "offer-card__badge",
    },
  },
  defaultVariants: {
    tone: "quiet",
  },
});

export type BadgeProps = HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={badgeVariants({ className, tone })} {...props} />;
}
