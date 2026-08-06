import PermissionChecker from "@modules/employee/core/app/ports/PermissionChecker";
import EmployeeImportValidator, { ValidationReport } from "@modules/employee/core/app/services/EmployeeImportValidator";

const PERMISSION_KEY = "employee:import";

export interface PreviewEmployeeImportInput {
    csv:         string;
    actorUserId: string;
}

/**
 * Bước 1 của nhập CSV: kiểm tra và trả về kết quả THEO TỪNG DÒNG, KHÔNG ghi gì
 * vào database.
 *
 * Người dùng xem báo cáo này, sửa các dòng lỗi, rồi gọi
 * `POST /employee/imports/commit` với đúng nội dung file kèm `checksum` trả về
 * ở đây.
 *
 * @throws {AccessDeniedError} Actor không có quyền `employee:import`.
 * @throws {CsvFormatError}    File rỗng hoặc thiếu cột bắt buộc.
 */
export default class PreviewEmployeeImportUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _validator: EmployeeImportValidator,
    ) {}

    public async execute(input: PreviewEmployeeImportInput): Promise<ValidationReport> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);
        return this._validator.validate(input.csv);
    }
}
