import { Types } from 'mongoose';
import { EmployeeContractModel } from '@shared/models/employee-contract.model';
import { EmployeeDocumentModel } from '@shared/models/employee-document.model';
import { EmployeeAsset } from '@shared/models/employee-asset.model';
import type { ExportPort, Doc } from '@features/employee/domain/ports';

interface ExportRow {
  _id?: unknown;
  employeeCode?: string;
  fingerprintId?: string | null;
  departmentId?: { name?: string } | null;
  positionId?: { title?: string } | null;
  managerId?: { profile?: { firstName?: string; middleName?: string; lastName?: string }; employeeCode?: string } | null;
  employeeType?: string;
  status?: string;
  hireDate?: Date | string | null;
  profile?: { firstName?: string; middleName?: string; lastName?: string; email?: string; workEmail?: string; phone?: string } | null;
}

const TYPE_LABEL: Record<string, string> = {
  full_time: 'Toàn thời gian', part_time: 'Bán thời gian', contract: 'Hợp đồng', intern: 'Thực tập',
};
const STATUS_LABEL: Record<string, string> = {
  onboarding: 'Onboarding', active: 'Đang làm việc', on_leave: 'Đang nghỉ', terminated: 'Đã nghỉ việc',
};
const CONTRACT_TYPE_LABEL: Record<string, string> = {
  fixed_term: 'Có thời hạn', indefinite: 'Không thời hạn',
};
const EMPLOYMENT_STATUS_LABEL: Record<string, string> = {
  probation: 'Thử việc', official: 'Chính thức', internship: 'Thực tập',
};
const CONTRACT_STATUS_LABEL: Record<string, string> = {
  active: 'Hiệu lực', expired: 'Hết hạn', terminated: 'Chấm dứt',
};
const DOC_TYPE_LABEL: Record<string, string> = {
  id_card: 'CCCD/CMND', passport: 'Hộ chiếu', degree: 'Bằng cấp', certificate: 'Chứng chỉ', visa: 'Visa', other: 'Khác',
};
const ASSET_CONDITION_LABEL: Record<string, string> = {
  new: 'Mới', good: 'Tốt', fair: 'Bình thường', damaged: 'Hư hỏng',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type XlsxWorksheet = any;
const d10 = (v: unknown) => (v ? new Date(v as string).toISOString().slice(0, 10) : '');
const dec = (v: unknown) => (v == null ? '' : Number(v.toString()));

function styleHeader(ws: XlsxWorksheet, cols: number) {
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0EA5C4' } };
  header.alignment = { vertical: 'middle' };
  header.height = 20;
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols } };
}

