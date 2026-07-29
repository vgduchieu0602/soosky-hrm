/// <reference types="jest" />
import { bodySchema, field } from "@shared/adapters/driver/http/validation";
import { describe, expect, it } from "vitest";

describe("validation field.number", () => {
    it("nhận số hợp lệ", () => {
        const schema = bodySchema({ level: field.number });
        expect(schema.parse({ level: 3 })).toEqual({ level: 3 });
    });

    it("từ chối chuỗi cho field số", () => {
        const schema = bodySchema({ level: field.number });
        expect(() => schema.parse({ level: "3" })).toThrow(/must be a number/);
    });

    it("optionalNumber vắng mặt thì bị loại khỏi kết quả", () => {
        const schema = bodySchema({ level: field.optionalNumber });
        expect(schema.parse({})).toEqual({});
    });
});
