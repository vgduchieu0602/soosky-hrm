import RandomSecretGenerator from "@modules/auth/core/app/ports/RandomSecretGenerator";
import { randomBytes } from "node:crypto";

/** Nguồn entropy an toàn cho runtime Node.js. */
export default class CryptoRandomSecretGenerator implements RandomSecretGenerator {
    public generate(byteLength: number): string {
        return randomBytes(byteLength).toString("base64url");
    }
}
