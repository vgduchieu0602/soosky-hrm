import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Download, FileUp, Pencil, RefreshCw } from "lucide-react";
import { FormModal } from "@shared/components/FormModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/shared/utils/cn";
import { employeeService } from "@features/employee/services/employee.service";
import { ImportRowEditor } from "@features/employee/components/ImportRowEditor";
import { CsvParseError, downloadBlob, parseEmployeeCsv } from "@features/employee/utils/csv";
import type {
  CsvSchema,
  ImportEmployeeRow,
  ImportMode,
  ImportPreview,
  ImportResult,
  ImportRowPreview,
} from "@features/employee/types/employee.types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

type Step = "upload" | "preview" | "result";

/** Cột hiển thị trong bảng xem trước — đủ nhận diện dòng mà không cuộn ngang 22 cột. */
const GRID_COLUMNS = [
  "employee_code",
  "last_name",
  "first_name",
  "department_code",
  "position_code",
  "manager_employee_code",
  "join_date",
] as const;

export function ImportEmployeesDialog({ open, onOpenChange, onDone }: Props) {
  const [schema, setSchema] = useState<CsvSchema | null>(null);
  const [step, setStep] = useState<Step>("upload");
  const [mode, setMode] = useState<ImportMode>("CREATE_ONLY");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ImportEmployeeRow[]>([]);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [editing, setEditing] = useState<ImportRowPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // Đặc tả cột do backend cấp — bảng hướng dẫn không chép tay lần thứ hai.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    employeeService
      .importSchema()
      .then((s) => { if (!cancelled) setSchema(s); })
      .catch(() => { if (!cancelled) setSchema(null); });
    return () => { cancelled = true; };
  }, [open]);

  function reset() {
    setStep("upload");
    setFileName("");
    setHeaders([]);
    setRows([]);
    setPreview(null);
    setResult(null);
    setEditing(null);
    setError(null);
  }

  function close() {
    reset();
    onOpenChange(false);
  }

  function downloadTemplate() {
    employeeService
      .importTemplate()
      .then((blob) => downloadBlob(blob, "employees-import-template.csv"))
      .catch(() => setError("Không tải được tệp mẫu."));
  }

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) {
      setError("Chỉ nhận tệp .csv — hãy lưu bảng tính dưới dạng CSV UTF-8.");
      return;
    }
    setError(null);
    setResult(null);
    setFileName(file.name);
    setBusy(true);

    parseEmployeeCsv(file)
      .then((parsed) => {
        setHeaders(parsed.headers);
        setRows(parsed.rows);
        return runPreview(parsed.rows, parsed.headers, mode, file.name);
      })
      .catch((e) => {
        setRows([]);
        setError(e instanceof CsvParseError ? e.message : errorMessage(e, "Không đọc được tệp."));
      })
      .finally(() => setBusy(false));
  }

  function runPreview(
    nextRows: ImportEmployeeRow[],
    nextHeaders: string[],
    nextMode: ImportMode,
    name = fileName,
  ) {
    setBusy(true);
    return employeeService
      .previewImport(nextRows, nextHeaders, nextMode, name)
      .then((p) => { setPreview(p); setStep("preview"); setError(null); })
      .catch((e) => setError(errorMessage(e, "Không kiểm tra được dữ liệu.")))
      .finally(() => setBusy(false));
  }

  /** Sửa một ô ngay trong bảng — nhanh hơn mở cả biểu mẫu cho lỗi nhỏ. */
  function editCell(index: number, column: string, value: string) {
    setRows((current) =>
      current.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row };
        if (value.trim()) next[column] = value;
        else delete next[column];
        return next;
      }),
    );
  }

  /** Áp dụng bản sửa từ biểu mẫu rồi kiểm tra lại ngay để lỗi biến mất. */
  function applyEditedRow(index: number, updated: ImportEmployeeRow) {
    const nextRows = rows.map((row, i) => (i === index ? updated : row));
    setRows(nextRows);
    setEditing(null);
    void runPreview(nextRows, headers, mode);
  }

  function changeMode(next: ImportMode) {
    setMode(next);
    if (rows.length > 0) void runPreview(rows, headers, next);
  }

  function commit() {
    if (!preview) return;
    setBusy(true);
    employeeService
      .commitImport({
        importId: preview.importId,
        checksum: preview.checksum,
        mode: preview.mode,
        rows,
        headers,
        fileName,
      })
      .then((r) => { setResult(r); setStep("result"); onDone(); })
      .catch((e) => setError(errorMessage(e, "Nhập dữ liệu thất bại.")))
      .finally(() => setBusy(false));
  }

  const canCommit = Boolean(preview) && preview!.summary.invalidRows === 0 && preview!.summary.totalRows > 0;

  return (
    <>
      <FormModal
        open={open}
        onClose={close}
        title="Nhập nhân viên từ CSV"
        subtitle={step === "upload" ? "Tải mẫu → điền → tải lên → kiểm tra → lưu" : fileName}
        maxWidth={step === "preview" ? 980 : 660}
        footer={
          <>
            <Button type="button" variant="outline" size="sm" onClick={close} disabled={busy} className="rounded-lg">
              {step === "result" ? "Đóng" : "Huỷ"}
            </Button>
            {step === "preview" && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void runPreview(rows, headers, mode)}
                  disabled={busy}
                  className="gap-1.5 rounded-lg"
                >
                  <RefreshCw className="size-3.5" /> Kiểm tra lại
                </Button>
                <Button type="button" size="sm" onClick={commit} disabled={busy || !canCommit} className="rounded-lg">
                  {busy ? "Đang lưu…" : `Nhập ${preview?.summary.totalRows ?? 0} nhân viên`}
                </Button>
              </>
            )}
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {error && (
            <p className="flex items-start gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive">
              <AlertCircle className="mt-px size-4 shrink-0" /> {error}
            </p>
          )}

          {step === "upload" && (
            <UploadStep
              schema={schema}
              mode={mode}
              busy={busy}
              dragging={dragging}
              fileName={fileName}
              showGuide={showGuide}
              onToggleGuide={() => setShowGuide((v) => !v)}
              onModeChange={changeMode}
              onDownloadTemplate={downloadTemplate}
              onFile={handleFile}
              onDraggingChange={setDragging}
            />
          )}

          {step === "preview" && preview && (
            <PreviewStep
              preview={preview}
              rows={rows}
              schema={schema}
              onEditCell={editCell}
              onEditRow={setEditing}
            />
          )}

          {step === "result" && result && <ResultStep result={result} onViewEmployees={close} />}
        </div>
      </FormModal>

      {editing && (
        <ImportRowEditor
          row={editing}
          onCancel={() => setEditing(null)}
          onApply={(updated) => applyEditedRow(editing.index, updated)}
        />
      )}
    </>
  );
}

