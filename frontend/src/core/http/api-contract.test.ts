import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Hợp đồng FE ↔ BE: mọi URL frontend gọi phải là route CÓ THẬT của backend.
 *
 * Test này quét mã nguồn, trích từng lời gọi `api.get/post/put/patch/delete`,
 * chuẩn hoá tham số đường dẫn rồi đối chiếu với `share-docs/api-routes.json` —
 * bản kê do chính router backend sinh ra (`backend/tests/infra/route-manifest.test.ts`).
 *
 * Vì sao cần: mock axios chỉ chứng minh service gọi ĐÚNG THỨ NÓ TỰ KHAI, không
 * chứng minh backend có endpoint đó. Đây là chỗ bắt lệch hợp đồng — đổi route ở
 * backend mà quên sửa frontend sẽ đỏ ở đây thay vì ra 404 lúc chạy thật.
 */

const API_PREFIX = "/api/v1";
const SOURCE_ROOT = resolve(import.meta.dirname, "../..");
const MANIFEST_PATH = resolve(import.meta.dirname, "../../../../share-docs/api-routes.json");

interface Manifest { apiPrefix: string; routes: string[] }

function loadManifest(): Manifest {
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as Manifest;
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) { out.push(...sourceFiles(path)); continue; }
    if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(path);
  }
  return out;
}

/** `/payroll/periods/${id}/run/${employeeId}` -> `/payroll/periods/:id/run/:id`. */
function normalize(url: string): string {
  return url
    .replace(/\$\{[^}]*\}/g, ":id")
    .replace(/\?.*$/, "")
    .replace(/\/+$/, "");
}

const CALL_PATTERN = /\bapi\.(get|post|put|patch|delete)\s*(?:<[^(]*?>)?\s*\(\s*(`[^`]*`|"[^"]*")/g;

interface Call { method: string; url: string; file: string }

function collectCalls(): Call[] {
  const calls: Call[] = [];

  for (const file of sourceFiles(SOURCE_ROOT)) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(CALL_PATTERN)) {
      const method = (match[1] ?? "").toUpperCase();
      const raw = (match[2] ?? "").slice(1, -1);
      // Bỏ qua URL dựng động hoàn toàn (biến đứng đầu) — không đối chiếu tĩnh được.
      if (!raw.startsWith("/")) continue;
      calls.push({ method, url: normalize(raw), file: file.slice(SOURCE_ROOT.length + 1) });
    }
  }

  return calls;
}

describe("hợp đồng API frontend ↔ backend", () => {
  const manifest = loadManifest();
  const known = new Set(manifest.routes);
  const calls = collectCalls();

  it("quét được các lời gọi API trong mã nguồn", () => {
    // Chặn trường hợp regex trượt và test tự pass vì không tìm thấy gì.
    expect(calls.length).toBeGreaterThan(50);
  });

  it("mọi endpoint frontend gọi đều tồn tại ở backend", () => {
    const unknown = calls
      .filter((call) => !known.has(`${call.method} ${API_PREFIX}${call.url}`))
      .map((call) => `${call.method} ${call.url}  (${call.file})`);

    expect([...new Set(unknown)]).toEqual([]);
  });

  it("không còn tiền tố cũ /admin hay /settings", () => {
    const legacy = calls
      .filter((call) => /^\/(admin|settings|uploads|notifications)(\/|$)/.test(call.url))
      .map((call) => `${call.method} ${call.url}  (${call.file})`);

    expect(legacy).toEqual([]);
  });
});
