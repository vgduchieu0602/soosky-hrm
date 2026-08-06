import { describe, expect, it } from "vitest";
import { filterHistory, historyTouchedKeys } from "@features/employee/utils/history-filter";
import type { EmployeeHistoryRecord } from "@features/employee/types/employee.types";

const RECORDS: EmployeeHistoryRecord[] = [
  {
    _id: "h1",
    eventType: "promotion",
    effectiveDate: "2026-08-01T00:00:00.000Z",
    fromValue: { positionId: "pos-1" },
    toValue: { positionId: "pos-2" },
  },
  {
    _id: "h2",
    eventType: "salary_change",
    effectiveDate: "2026-01-15T00:00:00.000Z",
    fromValue: { baseSalary: 18_000_000 },
    toValue: { baseSalary: 20_000_000 },
  },
  {
    _id: "h3",
    eventType: "transfer",
    effectiveDate: "2026-07-20T00:00:00.000Z",
    toValue: { departmentId: "dept-2" },
  },
] as EmployeeHistoryRecord[];

const NO_FILTER = { cutoff: null, action: "all", dataCat: "all" };

describe("filterHistory", () => {
  it("không lọc gì khi cả ba tiêu chí để mở", () => {
    expect(filterHistory(RECORDS, NO_FILTER).map((r) => r._id)).toEqual(["h1", "h2", "h3"]);
  });

  it("cutoff nhận từ ngoài, không tự lấy giờ hiện tại", () => {
    const cutoff = new Date("2026-07-01T00:00:00.000Z").getTime();

    // Cùng đầu vào -> cùng kết quả ở mọi lần gọi: đây là điều kiện để dùng được
    // trong render mà không vi phạm react-hooks/purity.
    const first = filterHistory(RECORDS, { ...NO_FILTER, cutoff });
    const second = filterHistory(RECORDS, { ...NO_FILTER, cutoff });

    expect(first.map((r) => r._id)).toEqual(["h1", "h3"]);
    expect(second.map((r) => r._id)).toEqual(first.map((r) => r._id));
  });

  it("lọc theo loại thao tác", () => {
    expect(filterHistory(RECORDS, { ...NO_FILTER, action: "salary_change" }).map((r) => r._id)).toEqual(["h2"]);
  });

  it("lọc theo trường dữ liệu bị chạm, xét cả before và after", () => {
    expect(filterHistory(RECORDS, { ...NO_FILTER, dataCat: "baseSalary" }).map((r) => r._id)).toEqual(["h2"]);
    // `h3` chỉ có `toValue` -> vẫn phải khớp.
    expect(filterHistory(RECORDS, { ...NO_FILTER, dataCat: "departmentId" }).map((r) => r._id)).toEqual(["h3"]);
  });

  it("ba tiêu chí cộng dồn (AND), không phải loại trừ nhau", () => {
    const cutoff = new Date("2026-07-01T00:00:00.000Z").getTime();
    expect(filterHistory(RECORDS, { cutoff, action: "salary_change", dataCat: "all" })).toEqual([]);
  });
});

describe("historyTouchedKeys", () => {
  it("hợp của khoá trong fromValue và toValue, bỏ trùng", () => {
    expect(historyTouchedKeys(RECORDS[0] as EmployeeHistoryRecord)).toEqual(["positionId", "positionId"]);
    expect(new Set(historyTouchedKeys(RECORDS[0] as EmployeeHistoryRecord))).toEqual(new Set(["positionId"]));
  });

  it("bản ghi thiếu fromValue vẫn trả khoá của toValue", () => {
    expect(historyTouchedKeys(RECORDS[2] as EmployeeHistoryRecord)).toEqual(["departmentId"]);
  });
});
