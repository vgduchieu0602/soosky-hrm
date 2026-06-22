import { useState } from "react";
import { Download, FileUp, CheckCircle2, AlertCircle } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { employeeService } from "@features/employee/services/employee.service";
import type { ImportEmployeeRow, ImportResult } from "@features/employee/types/employee.types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

const REQUIRED = ["employeeCode", "firstName", "lastName", "departmentCode", "positionCode", "employeeType", "hireDate"];

/** Minimal RFC-4180-ish CSV parser: handles quoted fields, commas, CRLF. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function rowsToObjects(matrix: string[][]): { rows: ImportEmployeeRow[]; error: string | null } {
  if (matrix.length < 2) return { rows: [], error: "File trống hoặc thiếu dòng dữ liệu." };
  const header = matrix[0].map((h) => h.trim());
  const missing = REQUIRED.filter((c) => !header.includes(c));
  if (missing.length) return { rows: [], error: `Thiếu cột bắt buộc: ${missing.join(", ")}` };
  const idx = (col: string) => header.indexOf(col);
  const out: ImportEmployeeRow[] = matrix.slice(1).map((r) => {
    const get = (col: string) => { const j = idx(col); return j >= 0 ? (r[j] ?? "").trim() : ""; };
    const o: ImportEmployeeRow = {
      employeeCode: get("employeeCode"),
      firstName: get("firstName"),
      lastName: get("lastName"),
      departmentCode: get("departmentCode"),
      positionCode: get("positionCode"),
      employeeType: get("employeeType"),
      hireDate: get("hireDate"),
    };
    const mid = get("middleName"); if (mid) o.middleName = mid;
    const email = get("email"); if (email) o.email = email;
    const phone = get("phone"); if (phone) o.phone = phone;
    const gender = get("gender"); if (gender) o.gender = gender;
    const zone = get("salaryZone"); if (zone) o.salaryZone = zone;
    return o;
  });
  return { rows: out, error: null };
}

function downloadTemplate() {
  const sample = `employeeCode,firstName,middleName,lastName,departmentCode,positionCode,employeeType,hireDate,email,phone,gender,salaryZone
NV001,An,Văn,Nguyễn,KT,NV,full_time,2026-01-15,an.nv@gmail.com,0901234567,male,zone1`;
  const url = URL.createObjectURL(new Blob([sample], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = "mau-import-nhan-vien.csv"; a.click();
  URL.revokeObjectURL(url);
}

export function ImportEmployeesDialog({ open, onOpenChange, onDone }: Props) {
  const [rows, setRows] = useState<ImportEmployeeRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null); setParseError(null); setRows([]); setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const { rows: parsed, error } = rowsToObjects(parseCsv(String(reader.result ?? "")));
      if (error) setParseError(error); else setRows(parsed);
    };
    reader.readAsText(file);
  }

  function submit() {
    if (rows.length === 0) return;
    setSubmitting(true);
    employeeService.importEmployees(rows)
      .then((r) => { setResult(r); if (r.created > 0) onDone(); })
      .catch((e) => setParseError(e?.response?.data?.error?.message ?? "Import thất bại."))
      .finally(() => setSubmitting(false));
  }

  const errors = result?.results.filter((r) => r.status === "error") ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Nhập nhân viên từ CSV</DialogTitle>
          <DialogDescription>
            Mỗi dòng là một nhân viên. Cột bắt buộc: {REQUIRED.join(", ")}. Phòng ban &amp; chức vụ tham chiếu theo <b>mã</b>.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2 rounded-lg">
              <Download className="size-3.5" /> Tải mẫu CSV
            </Button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-[13px] font-medium hover:bg-muted">
              <FileUp className="size-3.5" /> {fileName || "Chọn tệp .csv"}
              <input type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
            </label>
          </div>

          {parseError && (
            <p className="flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive">
              <AlertCircle className="size-4 shrink-0" /> {parseError}
            </p>
          )}

          {!result && rows.length > 0 && (
            <div className="rounded-xl border">
              <div className="border-b bg-muted/40 px-3 py-2 text-[12.5px] font-medium text-foreground">
                Xem trước <b className="tabular-nums">{rows.length}</b> dòng
              </div>
              <div className="max-h-[240px] overflow-auto">
                <table className="w-full text-[12px]">
                  <thead className="sticky top-0 bg-card">
                    <tr className="text-left text-muted-foreground">
                      <th className="px-3 py-1.5">Mã</th><th className="px-3 py-1.5">Họ tên</th>
                      <th className="px-3 py-1.5">Phòng</th><th className="px-3 py-1.5">Chức vụ</th>
                      <th className="px-3 py-1.5">Loại</th><th className="px-3 py-1.5">Ngày vào</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 50).map((r, i) => (
                      <tr key={i} className="border-t border-border/40">
                        <td className="px-3 py-1.5 font-mono">{r.employeeCode}</td>
                        <td className="px-3 py-1.5">{[r.lastName, r.middleName, r.firstName].filter(Boolean).join(" ")}</td>
                        <td className="px-3 py-1.5 font-mono">{r.departmentCode}</td>
                        <td className="px-3 py-1.5 font-mono">{r.positionCode}</td>
                        <td className="px-3 py-1.5">{r.employeeType}</td>
                        <td className="px-3 py-1.5 tabular-nums">{r.hireDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 rounded-xl border bg-muted/30 px-4 py-3 text-[13px]">
                <CheckCircle2 className="size-5 text-emerald-500" />
                <span>Đã tạo <b className="tabular-nums">{result.created}</b> / {result.total} nhân viên.</span>
                {result.failed > 0 && <Badge variant="rose">{result.failed} lỗi</Badge>}
              </div>
              {errors.length > 0 && (
                <div className="max-h-[200px] overflow-auto rounded-xl border border-rose-200">
                  {errors.map((e) => (
                    <div key={e.index} className="flex items-start gap-2 border-b border-rose-100 px-3 py-1.5 text-[12px] last:border-0">
                      <span className="font-mono text-muted-foreground">dòng {e.index + 2}</span>
                      <span className="font-mono text-foreground">{e.employeeCode}</span>
                      <span className="flex-1 text-rose-600">{e.error}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={submitting}>
            {result ? "Đóng" : "Hủy"}
          </Button>
          {!result && (
            <Button type="button" size="sm" onClick={submit} disabled={submitting || rows.length === 0}>
              {submitting ? "Đang nhập…" : `Nhập ${rows.length || ""} nhân viên`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
