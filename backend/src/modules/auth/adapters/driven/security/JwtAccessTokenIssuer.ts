import AccessTokenIssuer, { AccessTokenClaims } from "@modules/auth/core/app/ports/AccessTokenIssuer";
import IssuedToken from "@modules/auth/core/app/ports/IssuedToken";
import { createHmac } from "node:crypto";

const DEFAULT_TTL_SECONDS = 15 * 60; // 15 phút

/**
 * Hiện thực `AccessTokenIssuer` bằng JWT ký HS256 — đối xứng với
 * `JwtAccessTokenVerifier` phía HTTP adapter: cùng secret, cùng claim
 * `userId` + `exp`.
 */
export default class JwtAccessTokenIssuer implements AccessTokenIssuer {

    public constructor(
        private readonly _secret: string,
        private readonly _ttlSeconds: number = DEFAULT_TTL_SECONDS,
    ) {}

    public async issue(accountId: string, claims: AccessTokenClaims): Promise<IssuedToken> {
        const nowSeconds = Math.floor(Date.now() / 1000);
        const expSeconds = nowSeconds + this._ttlSeconds;

        const header  = { alg: "HS256", typ: "JWT" };
        const payload = { userId: accountId, mustChangePassword: claims.mustChangePassword, iat: nowSeconds, exp: expSeconds };

        const signingInput = `${this._encodeJson(header)}.${this._encodeJson(payload)}`;
        const signature    = createHmac("sha256", this._secret).update(signingInput).digest("base64url");

        return {
            token:     `${signingInput}.${signature}`,
            expiresAt: new Date(expSeconds * 1000),
        };
    }

    /**
     * Encode một object JSON thành phần base64url của JWT.
     */
    private _encodeJson(value: Record<string, unknown>): string {
        return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
    }
}
