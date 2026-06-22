import { useEffect, useRef, useState } from "react";
import { Bookmark, Check, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/shared/utils/cn";

export interface FilterState {
  dept: string;
  status: string;
  employeeType: string;
  q: string;
}

export interface SavedView extends FilterState {
  name: string;
}

const STORAGE_KEY = "soosky.emp.savedViews";

function load(): SavedView[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedView[]) : [];
  } catch {
    return [];
  }
}
function persist(views: SavedView[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(views)); } catch { /* ignore quota */ }
}

const isEmpty = (f: FilterState) => !f.dept && !f.status && !f.employeeType && !f.q.trim();

interface Props {
  current: FilterState;
  onApply: (f: FilterState) => void;
}

export function SavedFilters({ current, onApply }: Props) {
  const [views, setViews] = useState<SavedView[]>(() => load());
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function save() {
    const n = name.trim();
    if (!n || isEmpty(current)) return;
    const next = [...views.filter((v) => v.name !== n), { name: n, ...current }];
    setViews(next); persist(next); setName("");
  }
  function remove(n: string) {
    const next = views.filter((v) => v.name !== n);
    setViews(next); persist(next);
  }

  return (
    <div className="relative" ref={ref}>
      <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)} className="h-9 gap-2 rounded-full text-[13px]">
        <Bookmark className="size-3.5" strokeWidth={1.9} /> Bộ lọc đã lưu
        {views.length > 0 && <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums">{views.length}</span>}
      </Button>
      {open && (
        <div className="absolute right-0 top-11 z-30 w-[280px] rounded-xl border bg-card p-2 shadow-md">
          {views.length === 0 ? (
            <p className="px-2 py-3 text-center text-[12.5px] text-muted-foreground">Chưa có bộ lọc nào được lưu.</p>
          ) : (
            <div className="flex max-h-[240px] flex-col gap-0.5 overflow-y-auto">
              {views.map((v) => (
                <div key={v.name} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted">
                  <button onClick={() => { onApply({ dept: v.dept, status: v.status, employeeType: v.employeeType, q: v.q }); setOpen(false); }}
                    className="flex flex-1 items-center gap-2 text-left text-[13px] text-foreground">
                    <Check className="size-3.5 text-primary-500" strokeWidth={2.2} /> {v.name}
                  </button>
                  <button onClick={() => remove(v.name)} aria-label={`Xoá ${v.name}`} className="text-muted-foreground hover:text-rose-600"><Trash2 className="size-3.5" /></button>
                </div>
              ))}
            </div>
          )}
          <div className="mt-2 flex items-center gap-1.5 border-t pt-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên bộ lọc hiện tại…"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } }}
              className={cn("h-8 flex-1 rounded-lg border border-input bg-card px-2.5 text-[12.5px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring")} />
            <Button size="icon" className="size-8 rounded-lg" disabled={!name.trim() || isEmpty(current)} onClick={save} aria-label="Lưu bộ lọc">
              <Plus className="size-4" />
            </Button>
          </div>
          {isEmpty(current) && <p className="px-1 pt-1.5 text-[11px] text-muted-foreground"><X className="mr-0.5 inline size-3" />Chọn ít nhất 1 bộ lọc để lưu.</p>}
        </div>
      )}
    </div>
  );
}
