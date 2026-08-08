import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Luồng nhập CSV trên giao diện: tải mẫu → tải tệp → xem trước → sửa dòng → lưu.
 *
 * Backend được giả lập ở tầng service, nên test khẳng định hành vi màn hình
 * (hiển thị lỗi theo dòng, chặn lưu khi còn lỗi, tự điền biểu mẫu sửa) chứ không
 * kiểm tra lại luật nghiệp vụ — phần đó đã có test riêng ở backend.
 */

const service = vi.hoisted(() => ({
  importSchema: vi.fn(),
  importTemplate: vi.fn(),
  previewImport: vi.fn(),
  commitImport: vi.fn(),
  list: vi.fn(),
}));

const organization = vi.hoisted(() => ({
  departmentsFlat: vi.fn(),
  positions: vi.fn(),
}));

const attendance = vi.hoisted(() => ({ shifts: vi.fn() }));
const downloadBlob = vi.hoisted(() => vi.fn());

vi.mock("@features/employee/services/employee.service", () => ({ employeeService: service }));
vi.mock("@features/organization/services/organization.service", () => ({ organizationService: organization }));
vi.mock("@features/attendance/services/attendance.service", () => ({ attendanceService: attendance }));
vi.mock("@features/employee/utils/csv", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@features/employee/utils/csv")>();
  return { ...actual, downloadBlob };
});

import { ImportEmployeesDialog } from "@features/employee/components/ImportEmployeesDialog";

const SCHEMA = {
  dateFormat: "YYYY-MM-DD",
  columns: [
    {
      key: "employee_code", group: "identity", label: "Mã nhân viên", type: "string", enumValues: null,
      required: true, importable: true, exportable: true, sensitive: false, example: "EMP001",
      description: "Duy nhất toàn hệ thống.",
    },
    {
      key: "department_code", group: "employment", label: "Mã phòng ban", type: "string", enumValues: null,
      required: true, importable: true, exportable: true, sensitive: false, example: "ENG", description: null,
    },
    {
      key: "status", group: "employment", label: "Trạng thái", type: "enum", enumValues: ["active"],
      required: false, importable: false, exportable: true, sensitive: false, example: null, description: null,
    },
  ],
};

function previewRow(overrides: Record<string, unknown> = {}) {
  return {
    index: 0,
    rowNumber: 2,
    action: "create",
    valid: true,
    raw: {},
    normalized: {
      employee_code: "EMP001", last_name: "Nguyễn", first_name: "An",
      department_code: "ENG", position_code: "BE01", employment_type: "full_time", join_date: "2026-01-15",
    },
    resolved: {
      employeeId: null,
      departmentId: DEPT_ID, departmentCode: "ENG", departmentName: "Engineering",
      positionId: POS_ID, positionCode: "BE01", positionName: "Backend Engineer",
      managerId: null, managerCode: null, managerName: null, managerFromFile: false,
    },
    errors: [],
    warnings: [],
    ...overrides,
  };
}

function previewResponse(rows: ReturnType<typeof previewRow>[], overrides: Record<string, unknown> = {}) {
  const invalid = rows.filter((r) => !r.valid).length;
  return {
    importId: "import-1",
    checksum: "c".repeat(64),
    mode: "CREATE_ONLY",
    headers: { missing: [], unknown: [], duplicated: [] },
    summary: {
      totalRows: rows.length,
      validRows: rows.length - invalid,
      invalidRows: invalid,
      createRows: rows.filter((r) => r.action === "create").length,
      updateRows: rows.filter((r) => r.action === "update").length,
      warningRows: rows.filter((r) => r.warnings.length > 0).length,
    },
    rows,
    ...overrides,
  };
}

/** Biểu mẫu nhân viên đòi id dài 24 ký tự (ObjectId), nên id giả cũng phải đủ dài. */
const DEPT_ID = "dept-1".padEnd(24, "0");
const POS_ID = "pos-1".padEnd(24, "0");

const CSV = [
  "employee_code,last_name,first_name,department_code,position_code,employment_type,join_date",
  "EMP001,Nguyễn,An,ENG,BE01,full_time,2026-01-15",
].join("\n");

function csvFile(content = CSV, name = "nhan-vien.csv") {
  return new File([content], name, { type: "text/csv" });
}

async function uploadCsv(file = csvFile()) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(service.previewImport).toHaveBeenCalled());
}

function renderDialog(onDone = vi.fn()) {
  render(<ImportEmployeesDialog open onOpenChange={vi.fn()} onDone={onDone} />);
  return { onDone };
}

