import EmployeeRepo from "@modules/employee/core/app/ports/EmployeeRepo";
import OrgDirectory from "@modules/employee/core/app/ports/OrgDirectory";
import { CsvRow, parseEmployeeCsv } from "@modules/employee/core/domain/services/employee-csv";
import EmployeeCode from "@modules/employee/core/domain/value-objects/EmployeeCode";
import EmployeeType from "@modules/employee/core/domain/value-objects/EmployeeType";
import PersonName from "@modules/employee/core/domain/value-objects/PersonName";
import { createHash } from "node:crypto";

/** Dữ liệu một dòng đã hợp lệ, sẵn sàng đưa vào `CreateEmployeeUseCase`. */
export interface ValidatedEmployeeRow {
    code:         string;
    name:         string;
    email?: string | undefined;
    phone?: string | undefined;
    dob?: Date | undefined;
    gender?: string | undefined;
    departmentId: string;
    positionId:   string;
    managerId?: string | undefined;
    hireDate:     Date;
    employeeType: string;
}

export interface RowResult {
    line:   number;
    code:   string;
    status: "ok" | "error";
    /** Thông báo lỗi tiếng Việt, một dòng có thể sai nhiều chỗ. */
    errors: string[];
    /** Chỉ có khi `status === "ok"`. */
    data?: ValidatedEmployeeRow | undefined;
}

export interface ValidationReport {
    rows:    RowResult[];
    summary: { total: number; ok: number; error: number };
    /**
     * Vân tay của nội dung file. Bước commit gửi lại kèm giá trị này; lệch nhau
     * nghĩa là file đã bị sửa giữa preview và commit → từ chối, vì người dùng
     * đã duyệt một nội dung khác với nội dung sắp được ghi.
     */
    checksum: string;
}

/**
 * Kiểm tra toàn bộ file CSV nhân viên và báo lỗi THEO TỪNG DÒNG.
 *
 * Dùng chung cho cả preview và commit — cùng một bộ luật, nên preview nói "18
 * dòng hợp lệ" thì commit ghi đúng 18 dòng đó, không có bất ngờ.
 *
 * Dòng lỗi KHÔNG chặn dòng hợp lệ: người làm nhân sự nhập 200 dòng, sai 3 dòng
 * thì vẫn vào được 197 và sửa lại 3 — bắt sửa cả file mới cho nhập là cách làm
 * tra tấn người dùng.
 */
export default class EmployeeImportValidator {
    public constructor(
        private readonly _employeeRepo: EmployeeRepo,
        private readonly _orgDirectory: OrgDirectory,
    ) {}

    /**
     * @throws {CsvFormatError} File rỗng hoặc thiếu cột bắt buộc (lỗi cả file,
     *                          không phải lỗi dòng).
     */
    public async validate(csvContent: string): Promise<ValidationReport> {
        const parsed = parseEmployeeCsv(csvContent);

        // Chống trùng TRONG CHÍNH FILE: hai dòng cùng mã thì dòng sau là lỗi.
        // Kiểm tra riêng với chống trùng trong database vì thông báo phải khác
        // nhau — người dùng cần biết trùng với file hay trùng với dữ liệu đã có.
        const seenCodes = new Set<string>();

        const rows: RowResult[] = [];
        for (const row of parsed.rows) {
            rows.push(await this._validateRow(row, seenCodes));
        }

        const ok = rows.filter(row => row.status === "ok").length;

        return {
            rows,
            summary:  { total: rows.length, ok, error: rows.length - ok },
            checksum: checksumOf(csvContent),
        };
    }

