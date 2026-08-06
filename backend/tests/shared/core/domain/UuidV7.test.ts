import createUuidV7 from "@shared/core/domain/UuidV7";
import { describe, expect, it } from "vitest";

describe("createUuidV7", () => {
    it("encodes the supplied millisecond timestamp with UUID v7 version and variant bits", () => {
        const id = createUuidV7(0, () => 0);

        expect(id).toBe("00000000-0000-7000-8000-000000000000");
    });
});
