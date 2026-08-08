import * as XLSX from "xlsx";

/**
 * Đọc CSV bằng thư viện có sẵn (SheetJS) thay vì tự cắt chuỗi bằng `split(",")`.
 *
 * `raw: true` tắt đoán kiểu dữ liệu, nên `2026-01-15` giữ nguyên là chuỗi chứ
 * không bị biến thành ngày rồi in lại theo định dạng máy người dùng. Thư viện lo
 * phần ô có dấu phẩy, ô bọc nháy kép và ô xuống dòng bên trong nháy kép.
 */

export interface ParsedCsv {
  /** Header đã cắt khoảng trắng, giữ nguyên thứ tự và cả cột lặp. */
  headers: string[];
  /** Mỗi dòng là bản ghi theo tên cột; ô trống bị loại bỏ. */
  rows: Record<string, string>[];
  /** Số dòng dữ liệu bị bỏ vì rỗng hoàn toàn. */
  skippedEmptyRows: number;
}

export class CsvParseError extends Error {}

/** BOM Excel ghi ở đầu tệp — không bóc thì dính vào tên cột đầu tiên. */
const LEADING_BOM = new RegExp("^\uFEFF");

/** Trần dung lượng tệp — khớp trần body của API nhập. */
export const MAX_CSV_BYTES = 8 * 1024 * 1024;

export async function parseEmployeeCsv(file: File): Promise<ParsedCsv> {
  if (file.size > MAX_CSV_BYTES) {
    throw new CsvParseError(
      `Tệp lớn hơn ${Math.round(MAX_CSV_BYTES / 1024 / 1024)}MB — hãy tách nhỏ rồi nhập từng phần.`,
    );
  }

  const text = (await file.text()).replace(LEADING_BOM, "");
  if (text.trim() === "") throw new CsvParseError("Tệp rỗng.");

  const workbook = XLSX.read(text, { type: "string", raw: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new CsvParseError("Không đọc được nội dung tệp.");

  const matrix = XLSX.utils
    .sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "" })
    .map((line) => line.map((cell) => String(cell ?? "").trim()));

  if (matrix.length === 0) throw new CsvParseError("Tệp không có dòng nào.");

  const headers = (matrix[0] ?? []).map((h) => h.trim());
  if (headers.every((h) => h === "")) throw new CsvParseError("Dòng đầu tiên phải là tên cột.");

  const body = matrix.slice(1);
  let skippedEmptyRows = 0;
  const rows: Record<string, string>[] = [];

  for (const line of body) {
    // Dòng trắng hoàn toàn là rác của trình soạn bảng tính, không phải dữ liệu hỏng.
    if (line.every((cell) => cell === "")) {
      skippedEmptyRows += 1;
      continue;
    }
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (!header) return;
      const value = (line[index] ?? "").trim();
      if (value !== "") row[header] = value;
    });
    rows.push(row);
  }

  if (rows.length === 0) throw new CsvParseError("Tệp chỉ có dòng tiêu đề, chưa có dữ liệu.");

  return { headers, rows, skippedEmptyRows };
}

/** Tải một Blob về máy với tên tệp cho trước. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
