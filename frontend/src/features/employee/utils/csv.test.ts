import { describe, expect, it } from "vitest";
import { CsvParseError, MAX_CSV_BYTES, parseEmployeeCsv } from "@features/employee/utils/csv";

/**
 * Trình đọc CSV phía client. Điều được khoá: không tự cắt chuỗi bằng dấu phẩy —
 * ô bọc nháy kép, ô chứa dấu phẩy và ô xuống dòng phải ra đúng; BOM của Excel
 * không được dính vào tên cột; và ngày `2026-01-15` giữ nguyên là chuỗi.
 */

function csvFile(content: string, name = "nhan-vien.csv"): File {
  return new File([content], name, { type: "text/csv" });
}

const HEADER = "employee_code,last_name,first_name,department_code,position_code,employment_type,join_date";

describe("parseEmployeeCsv", () => {
  it("đọc header và các dòng dữ liệu theo tên cột", async () => {
    const parsed = await parseEmployeeCsv(csvFile(`${HEADER}\nEMP001,Nguyễn,An,ENG,BE01,full_time,2026-01-15\n`));

    expect(parsed.headers).toEqual([
      "employee_code", "last_name", "first_name", "department_code", "position_code", "employment_type", "join_date",
    ]);
    expect(parsed.rows).toEqual([
      {
        employee_code: "EMP001", last_name: "Nguyễn", first_name: "An",
        department_code: "ENG", position_code: "BE01", employment_type: "full_time", join_date: "2026-01-15",
      },
    ]);
  });

  it("bóc BOM để tên cột đầu tiên không bị hỏng", async () => {
    const bom = String.fromCharCode(0xfeff);
    const parsed = await parseEmployeeCsv(csvFile(`${bom}${HEADER}\nEMP001,Lê,B,ENG,BE01,full_time,2026-01-15\n`));

    expect(parsed.headers[0]).toBe("employee_code");
    expect(parsed.rows[0]!.employee_code).toBe("EMP001");
  });

  it("giữ nguyên tiếng Việt có dấu", async () => {
    const parsed = await parseEmployeeCsv(csvFile(`${HEADER}\nEMP001,Nguyễn,Ánh,ENG,BE01,full_time,2026-01-15\n`));

    expect(parsed.rows[0]!.last_name).toBe("Nguyễn");
    expect(parsed.rows[0]!.first_name).toBe("Ánh");
  });

  it("ô bọc nháy kép có dấu phẩy và xuống dòng vẫn nguyên vẹn", async () => {
    const content = `${HEADER},address\nEMP001,Nguyễn,An,ENG,BE01,full_time,2026-01-15,"Số 1, ngõ 2\nHà Nội"\n`;

    const parsed = await parseEmployeeCsv(csvFile(content));

    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]!.address).toBe("Số 1, ngõ 2\nHà Nội");
  });

  it("không đoán kiểu: ngày ISO vẫn là chuỗi nguyên văn", async () => {
    const parsed = await parseEmployeeCsv(csvFile(`${HEADER}\nEMP001,Lê,B,ENG,BE01,full_time,2026-01-15\n`));

    expect(parsed.rows[0]!.join_date).toBe("2026-01-15");
  });

  it("bỏ dòng trắng nhưng đếm lại để không im lặng nuốt dữ liệu", async () => {
    const parsed = await parseEmployeeCsv(
      csvFile(`${HEADER}\nEMP001,Lê,B,ENG,BE01,full_time,2026-01-15\n,,,,,,\nEMP002,Lê,C,ENG,BE01,full_time,2026-01-16\n`),
    );

    expect(parsed.rows).toHaveLength(2);
    expect(parsed.skippedEmptyRows).toBe(1);
  });

  it("ô trống bị loại khỏi bản ghi (khác với chuỗi rỗng)", async () => {
    const parsed = await parseEmployeeCsv(csvFile(`${HEADER},phone\nEMP001,Lê,B,ENG,BE01,full_time,2026-01-15,\n`));

    expect(parsed.rows[0]).not.toHaveProperty("phone");
  });

  it("giữ nguyên cột lặp trong header để bước xem trước báo lỗi", async () => {
    const parsed = await parseEmployeeCsv(
      csvFile(`${HEADER},employee_code\nEMP001,Lê,B,ENG,BE01,full_time,2026-01-15,EMP002\n`),
    );

    expect(parsed.headers.filter((h) => h === "employee_code")).toHaveLength(2);
  });

  it("tệp chỉ có header → lỗi rõ ràng", async () => {
    await expect(parseEmployeeCsv(csvFile(`${HEADER}\n`))).rejects.toBeInstanceOf(CsvParseError);
  });

  it("tệp rỗng → lỗi rõ ràng", async () => {
    await expect(parseEmployeeCsv(csvFile(""))).rejects.toBeInstanceOf(CsvParseError);
  });

  it("tệp quá lớn bị chặn ngay trên máy người dùng", async () => {
    const big = csvFile(HEADER);
    Object.defineProperty(big, "size", { value: MAX_CSV_BYTES + 1 });

    await expect(parseEmployeeCsv(big)).rejects.toThrow(/lớn hơn/);
  });
});