// ------------------------------------------------------------------ bước 1

function UploadStep({
  schema, mode, busy, dragging, fileName, showGuide,
  onToggleGuide, onModeChange, onDownloadTemplate, onFile, onDraggingChange,
}: {
  schema: CsvSchema | null;
  mode: ImportMode;
  busy: boolean;
  dragging: boolean;
  fileName: string;
  showGuide: boolean;
  onToggleGuide: () => void;
  onModeChange: (mode: ImportMode) => void;
  onDownloadTemplate: () => void;
  onFile: (file: File | undefined) => void;
  onDraggingChange: (dragging: boolean) => void;
}) {
  return (
    <>
      <section>
        <h3 className="text-[13px] font-semibold text-foreground">Bước 1 — Tải tệp mẫu</h3>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          Tệp mẫu chứa đầy đủ cột hệ thống hỗ trợ. Cột không có dữ liệu cứ để trống.
          Ngày ghi theo dạng <span className="font-mono">{schema?.dateFormat ?? "YYYY-MM-DD"}</span>.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={onDownloadTemplate} className="gap-2 rounded-lg">
            <Download className="size-3.5" /> Tải tệp mẫu CSV
          </Button>
          <Button variant="ghost" size="sm" onClick={onToggleGuide} className="rounded-lg text-[12.5px]">
            {showGuide ? "Ẩn" : "Xem"} mô tả từng cột
          </Button>
        </div>
        {showGuide && schema && <ColumnGuide schema={schema} />}
      </section>

      <section>
        <h3 className="text-[13px] font-semibold text-foreground">Bước 2 — Chế độ nhập</h3>
        <div className="mt-2 flex gap-2">
          <ModeButton
            active={mode === "CREATE_ONLY"}
            onClick={() => onModeChange("CREATE_ONLY")}
            label="Chỉ thêm mới"
            hint="Mã nhân viên đã tồn tại sẽ báo lỗi"
          />
          <ModeButton
            active={mode === "UPSERT"}
            onClick={() => onModeChange("UPSERT")}
            label="Thêm & cập nhật"
            hint="Mã đã tồn tại sẽ được cập nhật; ô trống không xoá dữ liệu cũ"
          />
        </div>
      </section>

      <section>
        <h3 className="text-[13px] font-semibold text-foreground">Bước 3 — Tải tệp lên</h3>
        <label
          onDragOver={(e) => { e.preventDefault(); onDraggingChange(true); }}
          onDragLeave={() => onDraggingChange(false)}
          onDrop={(e) => {
            e.preventDefault();
            onDraggingChange(false);
            onFile(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "mt-2 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
            dragging ? "border-primary-500 bg-primary-50" : "border-input hover:bg-muted/40",
          )}
        >
          <FileUp className="size-6 text-muted-foreground" />
          <span className="text-[13px] font-medium text-foreground">
            {busy ? "Đang xử lý…" : fileName || "Kéo tệp .csv vào đây hoặc bấm để chọn"}
          </span>
          <span className="text-[11.5px] text-muted-foreground">Chỉ nhận .csv, tối đa 8MB</span>
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
      </section>
    </>
  );
}

function ColumnGuide({ schema }: { schema: CsvSchema }) {
  const columns = schema.columns.filter((c) => c.importable);
  return (
    <div className="mt-3 max-h-[260px] overflow-auto rounded-xl border">
      <table className="w-full text-[12px]">
        <thead className="sticky top-0 bg-card">
          <tr className="text-left text-muted-foreground">
            <th className="border-b px-3 py-1.5 font-medium">Cột</th>
            <th className="border-b px-3 py-1.5 font-medium">Bắt buộc</th>
            <th className="border-b px-3 py-1.5 font-medium">Mô tả</th>
            <th className="border-b px-3 py-1.5 font-medium">Ví dụ</th>
          </tr>
        </thead>
        <tbody>
          {columns.map((column) => (
            <tr key={column.key} className="border-t border-border/40 align-top">
              <td className="px-3 py-1.5 font-mono">{column.key}</td>
              <td className="px-3 py-1.5">{column.required ? "Có" : "Không"}</td>
              <td className="px-3 py-1.5">
                {column.label}
                {column.description ? ` — ${column.description}` : ""}
                {column.enumValues ? ` (${column.enumValues.join(" | ")})` : ""}
              </td>
              <td className="px-3 py-1.5 font-mono text-muted-foreground">{column.example ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ------------------------------------------------------------------ bước 2

function PreviewStep({
  preview, rows, schema, onEditCell, onEditRow,
}: {
  preview: ImportPreview;
  rows: ImportEmployeeRow[];
  schema: CsvSchema | null;
  onEditCell: (index: number, column: string, value: string) => void;
  onEditRow: (row: ImportRowPreview) => void;
}) {
  const labelOf = (key: string) => schema?.columns.find((c) => c.key === key)?.label ?? key;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
        <span className="text-muted-foreground">Tổng {preview.summary.totalRows}</span>
        <Badge variant="emerald">{preview.summary.validRows} hợp lệ</Badge>
        {preview.summary.invalidRows > 0 && <Badge variant="rose">{preview.summary.invalidRows} lỗi</Badge>}
        <Badge variant="blue">{preview.summary.createRows} thêm mới</Badge>
        {preview.summary.updateRows > 0 && <Badge variant="amber">{preview.summary.updateRows} cập nhật</Badge>}
      </div>

      {preview.headers.unknown.length > 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-700">
          Cột không được hỗ trợ, sẽ bỏ qua: {preview.headers.unknown.join(", ")}
        </p>
      )}
      {preview.summary.invalidRows > 0 && (
        <p className="text-[12.5px] text-muted-foreground">
          Sửa ô sai ngay trong bảng hoặc bấm <b>Sửa</b> để mở biểu mẫu, rồi bấm “Kiểm tra lại”.
          Chỉ khi hết lỗi mới lưu được.
        </p>
      )}

      <div className="overflow-auto rounded-xl border" style={{ maxHeight: 400 }}>
        <table className="w-full border-collapse text-[12px]">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="text-left text-muted-foreground">
              <th className="border-b px-2 py-1.5 font-medium">Dòng</th>
              {GRID_COLUMNS.map((c) => (
                <th key={c} className="border-b px-2 py-1.5 font-medium">{labelOf(c)}</th>
              ))}
              <th className="border-b px-2 py-1.5 font-medium">Kết quả tra</th>
              <th className="border-b px-2 py-1.5 font-medium">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row) => {
              const errorsByField = new Map(row.errors.map((e) => [e.field, e.message]));
              const rowErrors = row.errors.filter((e) => !GRID_COLUMNS.includes(e.field as never));
              return (
                <tr key={row.index} className={cn("border-t border-border/40 align-top", !row.valid && "bg-rose-50/40")}>
                  <td className="px-2 py-1 tabular-nums text-muted-foreground">{row.rowNumber}</td>
                  {GRID_COLUMNS.map((column) => {
                    const message = errorsByField.get(column);
                    return (
                      <td key={column} className="px-1 py-1">
                        <input
                          value={rows[row.index]?.[column] ?? ""}
                          onChange={(e) => onEditCell(row.index, column, e.target.value)}
                          title={message}
                          className={cn(
                            "h-7 w-full min-w-[92px] rounded border bg-card px-1.5 text-[12px] focus-visible:outline-none focus-visible:border-primary-500",
                            message ? "border-rose-400 bg-rose-50" : "border-transparent hover:border-input",
                          )}
                        />
                        {message && <p className="mt-0.5 text-[11px] leading-tight text-rose-600">{message}</p>}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1 text-[11.5px] text-muted-foreground">
                    {row.resolved.departmentName ?? "—"}
                    {row.resolved.positionName ? ` · ${row.resolved.positionName}` : ""}
                    {row.resolved.managerName ? ` · QL: ${row.resolved.managerName}` : ""}
                    {rowErrors.map((e) => (
                      <p key={`${e.field}-${e.message}`} className="text-rose-600">{e.message}</p>
                    ))}
                    {row.warnings.map((w) => (
                      <p key={`${w.field}-${w.message}`} className="text-amber-600">{w.message}</p>
                    ))}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1">
                    <div className="flex items-center gap-1.5">
                      {row.valid ? (
                        <Badge variant={row.action === "update" ? "amber" : "emerald"}>
                          {row.action === "update" ? "Cập nhật" : "Thêm mới"}
                        </Badge>
                      ) : (
                        <Badge variant="rose">Lỗi</Badge>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditRow(row)}
                        className="h-6 gap-1 rounded px-1.5 text-[11.5px]"
                      >
                        <Pencil className="size-3" /> Sửa
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ bước 3

function ResultStep({ result, onViewEmployees }: { result: ImportResult; onViewEmployees: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/30 px-4 py-3 text-[13px]">
        <CheckCircle2 className="size-5 text-emerald-500" />
        <span>Nhập thành công.</span>
      </div>
      <dl className="grid grid-cols-4 gap-2 text-[13px]">
        <Stat label="Đã tạo" value={result.created} />
        <Stat label="Đã cập nhật" value={result.updated} />
        <Stat label="Bỏ qua" value={result.skipped} />
        <Stat label="Thất bại" value={result.failed} />
      </dl>
      <div>
        <Button type="button" size="sm" onClick={onViewEmployees} className="rounded-lg">
          Xem danh sách nhân viên
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card px-3 py-2">
      <dt className="text-[11.5px] text-muted-foreground">{label}</dt>
      <dd className="text-[18px] font-bold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

function ModeButton({
  active, onClick, label, hint,
}: { active: boolean; onClick: () => void; label: string; hint: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 cursor-pointer rounded-lg border px-3 py-2 text-left transition-colors",
        active ? "border-primary-500 bg-primary-50" : "border-input hover:bg-muted",
      )}
    >
      <div className="text-[13px] font-medium text-foreground">{label}</div>
      <div className="text-[11.5px] text-muted-foreground">{hint}</div>
    </button>
  );
}

function errorMessage(e: unknown, fallback: string): string {
  const err = e as { response?: { data?: { error?: { message?: string } } } };
  return err?.response?.data?.error?.message ?? fallback;
}
