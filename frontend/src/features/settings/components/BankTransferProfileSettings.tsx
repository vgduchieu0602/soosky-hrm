import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Check, FileSpreadsheet, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/shared/utils/cn";
import { apiErrorMessage } from "@shared/utils/apiError";
import { SettingsSection, CountBadge } from "@features/settings/components/SettingsSection";
import {
  BANK_COLUMN_LABELS, BANK_COLUMN_SOURCES,
  bankTransferService,
  type BankColumnSource, type BankTransferColumn, type BankTransferProfile,
} from "@features/settings/services/bankTransfer.service";

const inputCls =
  "flex h-9 w-full rounded-lg border border-input bg-card px-3 text-[13px] focus-visible:outline-none focus-visible:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500/20";

const DELIMITER_OPTIONS = [
  { value: ",", label: "Phẩy (,)" },
  { value: ";", label: "Chấm phẩy (;)" },
  { value: "\t", label: "Tab" },
  { value: "|", label: "Gạch dọc (|)" },
];

const DATE_FORMATS = ["dd/MM/yyyy", "yyyy-MM-dd", "ddMMyyyy"];

/** Mẫu khởi tạo: đủ cột để chuyển khoản được ngay, HR sửa lại theo ngân hàng. */
const DEFAULT_COLUMNS: BankTransferColumn[] = [
  { header: "STT", source: "sequence" },
  { header: "So tai khoan", source: "bank_account_number" },
  { header: "Ten nguoi nhan", source: "bank_account_holder" },
  { header: "So tien", source: "net_salary" },
  { header: "Noi dung", source: "static", staticValue: "Thanh toan luong" },
];

interface Props { canManage: boolean }

/**
 * Cấu hình mẫu file chuyển lương theo ngân hàng.
 *
 * Không hard-code ngân hàng nào: HR/Admin khai cột nào lấy dữ liệu gì, dấu phân
 * cách, định dạng số/ngày. Payroll sinh file theo đúng mô tả này.
 */
