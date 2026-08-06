import CryptoRandomSecretGenerator from "@modules/auth/adapters/driven/security/CryptoRandomSecretGenerator";
import { describe, expect, it } from "vitest";

describe("CryptoRandomSecretGenerator", () => {
    it("generates a URL-safe secret from the requested byte length", () => {
        const secret = new CryptoRandomSecretGenerator().generate(32);

        expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    });
});
