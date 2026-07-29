import PasswordHasher from "@modules/auth/core/app/ports/PasswordHasher";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const KEY_LENGTH  = 32;
const SALT_LENGTH = 16;

// Tham số chi phí theo khuyến nghị OWASP cho scrypt (N=2^17, r=8, p=1).
const COST = { N: 131072, r: 8, p: 1 } as const;

// maxmem của Node mặc định 32MB, không đủ cho N=2^17 (cần 128*N*r = 128MB).
const MAX_MEMORY = 256 * 1024 * 1024;

/**
 * Hiện thực `PasswordHasher` bằng scrypt của node:crypto — không cần thêm
 * dependency ngoài.
 *
 * Chuỗi hash tự mô tả: `scrypt$N$r$p$<salt>$<key>` (salt và key ở dạng
 * base64url), nên có thể nâng tham số chi phí về sau mà hash cũ vẫn verify
 * được bằng tham số ghi kèm trong chuỗi.
 */
export default class ScryptPasswordHasher implements PasswordHasher {

    public async hash(raw: string): Promise<string> {
        const salt = randomBytes(SALT_LENGTH);
        const key  = await this._derive(raw, salt, COST.N, COST.r, COST.p);

        return [
            "scrypt",
            COST.N,
            COST.r,
            COST.p,
            salt.toString("base64url"),
            key.toString("base64url"),
        ].join("$");
    }

    public async verify(raw: string, hash: string): Promise<boolean> {
        const parts = hash.split("$");
        const [scheme, rawN, rawR, rawP, encodedSalt, encodedKey] = parts;
        if (parts.length !== 6 || scheme !== "scrypt") return false;

        const N = Number(rawN);
        const r = Number(rawR);
        const p = Number(rawP);
        const isCostInvalid = !Number.isInteger(N) || N <= 1
            || !Number.isInteger(r) || r <= 0
            || !Number.isInteger(p) || p <= 0
            || 128 * N * r > MAX_MEMORY // chặn hash hỏng/độc hại kéo theo cấp phát bộ nhớ quá lớn
            ;
        if (isCostInvalid || encodedSalt == undefined || encodedKey == undefined) return false;

        const salt     = Buffer.from(encodedSalt, "base64url");
        const expected = Buffer.from(encodedKey, "base64url");
        if (expected.length !== KEY_LENGTH) return false;

        const actual = await this._derive(raw, salt, N, r, p);
        return timingSafeEqual(actual, expected);
    }

    /**
     * Bọc API callback của `scrypt` thành Promise, trả về khoá dẫn xuất.
     */
    private _derive(raw: string, salt: Buffer, N: number, r: number, p: number): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            scrypt(raw, salt, KEY_LENGTH, { N, r, p, maxmem: MAX_MEMORY }, (error, key) => {
                if (error) reject(error);
                else resolve(key);
            });
        });
    }
}
