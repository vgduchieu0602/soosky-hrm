import ImportChecksumMismatchError from "@modules/employee/core/app/errors/ImportChecksumMismatchError";
import AuditTrail from "@modules/employee/core/app/ports/AuditTrail";
import PermissionChecker from "@modules/employee/core/app/ports/PermissionChecker";
import EmployeeImportValidator, { checksumOf, RowResult } from "@modules/employee/core/app/services/EmployeeImportValidator";
import CreateEmployeeUseCase from "@modules/employee/core/app/use-cases/employee/CreateEmployeeUseCase";

const PERMISSION_KEY = "employee:import";

export interface CommitEmployeeImportInput {
    csv:         string;
    /** Giá trị `checksum` nhận từ bước preview — chốt rằng file không đổi. */
    checksum:    string;
    actorUserId: string;
}

export interface CommitEmployeeImportOutput {
    created: number;
    skipped: number;
    rows:    RowResult[];
}

/**
 * Bước 2 của nhập CSV: ghi thật những dòng hợp lệ.
 *
 * Chạy LẠI toàn bộ validation trước khi ghi, không tin kết quả preview: giữa
 * hai request có thể có người khác vừa tạo trùng mã, hoặc xoá phòng ban. Đây là
 * điểm chống trùng thật sự — preview chỉ để người dùng xem trước.
 *
 * Không bọc trong một transaction: mỗi nhân viên là một aggregate độc lập, và
 * ý nghĩa nghiệp vụ là "nhập được bao nhiêu thì nhập" (dòng lỗi báo lại để sửa
 * riêng), không phải "tất-cả-hoặc-không". Đổi lại, nhập một file hai lần sẽ
 * chỉ thêm những dòng chưa vào được — chống trùng theo mã lo phần còn lại.
 *
 * @throws {AccessDeniedError}             Actor không có quyền `employee:import`.
 * @throws {ImportChecksumMismatchError}   File đã đổi so với lúc preview.
 * @throws {CsvFormatError}                File rỗng hoặc thiếu cột bắt buộc.
 */
export default class CommitEmployeeImportUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _validator: EmployeeImportValidator,
        private readonly _createEmployee: CreateEmployeeUseCase,
        private readonly _auditTrail: AuditTrail,
    ) {}

    public async execute(input: CommitEmployeeImportInput): Promise<CommitEmployeeImportOutput> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        if (checksumOf(input.csv) !== input.checksum) throw new ImportChecksumMismatchError();

        const report = await this._validator.validate(input.csv);

        const rows: RowResult[] = [];
        let created = 0;

        for (const row of report.rows) {
            if (row.status === "error" || row.data == undefined) {
                rows.push(row);
                continue;
            }

            try {
                await this._createEmployee.execute({ ...row.data, actorUserId: input.actorUserId });
                created += 1;
                rows.push(row);
            } catch (error) {
                // Một dòng ghi lỗi không được làm hỏng cả lượt nhập — báo lại
                // đúng dòng đó để người dùng sửa.
                rows.push({
                    line:   row.line,
                    code:   row.code,
                    status: "error",
                    errors: [`Không tạo được nhân viên: ${(error as Error).message}`],
                });
            }
        }

        const skipped = rows.length - created;

        await this._auditTrail.record({
            actorUserId: input.actorUserId,
            resource:    "employee",
            action:      "import",
            resourceId:  null,
            changes:     { checksum: input.checksum, total: rows.length, created, skipped },
        });

        return { created, skipped, rows };
    }
}
