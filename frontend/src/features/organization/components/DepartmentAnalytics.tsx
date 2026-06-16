import { useMemo } from "react";
import { Building2, Users, Layers, UserCog } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { DepartmentNode } from "@features/organization/types/organization.types";
import { chipFor, treeDepth } from "@features/organization/utils/org.utils";

interface Props {
  flat: DepartmentNode[];
  tree: DepartmentNode[];
}

const TILE_ICON = { Building2, Users, Layers, UserCog };

export function DepartmentAnalytics({ flat, tree }: Props) {
  const stats = useMemo(() => {
    const active = flat.filter((d) => d.status === "active");
    const headcount = flat.reduce((s, d) => s + d.headcount, 0);
    const withHead = active.filter((d) => d.managerId).length;
    const headRate = active.length ? Math.round((withHead / active.length) * 100) : 0;
    const topByHeadcount = [...flat]
      .filter((d) => d.headcount > 0)
      .sort((a, b) => b.headcount - a.headcount)
      .slice(0, 6);
    const maxHead = topByHeadcount[0]?.headcount ?? 1;
    return { total: flat.length, headcount, depth: treeDepth(tree), headRate, topByHeadcount, maxHead };
  }, [flat, tree]);

  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12 grid grid-cols-2 gap-4 lg:col-span-7 lg:grid-cols-4">
        <Tile chip="blue" icon="Building2" label="Phòng ban" value={stats.total} />
        <Tile chip="violet" icon="Users" label="Tổng nhân sự" value={stats.headcount} />
        <Tile chip="cyan" icon="Layers" label="Số cấp tổ chức" value={stats.depth} />
        <Tile chip="emerald" icon="UserCog" label="Có trưởng phòng" value={`${stats.headRate}%`} />
      </div>

      <Card className="col-span-12 flex flex-col p-5 lg:col-span-5">
        <h3 className="mb-3 text-[13px] font-semibold text-foreground">
          Phân bổ nhân sự theo phòng
        </h3>
        {stats.topByHeadcount.length === 0 ? (
          <p className="py-4 text-center text-[12.5px] text-muted-foreground">
            Chưa có dữ liệu nhân sự.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {stats.topByHeadcount.map((d) => (
              <li key={d.id} className="flex items-center gap-3 text-[12px]">
                <span className="w-14 shrink-0 truncate font-mono text-muted-foreground">{d.code}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.max(6, (d.headcount / stats.maxHead) * 100)}%`,
                      background: `var(--chip-${chipFor(d.code)}-ink)`,
                    }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right tabular-nums text-foreground">
                  {d.headcount}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Tile({
  chip, icon, label, value,
}: { chip: string; icon: keyof typeof TILE_ICON; label: string; value: number | string }) {
  const Icon = TILE_ICON[icon];
  return (
    <Card className="flex items-center gap-3.5 p-4">
      <span
        className="flex size-11 items-center justify-center rounded-2xl"
        style={{ background: `var(--chip-${chip}-bg)`, color: `var(--chip-${chip}-ink)` }}
      >
        <Icon className="size-5" strokeWidth={1.9} />
      </span>
      <div>
        <div className="text-[22px] font-bold leading-none tabular-nums text-foreground">{value}</div>
        <div className="mt-1 text-[12px] text-muted-foreground">{label}</div>
      </div>
    </Card>
  );
}
