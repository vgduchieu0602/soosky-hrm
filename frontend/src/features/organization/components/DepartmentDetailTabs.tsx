import {
  Pencil, Archive, CornerDownRight, UserCog, Move, ArrowRightLeft, GitMerge,
  Plus, Briefcase, Trash2, Clock, UserCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type {
  DepartmentHistoryEntry,
  DepartmentNode,
  Position,
} from "@features/organization/types/organization.types";
import { chipFor, subtreeHeadcount, initials } from "@features/organization/utils/org.utils";
import { DepartmentMembers } from "@features/organization/components/DepartmentMembers";

interface Props {
  node: DepartmentNode;
  positions: Position[];
  history: DepartmentHistoryEntry[];
  canManage: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onAddSub: () => void;
  onAssignHead: () => void;
  onMove: () => void;
  onTransfer: () => void;
  onMerge: () => void;
  onAddPosition: () => void;
  onEditPosition: (p: Position) => void;
  onDeletePosition: (p: Position) => void;
}

const HISTORY_LABEL: Record<string, string> = {
  create: "Tạo phòng ban",
  update: "Cập nhật",
  delete: "Lưu trữ / gộp",
};

function describeHistory(h: DepartmentHistoryEntry): string {
  const c = h.changes ?? {};
  if (c.moved) return "Di chuyển trong sơ đồ tổ chức";
  if ("managerId" in c) return c.managerId ? "Bổ nhiệm trưởng phòng" : "Miễn nhiệm trưởng phòng";
  if (c.transferredTo) return `Điều chuyển ${c.count ?? ""} nhân sự`;
  if (c.mergedInto) return "Gộp vào phòng ban khác";
  return HISTORY_LABEL[h.action] ?? h.action;
}

export function DepartmentDetailTabs({
  node, positions, history, canManage, onEdit, onArchive, onAddSub,
  onAssignHead, onMove, onTransfer, onMerge, onAddPosition, onEditPosition, onDeletePosition,
}: Props) {
  const chip = chipFor(node.code);
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Badge variant={chip as any} className="font-mono text-[11px]">{node.code}</Badge>
        <div className="min-w-0 flex-1">
          <h2 className="text-[18px] font-bold tracking-tight text-foreground">{node.name}</h2>
          {node.description && (
            <p className="mt-1 text-[12.5px] text-muted-foreground">{node.description}</p>
          )}
        </div>
        {node.status === "archived" && (
          <Badge variant="secondary" className="text-[10px]">Đã lưu trữ</Badge>
        )}
      </div>

      {canManage && (
        <div className="flex flex-wrap gap-2">
          <ActionBtn icon={Pencil} label="Chỉnh sửa" onClick={onEdit} />
          <ActionBtn icon={CornerDownRight} label="Thêm đơn vị con" onClick={onAddSub} />
          <ActionBtn icon={UserCog} label="Trưởng phòng" onClick={onAssignHead} />
          <ActionBtn icon={Move} label="Di chuyển" onClick={onMove} />
          <ActionBtn icon={ArrowRightLeft} label="Điều chuyển NS" onClick={onTransfer} />
          {node.status === "active" && (
            <>
              <ActionBtn icon={GitMerge} label="Gộp phòng" onClick={onMerge} />
              <ActionBtn icon={Archive} label="Lưu trữ" onClick={onArchive} danger />
            </>
          )}
        </div>
      )}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Tổng quan</TabsTrigger>
          <TabsTrigger value="members">Nhân sự</TabsTrigger>
          <TabsTrigger value="positions">Chức vụ</TabsTrigger>
          <TabsTrigger value="history">Lịch sử</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="flex flex-col gap-4">
          <HeadCard node={node} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Stat label="Trực tiếp" value={node.headcount} />
            <Stat label="Tổng nhánh" value={subtreeHeadcount(node)} />
            <Stat
              label="Trạng thái"
              value={node.status === "active" ? "Hoạt động" : "Lưu trữ"}
              small
            />
          </div>
          {node.children.length > 0 && (
            <div>
              <h3 className="mb-2 text-[13px] font-semibold text-foreground">Đơn vị con</h3>
              <ul className="flex flex-col gap-1.5">
                {node.children.map((c) => (
                  <li key={c.id} className="flex items-center gap-2.5 rounded-lg border bg-muted/30 px-3 py-2 text-[12.5px]">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <Badge variant={chipFor(c.code) as any} className="font-mono">{c.code}</Badge>
                    <span className="flex-1 font-semibold text-foreground">{c.name}</span>
                    <span className="tabular-nums text-muted-foreground">{subtreeHeadcount(c)} NV</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </TabsContent>

        <TabsContent value="members">
          <DepartmentMembers departmentId={node.id} />
        </TabsContent>

        <TabsContent value="positions">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-foreground">Chức vụ</h3>
            {canManage && (
              <Button variant="outline" size="sm" className="h-7 gap-1.5 text-[12px]" onClick={onAddPosition}>
                <Plus className="size-3.5" /> Thêm chức vụ
              </Button>
            )}
          </div>
          {positions.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-6 text-center text-[12.5px] text-muted-foreground">
              <span>Chưa có chức vụ nào trong phòng ban này.</span>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {positions.map((p) => (
                <li key={p._id} className="group flex items-center gap-3 rounded-xl border p-3 text-[12.5px]">
                  <Briefcase className="size-4 text-muted-foreground" />
                  <span className="flex-1 font-semibold text-foreground">{p.title}</span>
                  <Badge variant="secondary" className="font-mono">{p.code}</Badge>
                  <span className="w-12 text-right tabular-nums text-muted-foreground">Lv {p.level}</span>
                  {canManage && (
                    <span className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button type="button" onClick={() => onEditPosition(p)} aria-label="Sửa chức vụ"
                        className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                        <Pencil className="size-3.5" />
                      </button>
                      <button type="button" onClick={() => onDeletePosition(p)} aria-label="Xoá chức vụ"
                        className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="size-3.5" />
                      </button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="history">
          {history.length === 0 ? (
            <p className="rounded-xl border border-dashed py-6 text-center text-[12.5px] text-muted-foreground">
              Chưa có thay đổi nào được ghi nhận.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {history.slice(0, 15).map((h) => (
                <li key={h._id} className="flex items-center gap-2.5 rounded-lg border bg-muted/20 px-3 py-2 text-[12px]">
                  <Clock className="size-3.5 text-muted-foreground" />
                  <span className="flex-1 font-medium text-foreground">{describeHistory(h)}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {new Date(h.timestamp).toLocaleString("vi-VN", { hour12: false })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ActionBtn({
  icon: Icon, label, onClick, danger,
}: { icon: typeof Pencil; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <Button
      variant="outline"
      size="sm"
      className={danger ? "h-8 gap-1.5 text-[12px] text-destructive hover:text-destructive" : "h-8 gap-1.5 text-[12px]"}
      onClick={onClick}
    >
      <Icon className="size-3.5" /> {label}
    </Button>
  );
}

function HeadCard({ node }: { node: DepartmentNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-muted/20 p-3">
      <Avatar className="size-11">
        {node.head?.avatarUrl ? (
          <img src={node.head.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <AvatarFallback>
            {node.head ? initials(node.head.name) : <UserCircle2 className="size-5" />}
          </AvatarFallback>
        )}
      </Avatar>
      <div className="min-w-0">
        <div className="text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
          Trưởng phòng
        </div>
        <div className="truncate text-[13.5px] font-semibold text-foreground">
          {node.head?.name || "Chưa bổ nhiệm"}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, small }: { label: string; value: number | string; small?: boolean }) {
  return (
    <div className="rounded-xl border p-3">
      <div className="text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={small ? "mt-1 text-[13px] font-semibold text-foreground" : "mt-1 text-[20px] font-semibold tabular-nums text-foreground"}>
        {value}
      </div>
    </div>
  );
}