export class XlsxEmployeeExporter implements ExportPort {
  async export(rows: Doc[]): Promise<Buffer> {
    const data = rows as ExportRow[];
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Soosky HRM';

    // ---- Sheet 1: Nhân viên (core) ----
    const nameOf = (r: ExportRow) =>
      [r.profile?.lastName, r.profile?.middleName, r.profile?.firstName].filter(Boolean).join(' ') ||
      r.employeeCode || '';
    const idToCode = new Map<string, string>();
    const idToName = new Map<string, string>();
    for (const r of data) {
      if (r._id) { idToCode.set(String(r._id), r.employeeCode ?? ''); idToName.set(String(r._id), nameOf(r)); }
    }

    const ws = wb.addWorksheet('Nhân viên');
    ws.columns = [
      { header: 'Mã NV', key: 'code', width: 14 },
      { header: 'Mã vân tay', key: 'fingerprint', width: 13 },
      { header: 'Họ và tên', key: 'name', width: 26 },
      { header: 'Phòng ban', key: 'dept', width: 22 },
      { header: 'Chức vụ', key: 'position', width: 22 },
      { header: 'Loại HĐ', key: 'type', width: 16 },
      { header: 'Trạng thái', key: 'status', width: 16 },
      { header: 'Ngày vào', key: 'hireDate', width: 13 },
      { header: 'Email công ty', key: 'workEmail', width: 26 },
      { header: 'Email cá nhân', key: 'email', width: 26 },
      { header: 'Điện thoại', key: 'phone', width: 16 },
    ];
    for (const r of data) {
      ws.addRow({
        code: r.employeeCode ?? '',
        fingerprint: r.fingerprintId ?? '',
        name: nameOf(r),
        dept: r.departmentId?.name ?? '',
        position: r.positionId?.title ?? '',
        type: r.employeeType ? TYPE_LABEL[r.employeeType] ?? r.employeeType : '',
        status: r.status ? STATUS_LABEL[r.status] ?? r.status : '',
        hireDate: d10(r.hireDate),
        workEmail: r.profile?.workEmail ?? '',
        email: r.profile?.email ?? '',
        phone: r.profile?.phone ?? '',
      });
    }
    styleHeader(ws, 11);

    // ---- Load sub-resources for all exported employees (batch) ----
    const ids = data.map((r) => r._id).filter(Boolean).map((id) => new Types.ObjectId(String(id)));
    const [contracts, documents, assets] = await Promise.all([
      EmployeeContractModel.find({ employeeId: { $in: ids } }).sort({ startDate: -1 }).lean(),
      EmployeeDocumentModel.find({ employeeId: { $in: ids } }).sort({ created_at: -1 }).lean(),
      EmployeeAsset.find({ employeeId: { $in: ids } }).sort({ assignedDate: -1 }).lean(),
    ]);
    const codeCol = (eid: unknown) => idToCode.get(String(eid)) ?? '';
    const nameCol = (eid: unknown) => idToName.get(String(eid)) ?? '';

    // ---- Sheet 2: Hợp đồng ----
    const wsC = wb.addWorksheet('Hợp đồng');
    wsC.columns = [
      { header: 'Mã NV', key: 'code', width: 14 },
      { header: 'Họ và tên', key: 'name', width: 26 },
      { header: 'Số HĐ', key: 'number', width: 18 },
      { header: 'Loại HĐ', key: 'type', width: 16 },
      { header: 'Tình trạng LĐ', key: 'employment', width: 14 },
      { header: 'Lương cơ bản', key: 'salary', width: 16 },
      { header: 'Bắt đầu', key: 'start', width: 13 },
      { header: 'Kết thúc', key: 'end', width: 13 },
      { header: 'Trạng thái', key: 'cstatus', width: 13 },
      { header: 'Tệp', key: 'file', width: 30 },
    ];
    for (const c of contracts as unknown as Record<string, unknown>[]) {
      wsC.addRow({
        code: codeCol(c.employeeId), name: nameCol(c.employeeId),
        number: c.contractNumber ?? '',
        type: c.contractType ? CONTRACT_TYPE_LABEL[c.contractType as string] ?? c.contractType : '',
        employment: c.employmentStatus ? EMPLOYMENT_STATUS_LABEL[c.employmentStatus as string] ?? c.employmentStatus : '',
        salary: dec(c.baseSalary),
        start: d10(c.startDate), end: d10(c.endDate),
        cstatus: c.status ? CONTRACT_STATUS_LABEL[c.status as string] ?? c.status : '',
        file: c.fileUrl ?? '',
      });
    }
    styleHeader(wsC, 10);

    // ---- Sheet 3: Tài liệu ----
    const wsD = wb.addWorksheet('Tài liệu');
    wsD.columns = [
      { header: 'Mã NV', key: 'code', width: 14 },
      { header: 'Họ và tên', key: 'name', width: 26 },
      { header: 'Loại tài liệu', key: 'type', width: 16 },
      { header: 'Số hiệu', key: 'number', width: 20 },
      { header: 'Ngày cấp', key: 'issued', width: 13 },
      { header: 'Ngày hết hạn', key: 'expiry', width: 13 },
      { header: 'Nơi cấp', key: 'by', width: 22 },
      { header: 'Tệp', key: 'file', width: 30 },
    ];
    for (const doc of documents as unknown as Record<string, unknown>[]) {
      wsD.addRow({
        code: codeCol(doc.employeeId), name: nameCol(doc.employeeId),
        type: doc.documentType ? DOC_TYPE_LABEL[doc.documentType as string] ?? doc.documentType : '',
        number: doc.documentNumber ?? '',
        issued: d10(doc.issuedDate), expiry: d10(doc.expiryDate),
        by: doc.issuedBy ?? '', file: doc.fileUrl ?? '',
      });
    }
    styleHeader(wsD, 8);

    // ---- Sheet 4: Tài sản ----
    const wsA = wb.addWorksheet('Tài sản');
    wsA.columns = [
      { header: 'Mã NV', key: 'code', width: 14 },
      { header: 'Họ và tên', key: 'name', width: 26 },
      { header: 'Tên tài sản', key: 'asset', width: 24 },
      { header: 'Mã tài sản', key: 'acode', width: 16 },
      { header: 'Ngày cấp', key: 'assigned', width: 13 },
      { header: 'Ngày trả', key: 'returned', width: 13 },
      { header: 'Tình trạng', key: 'condition', width: 14 },
      { header: 'Ghi chú', key: 'note', width: 30 },
    ];
    for (const a of assets as unknown as Record<string, unknown>[]) {
      wsA.addRow({
        code: codeCol(a.employeeId), name: nameCol(a.employeeId),
        asset: a.assetName ?? '', acode: a.assetCode ?? '',
        assigned: d10(a.assignedDate), returned: d10(a.returnedDate),
        condition: a.condition ? ASSET_CONDITION_LABEL[a.condition as string] ?? a.condition : '',
        note: a.note ?? '',
      });
    }
    styleHeader(wsA, 8);

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf as ArrayBuffer);
  }
}