beforeEach(() => {
  vi.clearAllMocks();
  service.importSchema.mockResolvedValue(SCHEMA);
  service.importTemplate.mockResolvedValue(new Blob(["employee_code\n"], { type: "text/csv" }));
  service.previewImport.mockResolvedValue(previewResponse([previewRow()]));
  service.commitImport.mockResolvedValue({
    importId: "import-1", mode: "CREATE_ONLY", total: 1, created: 1, updated: 0, skipped: 0, failed: 0, employeeIds: ["emp-1"],
  });
  service.list.mockResolvedValue({ items: [] });
  organization.departmentsFlat.mockResolvedValue([{ id: DEPT_ID, name: "Engineering", code: "ENG" }]);
  organization.positions.mockResolvedValue([
    { _id: POS_ID, title: "Backend Engineer", code: "BE01", departmentId: DEPT_ID },
  ]);
  attendance.shifts.mockResolvedValue([]);
});

describe("bước tải mẫu và tải tệp", () => {
  it("tải tệp mẫu CSV về máy", async () => {
    renderDialog();

    await userEvent.click(screen.getByRole("button", { name: /tải tệp mẫu csv/i }));

    await waitFor(() => expect(service.importTemplate).toHaveBeenCalled());
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), "employees-import-template.csv"));
  });

  it("bảng mô tả cột dựng từ đặc tả backend, chỉ hiện cột nhập được", async () => {
    renderDialog();
    await waitFor(() => expect(service.importSchema).toHaveBeenCalled());

    await userEvent.click(screen.getByRole("button", { name: /xem mô tả từng cột/i }));

    expect(screen.getByText("employee_code")).toBeInTheDocument();
    expect(screen.getByText(/Duy nhất toàn hệ thống/)).toBeInTheDocument();
    // Cột chỉ đọc không được mời HR điền.
    expect(screen.queryByText("status")).not.toBeInTheDocument();
  });

  it("từ chối tệp không phải .csv", async () => {
    renderDialog();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "nhan-vien.xlsx")] } });

    expect(await screen.findByText(/chỉ nhận tệp \.csv/i)).toBeInTheDocument();
    expect(service.previewImport).not.toHaveBeenCalled();
  });

  it("tải tệp lên thì gọi xem trước với đúng header, dòng và chế độ", async () => {
    renderDialog();

    await uploadCsv();

    expect(service.previewImport).toHaveBeenCalledWith(
      [expect.objectContaining({ employee_code: "EMP001" })],
      expect.arrayContaining(["employee_code", "join_date"]),
      "CREATE_ONLY",
      "nhan-vien.csv",
    );
  });

  it("đổi chế độ sang UPSERT rồi tải tệp thì xem trước chạy ở chế độ đó", async () => {
    renderDialog();

    await userEvent.click(screen.getByRole("button", { name: /thêm & cập nhật/i }));
    await uploadCsv();

    expect(service.previewImport.mock.calls[0]![2]).toBe("UPSERT");
  });
});

describe("bảng xem trước", () => {
  it("hiện tổng hợp và dữ liệu từng dòng", async () => {
    renderDialog();

    await uploadCsv();

    expect(await screen.findByText(/1 hợp lệ/)).toBeInTheDocument();
    expect(screen.getByDisplayValue("EMP001")).toBeInTheDocument();
    expect(screen.getByText(/Engineering/)).toBeInTheDocument();
  });

  it("hiện lỗi theo đúng dòng và đúng ô", async () => {
    service.previewImport.mockResolvedValue(
      previewResponse([
        previewRow({
          valid: false,
          action: "skip",
          errors: [{ field: "department_code", message: "Mã phòng ban không tồn tại: XYZ" }],
          normalized: { ...previewRow().normalized, department_code: "XYZ" },
        }),
      ]),
    );
    renderDialog();

    await uploadCsv();

    expect(await screen.findByText("Mã phòng ban không tồn tại: XYZ")).toBeInTheDocument();
    expect(screen.getByText(/1 lỗi/)).toBeInTheDocument();
  });

  it("chặn lưu khi còn dòng lỗi", async () => {
    service.previewImport.mockResolvedValue(
      previewResponse([
        previewRow({ valid: false, action: "skip", errors: [{ field: "employee_code", message: "Thiếu mã" }] }),
      ]),
    );
    renderDialog();

    await uploadCsv();

    const commit = await screen.findByRole("button", { name: /nhập 1 nhân viên/i });
    expect(commit).toBeDisabled();
  });

  it("cho lưu khi mọi dòng hợp lệ", async () => {
    renderDialog();

    await uploadCsv();

    expect(await screen.findByRole("button", { name: /nhập 1 nhân viên/i })).toBeEnabled();
  });

  it("sửa một ô rồi kiểm tra lại sẽ gửi dữ liệu đã sửa", async () => {
    renderDialog();
    await uploadCsv();
    service.previewImport.mockClear();

    const codeCell = screen.getByDisplayValue("EMP001");
    fireEvent.change(codeCell, { target: { value: "EMP009" } });
    await userEvent.click(screen.getByRole("button", { name: /kiểm tra lại/i }));

    await waitFor(() => expect(service.previewImport).toHaveBeenCalled());
    expect(service.previewImport.mock.calls[0]![0][0]).toMatchObject({ employee_code: "EMP009" });
  });

  it("cảnh báo cột lạ nhưng không chặn", async () => {
    service.previewImport.mockResolvedValue(
      previewResponse([previewRow()], { headers: { missing: [], unknown: ["cot_la"], duplicated: [] } }),
    );
    renderDialog();

    await uploadCsv();

    expect(await screen.findByText(/cot_la/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /nhập 1 nhân viên/i })).toBeEnabled();
  });
});

