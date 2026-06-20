import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/shared/utils/cn";

type Tone = "cyan" | "blue" | "violet" | "emerald" | "amber" | "indigo" | "rose";

interface Props {
  icon: LucideIcon;
  tone?: Tone;
  title: string;
  description?: string;
  /** Right-aligned controls (e.g. an action button). */
  action?: React.ReactNode;
  /** Inline pill shown next to the title (e.g. a count). */
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * Consistent settings panel: a tinted icon chip + title/description header,
 * an optional badge and action, and a body. Gives every settings card the
 * same visual rhythm and hierarchy.
 */
export function SettingsSection({ icon: Icon, tone = "cyan", title, description, action, badge, children, className }: Props) {
  return (
    <Card className={cn("p-5 sm:p-6", className)}>
      <div className="flex items-start gap-3.5">
        <span
          className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `var(--chip-${tone}-bg)`, color: `var(--chip-${tone}-ink)` }}
          aria-hidden
        >
          <Icon className="size-[18px]" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-semibold tracking-tight text-foreground">{title}</h3>
            {badge}
          </div>
          {description && <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="mt-5">{children}</div>
    </Card>
  );
}

export function CountBadge({ children, tone = "cyan" }: { children: React.ReactNode; tone?: Tone }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[11.5px] font-semibold tabular-nums"
      style={{ background: `var(--chip-${tone}-bg)`, color: `var(--chip-${tone}-ink)` }}
    >
      {children}
    </span>
  );
}
