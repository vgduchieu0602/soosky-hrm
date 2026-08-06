/**
 * Đọc file CSV danh sách nhân viên — thuần cú pháp, KHÔNG chạm nghiệp vụ và
 * KHÔNG chạm hạ tầng. Việc kiểm tra phòng ban có tồn tại, mã có trùng hay
 * không là của use-case.
 *
 * Vì sao tự viết parser: định dạng đầu vào rất hẹp (một bảng phẳng, không
 * nested), nên một hàm ~50 dòng đủ dùng và không cần thêm dependency. Vẫn xử
 * lý đúng hai thứ hay gặp ở file do Excel xuất ra: ô bọc trong dấu ngoặc kép
 * có chứa dấu phẩy, và dấu ngoặc kép nhân đôi ở trong ô.
 */

/** Cột bắt buộc phải có trên dòng tiêu đề. */
export const REQUIRED_CSV_COLUMNS = ["code", "name", "departmentCode", "positionCode", "hireDate", "employeeType"] as const;

/** Toàn bộ cột được nhận. Cột lạ bị bỏ qua, không phải lỗi. */
export const KNOWN_CSV_COLUMNS = [
    ...REQUIRED_CSV_COLUMNS,
    "email", "phone", "dob", "gender", "managerCode",
] as const;

export interface CsvRow {
    /** Số dòng trong file, tính cả dòng tiêu đề — để người dùng mở file và sửa đúng chỗ. */
    line:   number;
    values: Record<string, string>;
}

export interface ParsedCsv {
    columns: string[];
    rows:    CsvRow[];
}

export class CsvFormatError extends Error {}

/**
 * Tách nội dung CSV thành tiêu đề + các dòng dữ liệu.
 *
 * @throws {CsvFormatError} File rỗng, hoặc thiếu cột bắt buộc.
 */
export function parseEmployeeCsv(content: string): ParsedCsv {
    // BOM của Excel dính vào tên cột đầu tiên nếu không cắt.
    const text  = content.replace(/^﻿/, "");
    const lines = text.split(/\r?\n/);

    const headerIndex = lines.findIndex(line => line.trim() !== "");
    if (headerIndex === -1) throw new CsvFormatError("File CSV rỗng");

    const columns = splitCsvLine(lines[headerIndex] as string).map(cell => cell.trim());

    const missing = REQUIRED_CSV_COLUMNS.filter(required => !columns.includes(required));
    if (missing.length > 0) {
        throw new CsvFormatError(`Thiếu cột bắt buộc: ${missing.join(", ")}`);
    }

    const rows: CsvRow[] = [];
    for (let index = headerIndex + 1; index < lines.length; index += 1) {
        const raw = lines[index] as string;
        if (raw.trim() === "") continue;   // bỏ dòng trống, kể cả dòng cuối file

        const cells  = splitCsvLine(raw);
        const values: Record<string, string> = {};
        columns.forEach((column, columnIndex) => {
            values[column] = (cells[columnIndex] ?? "").trim();
        });

        rows.push({ line: index + 1, values });
    }

    return { columns, rows };
}

/**
 * Tách một dòng CSV thành các ô, tôn trọng dấu ngoặc kép bọc ô.
 * `""` bên trong ô có ngoặc kép là một dấu ngoặc kép thật (quy ước RFC 4180).
 */
function splitCsvLine(line: string): string[] {
    const cells: string[] = [];
    let current  = "";
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
        const char = line[index];

        if (inQuotes) {
            if (char === "\"") {
                if (line[index + 1] === "\"") {
                    current += "\"";
                    index += 1;         // đã tiêu thụ cặp "" -> nhảy qua ký tự thứ hai
                } else {
                    inQuotes = false;
                }
            } else {
                current += char;
            }
            continue;
        }

        if (char === "\"") {
            inQuotes = true;
        } else if (char === ",") {
            cells.push(current);
            current = "";
        } else {
            current += char as string;
        }
    }

    cells.push(current);
    return cells;
}
