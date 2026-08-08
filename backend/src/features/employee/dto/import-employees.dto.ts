import { z } from 'zod';

/**
 * Payload nhập CSV. Cột và luật kiểm tra KHÔNG khai báo lại ở đây — chúng đến từ
 * `EMPLOYEE_CSV_SCHEMA` và từ chính `createEmployeeDto` của luồng tạo nhân viên,
 * để CSV không bao giờ có bộ luật riêng lệch với API.
 *
 * Mỗi dòng cố tình để LỎNG ở tầng middleware: siết bằng Zod tại đây thì một ô sai
 * sẽ làm hỏng cả tệp, trong khi yêu cầu là báo lỗi theo từng dòng/từng cột.
 */

export const IMPORT_MODES = ['CREATE_ONLY', 'UPSERT'] as const;
export type ImportMode = (typeof IMPORT_MODES)[number];

/** Trần cứng: quá ngưỡng này thì tách tệp, không dựng hàng đợi nền cho v1. */
export const MAX_IMPORT_ROWS = 5000;

const rawRow = z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]));

const baseImport = z.object({
  mode: z.enum(IMPORT_MODES).default('CREATE_ONLY'),
  /** Chỉ để ghi audit — không lưu nội dung tệp. */
  fileName: z.string().max(255).optional(),
  /** Header đọc được từ tệp, dùng để báo thiếu cột / cột lạ / cột trùng. */
  headers: z.array(z.string().max(120)).max(200).optional(),
  rows: z
    .array(rawRow)
    .min(1, 'Tệp không có dòng dữ liệu nào')
    .max(MAX_IMPORT_ROWS, `Tối đa ${MAX_IMPORT_ROWS} dòng mỗi lần nhập`),
});

export const importPreviewDto = baseImport.strict();
export type ImportPreviewDto = z.infer<typeof importPreviewDto>;

/**
 * Bước ghi thật phải kèm `importId` + `checksum` do bước xem trước cấp. Server
 * tính lại checksum từ chính dữ liệu nhận được: lệch nghĩa là dữ liệu đã đổi sau
 * khi HR duyệt, và bị từ chối.
 */
export const importCommitDto = baseImport
  .extend({
    importId: z.string().min(8).max(64),
    checksum: z.string().length(64),
  })
  .strict();
export type ImportCommitDto = z.infer<typeof importCommitDto>;