export function BankTransferProfileSettings({ canManage }: Props) {
  const [profiles, setProfiles] = useState<BankTransferProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [form, setForm] = useState({ code: "", bankName: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [columns, setColumns] = useState<BankTransferColumn[]>(DEFAULT_COLUMNS);

  useEffect(() => {
    let cancelled = false;
    bankTransferService.list()
      .then((rows) => { if (!cancelled) { setProfiles(rows); setLoading(false); } })
      .catch(() => { if (!cancelled) { setProfiles([]); setLoading(false); } });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);
  const editing = profiles.find((row) => row.id === editingId);

  function create() {
    bankTransferService.create({
      code: form.code.trim(),
      bankName: form.bankName.trim(),
      columns: DEFAULT_COLUMNS,
    })
      .then(() => { setForm({ code: "", bankName: "" }); reload(); toast.success("Đã thêm mẫu file ngân hàng"); })
      .catch((err) => toast.error(apiErrorMessage(err)));
  }

  function activate(id: string) {
    bankTransferService.activate(id)
      .then(() => { reload(); toast.success("Đã chọn mẫu đang dùng"); })
      .catch((err) => toast.error(apiErrorMessage(err)));
  }

  function remove(id: string) {
    if (!window.confirm("Xoá mẫu file ngân hàng này?")) return;
    bankTransferService.remove(id)
      .then(() => { reload(); toast.success("Đã xoá"); })
      .catch((err) => toast.error(apiErrorMessage(err)));
  }

  function startEdit(profile: BankTransferProfile) {
    setEditingId(profile.id);
    setColumns(profile.columns.map((column) => ({ ...column })));
  }

  function saveColumns() {
    if (editingId == null) return;
    bankTransferService.update(editingId, { columns })
      .then(() => { setEditingId(null); reload(); toast.success("Đã lưu cấu hình cột"); })
      .catch((err) => toast.error(apiErrorMessage(err)));
  }

  function patchProfile(id: string, patch: Parameters<typeof bankTransferService.update>[1]) {
    bankTransferService.update(id, patch)
      .then(() => { reload(); toast.success("Đã lưu"); })
      .catch((err) => toast.error(apiErrorMessage(err)));
  }

  function moveColumn(index: number, delta: number) {
    setColumns((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      const moved = next[index];
      const swapped = next[target];
      if (moved == null || swapped == null) return current;
      next[index] = swapped;
      next[target] = moved;
      return next;
    });
  }

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-muted/50" />;

  return (
    <SettingsSection
      icon={FileSpreadsheet}
      tone="indigo"
      title="Mẫu file chuyển lương"
      description="Khai cấu trúc file nộp cho ngân hàng: cột nào lấy dữ liệu gì, dấu phân cách, định dạng số và ngày. Đúng một mẫu được dùng tại một thời điểm."
      badge={<CountBadge>{profiles.length}</CountBadge>}
    >
      <div className="flex flex-col gap-4">
        {canManage && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-[140px]">
              <label className="mb-1 block text-[12px] text-muted-foreground">Mã mẫu</label>
              <input className={inputCls} value={form.code} placeholder="VCB"
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
            </div>
            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-[12px] text-muted-foreground">Tên ngân hàng</label>
              <input className={inputCls} value={form.bankName} placeholder="Vietcombank"
                onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))} />
            </div>
            <Button size="sm" className="h-9 gap-1.5"
              disabled={form.code.trim().length < 2 || form.bankName.trim().length === 0}
              onClick={create}>
              <Plus className="size-3.5" /> Thêm mẫu
            </Button>
          </div>
        )}

        {profiles.length === 0 && (
          <p className="rounded-xl border bg-muted/30 px-4 py-3 text-[13px] text-muted-foreground">
            Chưa có mẫu nào. Payroll sẽ báo lỗi khi xuất file chuyển lương cho tới khi có một mẫu được bật.
          </p>
        )}

        {profiles.map((profile) => (
          <div key={profile.id} className={cn("rounded-xl border p-4", profile.isActive && "border-primary-500/60 bg-primary-50/40")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[13.5px] font-semibold">{profile.code}</span>
                <span className="text-[13px] text-muted-foreground">{profile.bankName}</span>
                {profile.isActive && <Badge variant="emerald">Đang dùng</Badge>}
              </div>
              {canManage && (
                <div className="flex items-center gap-1.5">
                  {!profile.isActive && (
                    <Button size="sm" variant="outline" className="h-8 gap-1.5 text-[12.5px]" onClick={() => activate(profile.id)}>
                      <Check className="size-3.5" /> Dùng mẫu này
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="h-8 text-[12.5px]"
                    onClick={() => (editingId === profile.id ? setEditingId(null) : startEdit(profile))}>
                    {editingId === profile.id ? "Đóng" : "Sửa cột"}
                  </Button>
                  {!profile.isActive && (
                    <Button size="sm" variant="outline" className="h-8 text-rose-600" onClick={() => remove(profile.id)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-end gap-2">
              <div className="w-[150px]">
                <label className="mb-1 block text-[12px] text-muted-foreground">Dấu phân cách</label>
                <select className={inputCls} value={profile.delimiter} disabled={!canManage}
                  onChange={(e) => patchProfile(profile.id, { delimiter: e.target.value })}>
                  {DELIMITER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="w-[150px]">
                <label className="mb-1 block text-[12px] text-muted-foreground">Định dạng số tiền</label>
                <select className={inputCls} value={profile.amountFormat} disabled={!canManage}
                  onChange={(e) => patchProfile(profile.id, { amountFormat: e.target.value as "plain" | "grouped" })}>
                  <option value="plain">Số nguyên (20000000)</option>
                  <option value="grouped">Có phân cách (20,000,000)</option>
                </select>
              </div>
              <div className="w-[150px]">
                <label className="mb-1 block text-[12px] text-muted-foreground">Định dạng ngày</label>
                <select className={inputCls} value={profile.dateFormat} disabled={!canManage}
                  onChange={(e) => patchProfile(profile.id, { dateFormat: e.target.value })}>
                  {DATE_FORMATS.map((format) => <option key={format} value={format}>{format}</option>)}
                </select>
              </div>
              <label className="flex h-9 items-center gap-2 text-[13px]">
                <input type="checkbox" checked={profile.includeHeader} disabled={!canManage}
                  onChange={(e) => patchProfile(profile.id, { includeHeader: e.target.checked })} />
                Có dòng tiêu đề
              </label>
              <label className="flex h-9 items-center gap-2 text-[13px]" title="Nhiều cổng ngân hàng đọc sai tiếng Việt nếu thiếu BOM">
                <input type="checkbox" checked={profile.utf8Bom} disabled={!canManage}
                  onChange={(e) => patchProfile(profile.id, { utf8Bom: e.target.checked })} />
                Thêm BOM UTF-8
              </label>
            </div>

            {editingId === profile.id ? (
              <div className="mt-3 flex flex-col gap-2">
                {columns.map((column, index) => (
                  <div key={`${column.source}-${index}`} className="flex flex-wrap items-center gap-2">
                    <input className={cn(inputCls, "w-[170px]")} value={column.header}
                      placeholder="Tiêu đề cột"
                      onChange={(e) => setColumns((current) => current.map((row, i) => (i === index ? { ...row, header: e.target.value } : row)))} />
                    <select className={cn(inputCls, "w-[190px]")} value={column.source}
                      onChange={(e) => setColumns((current) => current.map((row, i) => (i === index ? { ...row, source: e.target.value as BankColumnSource } : row)))}>
                      {BANK_COLUMN_SOURCES.map((source) => (
                        <option key={source} value={source}>{BANK_COLUMN_LABELS[source]}</option>
                      ))}
                    </select>
                    {column.source === "static" && (
                      <input className={cn(inputCls, "w-[200px]")} value={column.staticValue ?? ""}
                        placeholder="Giá trị cố định"
                        onChange={(e) => setColumns((current) => current.map((row, i) => (i === index ? { ...row, staticValue: e.target.value } : row)))} />
                    )}
                    <Button size="sm" variant="outline" className="size-8 p-0" onClick={() => moveColumn(index, -1)}>
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" className="size-8 p-0" onClick={() => moveColumn(index, 1)}>
                      <ArrowDown className="size-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" className="size-8 p-0 text-rose-600"
                      onClick={() => setColumns((current) => current.filter((_, i) => i !== index))}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}

                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="h-8 gap-1.5 text-[12.5px]"
                    onClick={() => setColumns((current) => [...current, { header: "", source: "employee_code" }])}>
                    <Plus className="size-3.5" /> Thêm cột
                  </Button>
                  <Button size="sm" className="h-8 text-[12.5px]" onClick={saveColumns}>Lưu cột</Button>
                </div>

                <p className="text-[12px] text-muted-foreground">
                  Bắt buộc có cột <b>Số tài khoản</b> và <b>Số tiền (thực nhận)</b> — thiếu thì file không dùng để chuyển khoản được.
                </p>
              </div>
            ) : (
              <p className="mt-3 text-[12.5px] text-muted-foreground">
                Cột: {profile.columns.map((column) => column.header).join(" · ")}
              </p>
            )}
          </div>
        ))}

        {editing == null && profiles.some((row) => row.isActive) && (
          <p className="text-[12px] text-muted-foreground">
            File chuyển lương tải ở trang Bảng lương, sau khi lương đã được duyệt.
          </p>
        )}
      </div>
    </SettingsSection>
  );
}
