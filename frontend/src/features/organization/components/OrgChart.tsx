import { useState } from "react";
import { Users, ZoomIn, ZoomOut, UserCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/shared/utils/cn";
import type { DepartmentNode } from "@features/organization/types/organization.types";
import { chipFor, subtreeHeadcount, initials } from "@features/organization/utils/org.utils";

interface Props {
  tree: DepartmentNode[];
  selectedId: string | null;
  onSelect: (node: DepartmentNode) => void;
}

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 1.3;

export function OrgChart({ tree, selectedId, onSelect }: Props) {
  const [zoom, setZoom] = useState(1);

  return (
    <div className="relative">
      <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-full border bg-background/90 p-1 shadow-sm backdrop-blur">
        <button
          type="button"
          aria-label="Thu nhỏ"
          onClick={() => setZoom((z) => Math.max(MIN_ZOOM, +(z - 0.1).toFixed(2)))}
          className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ZoomOut className="size-4" />
        </button>
        <span className="w-10 text-center text-[11px] tabular-nums text-muted-foreground">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          aria-label="Phóng to"
          onClick={() => setZoom((z) => Math.min(MAX_ZOOM, +(z + 0.1).toFixed(2)))}
          className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ZoomIn className="size-4" />
        </button>
      </div>

      <div className="overflow-auto p-4">
        <div
          className="flex min-w-max origin-top justify-center gap-8 transition-transform"
          style={{ transform: `scale(${zoom})` }}
        >
          {tree.map((root) => (
            <OrgNode key={root.id} node={root} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </div>
      </div>
    </div>
  );
}

interface NodeProps {
  node: DepartmentNode;
  selectedId: string | null;
  onSelect: (node: DepartmentNode) => void;
}

function OrgNode({ node, selectedId, onSelect }: NodeProps) {
  const hasKids = node.children.length > 0;
  return (
    <div className="flex flex-col items-center">
      <NodeCard node={node} selected={selectedId === node.id} onSelect={onSelect} />
      {hasKids && (
        <>
          <span className="h-5 w-px bg-border" />
          <div className="flex items-start gap-6 border-t border-border pt-5">
            {node.children.map((child) => (
              <div key={child.id} className="flex flex-col items-center">
                <span className="-mt-5 h-5 w-px bg-border" />
                <OrgNode node={child} selectedId={selectedId} onSelect={onSelect} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function NodeCard({
  node, selected, onSelect,
}: { node: DepartmentNode; selected: boolean; onSelect: (n: DepartmentNode) => void }) {
  const chip = chipFor(node.code);
  return (
    <button
      type="button"
      onClick={() => onSelect(node)}
      className={cn(
        "flex w-56 flex-col gap-2 rounded-xl border bg-card p-3 text-left shadow-sm transition-all hover:shadow-md",
        selected && "ring-2 ring-ring",
        node.status === "archived" && "opacity-55",
      )}
    >
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Badge variant={chip as any} className="font-mono">{node.code}</Badge>
        <span className="flex-1 truncate text-[13px] font-semibold text-foreground">{node.name}</span>
      </div>

      <div className="flex items-center gap-2">
        <Avatar className="size-7">
          {node.head?.avatarUrl ? (
            <img src={node.head.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <AvatarFallback className="text-[10px]">
              {node.head ? initials(node.head.name) : <UserCircle2 className="size-4" />}
            </AvatarFallback>
          )}
        </Avatar>
        <span className="min-w-0 flex-1 truncate text-[11.5px] text-muted-foreground">
          {node.head?.name || "Chưa có trưởng phòng"}
        </span>
      </div>

      <div className="flex items-center justify-between border-t pt-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Users className="size-3.5" /> {node.headcount} trực tiếp
        </span>
        <span className="tabular-nums">{subtreeHeadcount(node)} toàn nhánh</span>
      </div>
    </button>
  );
}
