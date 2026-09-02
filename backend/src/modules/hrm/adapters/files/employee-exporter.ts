import type { ExportPort, Doc } from '@modules/hrm/core/employee/domain/ports';

interface ExportRow {
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

const EXPORT_COLUMNS: { header: string; key: string; width: number }[] = [
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

export class XlsxEmployeeExporter implements ExportPort {
  async export(rows: Doc[]): Promise<Buffer> {
    const data = rows as ExportRow[];
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Soosky HRM';
    const ws = wb.addWorksheet('Nhân viên', { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = EXPORT_COLUMNS;

    for (const r of data) {
      const fullName = [r.profile?.lastName, r.profile?.middleName, r.profile?.firstName]
        .filter(Boolean)
        .join(' ');
      ws.addRow({
        code: r.employeeCode ?? '',
        fingerprint: r.fingerprintId ?? '',
        name: fullName || r.employeeCode || '',
        dept: r.departmentId?.name ?? '',
        position: r.positionId?.title ?? '',
        type: r.employeeType ? TYPE_LABEL[r.employeeType] ?? r.employeeType : '',
        status: r.status ? STATUS_LABEL[r.status] ?? r.status : '',
        hireDate: r.hireDate ? new Date(r.hireDate).toISOString().slice(0, 10) : '',
        workEmail: r.profile?.workEmail ?? '',
        email: r.profile?.email ?? '',
        phone: r.profile?.phone ?? '',
      });
    }

    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0EA5C4' } };
    header.alignment = { vertical: 'middle' };
    header.height = 20;
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: EXPORT_COLUMNS.length } };

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf as ArrayBuffer);
  }
}