    private async _validateRow(row: CsvRow, seenCodes: Set<string>): Promise<RowResult> {
        const errors: string[] = [];
        const get = (column: string): string => row.values[column] ?? "";

        // --- Mã nhân viên ------------------------------------------------------
        let code = get("code");
        try {
            code = EmployeeCode.create(code).value;

            if (seenCodes.has(code)) {
                errors.push(`Mã "${code}" xuất hiện nhiều lần trong file`);
            } else {
                seenCodes.add(code);
                if (await this._employeeRepo.getByCode(code) != undefined) {
                    errors.push(`Mã "${code}" đã tồn tại trong hệ thống`);
                }
            }
        } catch (error) {
            errors.push(`Mã nhân viên không hợp lệ: ${(error as Error).message}`);
        }

        // --- Họ tên -----------------------------------------------------------
        let name = get("name");
        try {
            name = PersonName.create(name).value;
        } catch (error) {
            errors.push(`Họ tên không hợp lệ: ${(error as Error).message}`);
        }

        // --- Loại nhân viên ---------------------------------------------------
        const rawEmployeeType = get("employeeType");
        try {
            EmployeeType.create(rawEmployeeType);
        } catch (error) {
            errors.push(`Loại nhân viên không hợp lệ: ${(error as Error).message}`);
        }

        // --- Phòng ban / vị trí theo MÃ ---------------------------------------
        const departmentCode = get("departmentCode");
        const departmentId   = departmentCode === "" ? undefined : await this._orgDirectory.findDepartmentIdByCode(departmentCode);
        if (departmentId == undefined) {
            errors.push(`Không tìm thấy phòng ban có mã "${departmentCode}"`);
        }

        const positionCode = get("positionCode");
        const positionId   = positionCode === "" ? undefined : await this._orgDirectory.findPositionIdByCode(positionCode);
        if (positionId == undefined) {
            errors.push(`Không tìm thấy vị trí có mã "${positionCode}"`);
        }

        // --- Quản lý trực tiếp (tuỳ chọn) -------------------------------------
        // Tra theo mã nhân viên. Quản lý phải ĐÃ tồn tại trong hệ thống: giải
        // quyết tham chiếu lẫn nhau trong cùng một file là bài toán thứ tự phức
        // tạp, nhập hai lượt (nhân viên rồi cập nhật quản lý) rõ ràng hơn.
        const managerCode = get("managerCode");
        let managerId: string | undefined;
        if (managerCode !== "") {
            managerId = (await this._employeeRepo.getByCode(managerCode))?.id;
            if (managerId == undefined) {
                errors.push(`Không tìm thấy quản lý có mã nhân viên "${managerCode}"`);
            }
        }

        // --- Ngày -------------------------------------------------------------
        const hireDate = parseDate(get("hireDate"));
        if (hireDate == undefined) {
            errors.push(`Ngày vào làm không hợp lệ (định dạng YYYY-MM-DD): "${get("hireDate")}"`);
        }

        const rawDob = get("dob");
        const dob    = rawDob === "" ? undefined : parseDate(rawDob);
        if (rawDob !== "" && dob == undefined) {
            errors.push(`Ngày sinh không hợp lệ (định dạng YYYY-MM-DD): "${rawDob}"`);
        }

        if (errors.length > 0 || departmentId == undefined || positionId == undefined || hireDate == undefined) {
            return { line: row.line, code: get("code"), status: "error", errors };
        }

        const email  = get("email");
        const phone  = get("phone");
        const gender = get("gender");

        return {
            line:   row.line,
            code,
            status: "ok",
            errors: [],
            data:   {
                code,
                name,
                departmentId,
                positionId,
                hireDate,
                employeeType: rawEmployeeType,
                ...(email  === "" ? {} : { email }),
                ...(phone  === "" ? {} : { phone }),
                ...(gender === "" ? {} : { gender }),
                ...(dob == undefined ? {} : { dob }),
                ...(managerId == undefined ? {} : { managerId }),
            },
        };
    }
}

/**
 * Vân tay nội dung file — dùng để bước commit chắc chắn đang ghi đúng file đã
 * được xem trước.
 */
export function checksumOf(csvContent: string): string {
    return `sha256:${createHash("sha256").update(csvContent, "utf8").digest("hex")}`;
}

/**
 * Chỉ nhận `YYYY-MM-DD` (hoặc chuỗi ISO đầy đủ). Cố ý KHÔNG dùng `new Date()`
 * cho định dạng tự do: `new Date("13/01/2026")` cho ra kết quả khác nhau tuỳ
 * môi trường, và ngày sinh sai âm thầm thì tệ hơn báo lỗi.
 */
function parseDate(raw: string): Date | undefined {
    if (!/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(raw)) return undefined;

    const date = new Date(raw.length === 10 ? `${raw}T00:00:00.000Z` : raw);
    return Number.isNaN(date.getTime()) ? undefined : date;
}
