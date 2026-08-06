import CommitEmployeeImportUseCase from "@modules/employee/core/app/use-cases/import/CommitEmployeeImportUseCase";
import PreviewEmployeeImportUseCase from "@modules/employee/core/app/use-cases/import/PreviewEmployeeImportUseCase";
import ActorContext from "@shared/adapters/driver/http/ActorContext";
import BadRequestError from "@shared/adapters/driver/http/errors/BadRequestError";
import { bodySchema, field } from "@shared/adapters/driver/http/validation";
import { Request, Response } from "express";

export interface EmployeeImportControllerUseCases {
    previewEmployeeImport: PreviewEmployeeImportUseCase;
    commitEmployeeImport:  CommitEmployeeImportUseCase;
}

const bodySchemaPreview = bodySchema({
    csv: field.string,
});

const bodySchemaCommit = bodySchema({
    csv:      field.string,
    checksum: field.string,
});

/** Giới hạn kích thước file để một request không kéo cả tiến trình đi. ~20k dòng. */
const MAX_CSV_LENGTH = 2 * 1024 * 1024;

/**
 * Controller nhóm endpoint nhập nhân viên từ CSV.
 *
 * Nhận nội dung file dưới dạng CHUỖI trong JSON (`{ csv: "..." }`) thay vì
 * multipart: không cần thêm middleware upload, và luồng hai bước
 * preview → commit vốn phải gửi lại đúng nội dung đó lần thứ hai.
 */
export default class EmployeeImportController {
    public constructor(
        private readonly _useCases: EmployeeImportControllerUseCases,
    ) {}

    public previewImport = async (req: Request, res: Response): Promise<void> => {
        const body = bodySchemaPreview.parse(req.body);
        assertCsvSize(body.csv);

        const report = await this._useCases.previewEmployeeImport.execute({
            csv:         body.csv,
            actorUserId: ActorContext.get(res),
        });
        res.status(200).json(report);
    };

    public commitImport = async (req: Request, res: Response): Promise<void> => {
        const body = bodySchemaCommit.parse(req.body);
        assertCsvSize(body.csv);

        const output = await this._useCases.commitEmployeeImport.execute({
            csv:         body.csv,
            checksum:    body.checksum,
            actorUserId: ActorContext.get(res),
        });
        res.status(200).json(output);
    };
}

function assertCsvSize(csv: string): void {
    if (csv.length > MAX_CSV_LENGTH) {
        throw new BadRequestError(`'csv' vuot qua gioi han ${MAX_CSV_LENGTH} ky tu`);
    }
}
