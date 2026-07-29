/**
 * Kiểm tra hình dạng (shape) tham số dòng lệnh ở tầng CLI: flag bắt buộc phải
 * có mặt và có giá trị. Vi phạm → `CliUsageError`, gom toàn bộ lỗi vào một
 * message duy nhất để người vận hành sửa trong một lần — tương ứng
 * `bodySchema` phía HTTP.
 *
 * Chỉ dừng ở mức tồn tại + có giá trị; quy tắc nghiệp vụ (email hợp lệ, độ
 * dài mật khẩu, ...) do use-case và domain đảm nhiệm.
 */

export class CliUsageError extends Error {
    constructor(message: string) {
        super(message);
        this.name = new.target.name;
    }
}

export interface FlagSpec {
    /** Tên flag trên dòng lệnh, vd: `--email`. */
    readonly flag: string;
}

export type FlagSchemaSpec = Record<string, FlagSpec>;

export type ParsedFlags<S extends FlagSchemaSpec> = { [K in keyof S]: string };

/**
 * Parse danh sách tham số theo schema. Hỗ trợ cả hai dạng `--flag value` và
 * `--flag=value`; mọi flag trong schema đều bắt buộc.
 *
 * @throws {CliUsageError} Flag thiếu, thiếu giá trị hoặc không nhận diện được.
 */
export function parseFlags<S extends FlagSchemaSpec>(args: string[], spec: S): ParsedFlags<S> {
    const flagToKey = new Map(Object.entries(spec).map(([key, { flag }]) => [flag, key]));
    const values: Record<string, string> = {};
    const seen   = new Set<string>();
    const issues: string[] = [];

    for (let i = 0; i < args.length; i++) {
        const arg = args[i]!;

        let flag  = arg;
        let value: string | undefined;
        const separatorAt = arg.indexOf("=");
        if (separatorAt >= 0) {
            flag  = arg.slice(0, separatorAt);
            value = arg.slice(separatorAt + 1);
        }

        const key = flagToKey.get(flag);
        if (key == undefined) {
            issues.push(`unknown argument '${arg}'`);
            continue;
        }
        seen.add(key);

        if (value == undefined) {
            const next = args[i + 1];
            if (next == undefined || next.startsWith("--")) {
                issues.push(`'${flag}' requires a value`);
                continue;
            }
            value = next;
            i++;
        }
        values[key] = value;
    }

    for (const [key, { flag }] of Object.entries(spec)) {
        if (!seen.has(key)) issues.push(`'${flag}' is required`);
    }

    if (issues.length > 0) {
        throw new CliUsageError(`Invalid arguments: ${issues.join("; ")}`);
    }
    return values as ParsedFlags<S>;
}
