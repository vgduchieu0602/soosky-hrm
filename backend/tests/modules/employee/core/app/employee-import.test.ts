import EmployeeRepo, { EmployeeListFilter } from "@modules/employee/core/app/ports/EmployeeRepo";
import OrgDirectory from "@modules/employee/core/app/ports/OrgDirectory";
import EmployeeImportValidator, { checksumOf } from "@modules/employee/core/app/services/EmployeeImportValidator";
import Employee from "@modules/employee/core/domain/entities/Employee";
import { CsvFormatError, parseEmployeeCsv } from "@modules/employee/core/domain/services/employee-csv";
import EmployeeCode from "@modules/employee/core/domain/value-objects/EmployeeCode";
import EmployeeStatus from "@modules/employee/core/domain/value-objects/EmployeeStatus";
import EmployeeType from "@modules/employee/core/domain/value-objects/EmployeeType";
import PersonName from "@modules/employee/core/domain/value-objects/PersonName";
import { beforeEach, describe, expect, it } from "vitest";

const HEADER = "code,name,email,departmentCode,positionCode,managerCode,hireDate,employeeType";

function employee(id: string, code: string): Employee {
    return Employee.rehydrate({
        id,
        code:            EmployeeCode.create(code),
        name:            PersonName.create("Nguoi cu"),
        email:           null,
        phone:           null,
        dob:             null,
        gender:          null,
        departmentId:    "dept-1",
        positionId:      "pos-1",
        managerId:       null,
        hireDate:        new Date("2026-01-01"),
        terminationDate: null,
        employeeType:    EmployeeType.FULL_TIME,
        status:          EmployeeStatus.ACTIVE,
        accountId:       null,
        createdAt:       new Date("2026-01-01"),
    });
}

class InMemoryEmployeeRepo implements EmployeeRepo {
    private readonly _store = new Map<string, Employee>();
    add(e: Employee): void { this._store.set(e.id, e); }
    async getById(id: string) { return this._store.get(id); }
    async getByCode(code: string) { return [...this._store.values()].find(e => e.code.value === code); }
    async getByAccountId(accountId: string) { return [...this._store.values()].find(e => e.accountId === accountId); }
    async listDirectReportIds(managerId: string) { return [...this._store.values()].filter(e => e.managerId === managerId).map(e => e.id); }
    async list(_filter: EmployeeListFilter) { return [...this._store.values()]; }
    async save(e: Employee) { this._store.set(e.id, e); }
    async deleteById(id: string) { this._store.delete(id); }
}

const orgDirectory: OrgDirectory = {
    async departmentExists() { return true; },
    async positionExists() { return true; },
    // Chỉ mã "ENG" và "BE-DEV" tồn tại — mọi mã khác coi như chưa khai báo.
    async findDepartmentIdByCode(code: string) { return code === "ENG" ? "dept-1" : undefined; },
    async findPositionIdByCode(code: string) { return code === "BE-DEV" ? "pos-1" : undefined; },
};

describe("parseEmployeeCsv", () => {
    it("bỏ dòng trống và giữ đúng số dòng trong file để người dùng sửa", () => {
        const csv = `${HEADER}\n\nEMP-1,A,,ENG,BE-DEV,,2026-01-02,full_time\n`;
        const parsed = parseEmployeeCsv(csv);

        expect(parsed.rows).toHaveLength(1);
        expect(parsed.rows[0]?.line).toBe(3);   // dòng 1 tiêu đề, dòng 2 trống
    });

    it("hiểu ô bọc ngoặc kép có dấu phẩy và ngoặc kép nhân đôi", () => {
        const csv = `${HEADER}\nEMP-1,"Nguyen, Van ""A""",,ENG,BE-DEV,,2026-01-02,full_time`;
        const parsed = parseEmployeeCsv(csv);

        expect(parsed.rows[0]?.values.name).toBe('Nguyen, Van "A"');
    });

    it("thiếu cột bắt buộc → lỗi cả file", () => {
        expect(() => parseEmployeeCsv("code,name\nEMP-1,A")).toThrow(CsvFormatError);
    });

    it("file rỗng → lỗi cả file", () => {
        expect(() => parseEmployeeCsv("   \n\n")).toThrow(CsvFormatError);
    });
});

