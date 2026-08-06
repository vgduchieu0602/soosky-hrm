import BadRequestError from "@shared/adapters/driver/http/errors/BadRequestError";

/**
 * Kiểm tra hình dạng (shape) của request body ở tầng HTTP: field bắt buộc
 * phải có mặt và mọi field phải đúng kiểu dữ liệu. Vi phạm → 400
 * INVALID_REQUEST, gom toàn bộ lỗi của các field vào một message duy nhất
 * để client sửa trong một lần.
 *
 * Chỉ dừng ở mức tồn tại + kiểu dữ liệu; quy tắc nghiệp vụ (tên rỗng, giá trị
 * enum hợp lệ, ...) do use-case và domain đảm nhiệm để giữ đúng mã lỗi
 * 422/409 của từng nghiệp vụ.
 */

export interface FieldSpec<T, Required extends boolean = boolean> {
    readonly required: Required;
    readonly typeName: string;
    readonly cast:     (value: unknown) => T | undefined;
}

export type BodySchemaSpec = Record<string, FieldSpec<unknown, boolean>>;

type SpecValue<S> = S extends FieldSpec<infer T, boolean> ? T : never;

/**
 * Kết quả parse: field bắt buộc luôn có mặt; field tuỳ chọn bị loại khỏi
 * object khi vắng mặt (tương thích `exactOptionalPropertyTypes`).
 */
export type ParsedBody<S extends BodySchemaSpec> =
    & { [K in keyof S as S[K] extends FieldSpec<unknown, true>  ? K : never]:  SpecValue<S[K]> }
    & { [K in keyof S as S[K] extends FieldSpec<unknown, false> ? K : never]?: SpecValue<S[K]> };

export interface BodySchema<S extends BodySchemaSpec> {
    parse(body: unknown): ParsedBody<S>;
}

/**
 * Các kiểu field hỗ trợ trong body schema. Biến thể `optional*` cho phép
 * field vắng mặt hoặc `null` mà không sinh lỗi; khi đó field bị loại khỏi
 * kết quả parse.
 */
export const field = {
    string:         requiredField("a string", castString),
    optionalString: optionalField("a string", castString),
    number:         requiredField("a number", castNumber),
    optionalNumber: optionalField("a number", castNumber),
    date:           requiredField("an ISO-8601 date string", castDate),
    optionalDate:   optionalField("an ISO-8601 date string", castDate),
    boolean:         requiredField("a boolean", castBoolean),
    optionalBoolean: optionalField("a boolean", castBoolean),
};

/**
 * Khai báo schema cho body của một endpoint.
 *
 * `parse` trả về object đã định kiểu theo schema, hoặc ném `BadRequestError`
 * liệt kê mọi field thiếu/sai kiểu.
 */
export function bodySchema<S extends BodySchemaSpec>(spec: S): BodySchema<S> {
    return {
        parse(body: unknown): ParsedBody<S> {
            const source = toJsonObject(body);
            const issues: string[] = [];
            const parsed: Record<string, unknown> = {};

            for (const [fieldName, fieldSpec] of Object.entries(spec)) {
                const raw = source[fieldName];
                if (raw == undefined) {
                    if (fieldSpec.required) issues.push(`'${fieldName}' is required`);
                    continue;
                }

                const value = fieldSpec.cast(raw);
                if (value === undefined) {
                    issues.push(`'${fieldName}' must be ${fieldSpec.typeName}`);
                    continue;
                }
                parsed[fieldName] = value;
            }

            if (issues.length > 0) {
                throw new BadRequestError(`Invalid request body: ${issues.join("; ")}`);
            }
            return parsed as ParsedBody<S>;
        },
    };
}

export function optionalQueryBoolean(value: unknown, field: string): boolean | undefined {
    if (value == undefined) return undefined;
    if (value === "true")   return true;
    if (value === "false")  return false;
    throw new BadRequestError(`Query '${field}' must be 'true' or 'false'`);
}

export function optionalQueryEnum<T extends string>(value: unknown, field: string, allowed: readonly T[]): T | undefined {
    if (value == undefined) return undefined;
    if (typeof value === "string" && (allowed as readonly string[]).includes(value)) {
        return value as T;
    }
    throw new BadRequestError(`Query '${field}' must be one of: ${allowed.join(", ")}`);
}

export function requiredQueryString(value: unknown, field: string): string {
    if (typeof value !== "string" || value.length === 0) {
        throw new BadRequestError(`Query '${field}' is required and must be a non-empty string`);
    }
    return value;
}

function requiredField<T>(typeName: string, cast: (value: unknown) => T | undefined): FieldSpec<T, true> {
    return { required: true, typeName, cast };
}

function optionalField<T>(typeName: string, cast: (value: unknown) => T | undefined): FieldSpec<T, false> {
    return { required: false, typeName, cast };
}

/**
 * Body vắng mặt (endpoint không yêu cầu gửi body) được coi như object rỗng;
 * body có mặt nhưng không phải JSON object (mảng, chuỗi, số, ...) là sai schema.
 */
function toJsonObject(body: unknown): Record<string, unknown> {
    if (body == undefined) return {};
    if (typeof body !== "object" || Array.isArray(body)) {
        throw new BadRequestError("Request body must be a JSON object");
    }
    return body as Record<string, unknown>;
}

function castString(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
}

function castNumber(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * CHỈ nhận boolean thật, không nhận "true"/1. Body là JSON nên client gửi được
 * boolean đúng kiểu; nhận thêm chuỗi chỉ mở đường cho lỗi âm thầm (chuỗi
 * "false" là truthy).
 */
function castBoolean(value: unknown): boolean | undefined {
    return typeof value === "boolean" ? value : undefined;
}

function castDate(value: unknown): Date | undefined {
    if (typeof value !== "string") return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
}
