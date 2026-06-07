import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-muted text-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground",
        emerald: "border-transparent bg-emerald-50 text-emerald-700",
        amber: "border-transparent bg-amber-50 text-amber-700",
        rose: "border-transparent bg-rose-50 text-rose-700",
        blue: "border-transparent bg-sky-50 text-sky-700",
        violet: "border-transparent bg-violet-50 text-violet-700",
        indigo: "border-transparent bg-indigo-50 text-indigo-700",
        slate: "border-transparent bg-slate-100 text-slate-700",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