describe("EmployeeImportValidator", () => {
    let repo: InMemoryEmployeeRepo;
    let validator: EmployeeImportValidator;

    beforeEach(() => {
        repo = new InMemoryEmployeeRepo();
        validator = new EmployeeImportValidator(repo, orgDirectory);
    });

    it("dòng hợp lệ được chuyển thành dữ liệu tạo nhân viên", async () => {
        const csv = `${HEADER}\nEMP-1,Nguyen Van A,a@soosky.test,ENG,BE-DEV,,2026-01-02,full_time`;
        const report = await validator.validate(csv);

        expect(report.summary).toEqual({ total: 1, ok: 1, error: 0 });
        expect(report.rows[0]?.data).toMatchObject({
            code: "EMP-1", departmentId: "dept-1", positionId: "pos-1", employeeType: "full_time",
        });
        expect(report.checksum).toBe(checksumOf(csv));
    });

    it("mã trùng TRONG FILE: dòng sau bị báo lỗi, dòng trước vẫn hợp lệ", async () => {
        const csv = [
            HEADER,
            "EMP-1,A,,ENG,BE-DEV,,2026-01-02,full_time",
            "EMP-1,B,,ENG,BE-DEV,,2026-01-02,full_time",
        ].join("\n");

        const report = await validator.validate(csv);

        expect(report.summary).toEqual({ total: 2, ok: 1, error: 1 });
        expect(report.rows[1]?.errors[0]).toContain("nhiều lần trong file");
    });

    it("mã trùng dữ liệu ĐÃ CÓ trong hệ thống bị chặn, với thông báo khác", async () => {
        repo.add(employee("e1", "EMP-1"));

        const report = await validator.validate(`${HEADER}\nEMP-1,A,,ENG,BE-DEV,,2026-01-02,full_time`);

        expect(report.rows[0]?.status).toBe("error");
        expect(report.rows[0]?.errors[0]).toContain("đã tồn tại trong hệ thống");
    });

    it("gom nhiều lỗi trên cùng một dòng", async () => {
        const report = await validator.validate(`${HEADER}\nEMP-2,A,,SALES,PM,,02/01/2026,freelancer`);

        const errors = report.rows[0]?.errors.join(" | ") ?? "";
        expect(errors).toContain("phòng ban");
        expect(errors).toContain("vị trí");
        expect(errors).toContain("Ngày vào làm");
        expect(errors).toContain("Loại nhân viên");
    });

    it("quản lý tra theo mã nhân viên; chưa tồn tại thì báo lỗi", async () => {
        const missing = await validator.validate(`${HEADER}\nEMP-2,A,,ENG,BE-DEV,EMP-BOSS,2026-01-02,full_time`);
        expect(missing.rows[0]?.errors[0]).toContain("quản lý");

        repo.add(employee("boss", "EMP-BOSS"));
        const found = await validator.validate(`${HEADER}\nEMP-2,A,,ENG,BE-DEV,EMP-BOSS,2026-01-02,full_time`);
        expect(found.rows[0]?.status).toBe("ok");
        expect(found.rows[0]?.data?.managerId).toBe("boss");
    });

    it("checksum đổi khi nội dung file đổi", async () => {
        const a = await validator.validate(`${HEADER}\nEMP-1,A,,ENG,BE-DEV,,2026-01-02,full_time`);
        const b = await validator.validate(`${HEADER}\nEMP-1,B,,ENG,BE-DEV,,2026-01-02,full_time`);
        expect(a.checksum).not.toBe(b.checksum);
    });
});