describe("sửa dòng bằng biểu mẫu nhân viên", () => {
  /** Bảng xem trước vẫn nằm dưới, nên lấy ô của hộp thoại là ô xuất hiện SAU. */
  const inEditor = (value: string) => screen.getAllByDisplayValue(value).at(-1)!;

  it("biểu mẫu tự điền từ CSV, kể cả phòng ban/chức vụ đã tra được", async () => {
    renderDialog();
    await uploadCsv();

    await userEvent.click(await screen.findByRole("button", { name: /sửa/i }));

    expect(await screen.findByText(/Sửa dòng 2/)).toBeInTheDocument();
    expect(inEditor("Nguyễn")).toBeInTheDocument();
    expect(inEditor("An")).toBeInTheDocument();

    // Ô chọn hiện đúng bản ghi đã tra, không bắt HR chọn lại từ đầu.
    await waitFor(() => {
      const selects = screen.getAllByRole("combobox") as HTMLSelectElement[];
      const department = selects.find((s) => within(s).queryByText("Engineering"));
      expect(department?.value).toBe(DEPT_ID);
    });
    const selects = screen.getAllByRole("combobox") as HTMLSelectElement[];
    const position = selects.find((s) => within(s).queryByText("Backend Engineer"));
    expect(position?.value).toBe(POS_ID);
  });

  it("áp dụng bản sửa sẽ kiểm tra lại với mã mới, tham chiếu đổi về MÃ", async () => {
    renderDialog();
    await uploadCsv();
    await userEvent.click(await screen.findByRole("button", { name: /sửa/i }));
    await screen.findByText(/Sửa dòng 2/);
    await waitFor(() => expect(organization.departmentsFlat).toHaveBeenCalled());
    service.previewImport.mockClear();

    fireEvent.change(inEditor("EMP001"), { target: { value: "EMP123" } });
    await userEvent.click(screen.getByRole("button", { name: /áp dụng vào bản xem trước/i }));

    await waitFor(() => expect(service.previewImport).toHaveBeenCalled());
    expect(service.previewImport.mock.calls[0]![0][0]).toMatchObject({
      employee_code: "EMP123",
      department_code: "ENG",
      position_code: "BE01",
    });
  });
});

describe("ghi thật", () => {
  it("gửi kèm importId + checksum của bản xem trước", async () => {
    renderDialog();
    await uploadCsv();

    await userEvent.click(await screen.findByRole("button", { name: /nhập 1 nhân viên/i }));

    await waitFor(() => expect(service.commitImport).toHaveBeenCalled());
    expect(service.commitImport.mock.calls[0]![0]).toMatchObject({
      importId: "import-1",
      checksum: "c".repeat(64),
      mode: "CREATE_ONLY",
    });
  });

  it("hiện kết quả và làm mới danh sách nhân viên", async () => {
    const { onDone } = renderDialog();
    await uploadCsv();

    await userEvent.click(await screen.findByRole("button", { name: /nhập 1 nhân viên/i }));

    expect(await screen.findByText(/nhập thành công/i)).toBeInTheDocument();
    expect(screen.getByText("Đã tạo").nextSibling).toHaveTextContent("1");
    expect(onDone).toHaveBeenCalled();
  });

  it("lỗi từ server hiện nguyên văn cho HR", async () => {
    service.commitImport.mockRejectedValue({
      response: { data: { error: { message: "Dữ liệu đã thay đổi sau khi xem trước" } } },
    });
    renderDialog();
    await uploadCsv();

    await userEvent.click(await screen.findByRole("button", { name: /nhập 1 nhân viên/i }));

    expect(await screen.findByText(/Dữ liệu đã thay đổi sau khi xem trước/)).toBeInTheDocument();
  });
});
