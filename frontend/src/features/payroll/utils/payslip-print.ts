import { parseDecimal, fmtVND } from "@/shared/utils/money";
import type { PayrollRecord } from "@features/payroll/types/payroll.types";
import type { EmpInfo } from "@features/payroll/components/PayslipDrawer";

const COMPANY_NAME = "SOOSKY HRM";

const STATUS_LABEL: Record<string, string> = {
  draft: "Nháp",
  approved: "Đã duyệt",
  paid: "Đã chi",
};

/** Escape user-derived strings before embedding into the print HTML. */
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

const money = (v: unknown) => `${fmtVND(v as never)} ₫`;

/**
 * Build a self-contained A4 payslip document. Inline CSS only so it renders
 * identically in the isolated print window (browser handles Vietnamese fonts).
 */
function buildPayslipHtml(p: PayrollRecord, emp: EmpInfo, periodName: string): string {
  const base = parseDecimal(p.baseSalary);
  const att = p.attendanceRatio;
  const attPct = Math.round(att * 100);
  const money0 = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n));
  const kpiDetail = (weightPct: number, scorePct: number, amount: number): string => {
    const full = (weightPct / 100) * base * (scorePct / 100);
    const isProrated = Math.abs(amount - full * att) < Math.abs(amount - full);
    const head = `${weightPct}% × ${money0(base)} × ${Math.round(scorePct)}%`;
    return isProrated ? `${head} × ${attPct}% công` : head;
  };
  const groups = [
    { w: "20%", color: "#0E97C8", title: "Lương ngày công", detail: `20% × ${money0(base)} × ${attPct}% công (${p.actualWorkDays}/${p.standardWorkDays} ngày)`, ratio: attPct, amount: parseDecimal(p.attendanceComponent) },
    { w: "60%", color: "#2F66E0", title: "Lương hiệu suất", detail: kpiDetail(60, p.performanceRatio, parseDecimal(p.performanceComponent)), ratio: Math.round(p.performanceRatio), amount: parseDecimal(p.performanceComponent) },
    { w: "20%", color: "#7C5CD6", title: "Lương mục tiêu", detail: kpiDetail(20, p.goalRatio, parseDecimal(p.goalComponent)), ratio: Math.round(p.goalRatio), amount: parseDecimal(p.goalComponent) },
  ];
  const addons = [
    { label: "Phụ cấp", value: parseDecimal(p.totalAllowances) },
    { label: "Tăng ca", value: parseDecimal(p.overtimePay) },
    { label: "Thưởng", value: parseDecimal(p.totalBonuses) },
    // Truy lĩnh hiện thành dòng riêng, KHÔNG gộp vào thưởng: nhân viên phải đọc
    // được đây là tiền bù kỳ trước.
    { label: "Truy lĩnh kỳ trước", value: parseDecimal(p.totalRetroClaims ?? 0) },
  ].filter((r) => r.value > 0);
  const deductions = [
    { label: "BHXH (8%)", value: parseDecimal(p.socialInsurance) },
    { label: "BHYT (1.5%)", value: parseDecimal(p.healthInsurance) },
    { label: "BHTN (1%)", value: parseDecimal(p.unemploymentInsurance) },
    { label: "Thuế TNCN", value: parseDecimal(p.tax) },
    { label: "Đoàn phí công đoàn", value: parseDecimal(p.unionFee) },
    { label: "Khấu trừ khác", value: parseDecimal(p.otherDeductions) },
    { label: "Truy thu kỳ trước", value: parseDecimal(p.totalRetroClawbacks ?? 0) },
  ].filter((r) => r.value > 0);

  const groupRows = groups.map((g) => `
    <tr>
      <td><span class="wt" style="background:${g.color}">${g.w}</span> ${esc(g.title)}<div class="sub">${esc(g.detail)}</div></td>
      <td class="r" style="color:${g.color}">tỷ lệ ${g.ratio}%</td>
      <td class="r b">${money(g.amount)}</td>
    </tr>`).join("");
  const addonRows = addons.map((r) => `<tr><td>${esc(r.label)}</td><td class="r pos">+${money(r.value)}</td></tr>`).join("");
  const dedRows = deductions.map((r) => `<tr><td>${esc(r.label)}</td><td class="r neg">−${money(r.value)}</td></tr>`).join("");

  // Đổi hợp đồng giữa kỳ: hiện từng đoạn để nhân viên đọc được "nửa đầu tháng
  // thử việc, nửa sau chính thức" thay vì một con số bình quân không giải thích được.
  const segments = p.segments ?? [];
  const segmentBlock = segments.length > 1
    ? `<h2>Chi tiết theo hợp đồng</h2><table>
        <tr><td>Hợp đồng</td><td>Ngày công</td><td class="r">Lương theo công</td></tr>
        ${segments.map((seg) => `<tr><td>${esc(seg.contractNumber)} (${esc(seg.employmentStatus)})</td><td>${seg.workDays}</td><td class="r">${money(seg.proRatedBaseSalary)}</td></tr>`).join("")}
      </table>`
    : "";

  return `<!doctype html><html lang="vi"><head><meta charset="utf-8" />
<title>Phiếu lương ${esc(emp.name)} · ${esc(periodName)}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: "Inter", -apple-system, "Segoe UI", Roboto, sans-serif; color: #1e293b; font-size: 12.5px; line-height: 1.5; }
  .sheet { width: 760px; margin: 0 auto; padding: 32px 36px; }
  .hd { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #163985; padding-bottom: 16px; }
  .co { font-size: 18px; font-weight: 800; color: #163985; letter-spacing: -0.3px; }
  .co .sub { font-size: 11px; font-weight: 500; color: #64748b; margin-top: 2px; }
  .doc-title { text-align: right; }
  .doc-title h1 { margin: 0; font-size: 20px; color: #163985; letter-spacing: -0.4px; }
  .doc-title .period { font-size: 12px; color: #64748b; margin-top: 2px; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; margin: 18px 0 8px; }
  .meta div { display: flex; justify-content: space-between; border-bottom: 1px dotted #e2e8f0; padding: 4px 0; }
  .meta .k { color: #64748b; } .meta .v { font-weight: 600; }
  .net-box { display: flex; justify-content: space-between; align-items: center; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 12px 18px; margin: 16px 0 22px; }
  .net-box .lbl { font-weight: 700; color: #065f46; font-size: 13px; }
  .net-box .amt { font-weight: 800; color: #047857; font-size: 22px; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; border-left: 3px solid #2F66E0; padding-left: 8px; margin: 20px 0 8px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 6px 4px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  .r { text-align: right; } .b { font-weight: 700; }
  .pos { color: #047857; } .neg { color: #e11d48; }
  .sub { font-size: 10.5px; color: #94a3b8; margin-top: 1px; }
  .wt { display: inline-block; min-width: 34px; text-align: center; color: #fff; font-weight: 700; font-size: 10.5px; border-radius: 4px; padding: 1px 5px; margin-right: 4px; }
  .tot { font-weight: 700; border-top: 2px solid #e2e8f0; }
  .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; text-align: center; font-size: 12px; }
  .sign .role { font-weight: 700; } .sign .hint { color: #94a3b8; font-size: 10.5px; margin-top: 2px; }
  .sign .line { margin-top: 56px; border-top: 1px solid #cbd5e1; padding-top: 4px; color: #64748b; }
  .ft { margin-top: 28px; text-align: center; color: #94a3b8; font-size: 10px; border-top: 1px solid #f1f5f9; padding-top: 10px; }
  @media print { @page { size: A4; margin: 12mm; } .sheet { width: auto; padding: 0; } }
</style></head>
<body>
<div class="sheet">
  <div class="hd">
    <div><div class="co">${esc(COMPANY_NAME)}<div class="sub">Bảng kê chi tiết lương</div></div></div>
    <div class="doc-title"><h1>PHIẾU LƯƠNG</h1><div class="period">Kỳ lương: ${esc(periodName || "—")}</div></div>
  </div>

  <div class="meta">
    <div><span class="k">Họ và tên</span><span class="v">${esc(emp.name)}</span></div>
    <div><span class="k">Mã NV</span><span class="v">${esc(emp.code || "—")}</span></div>
    <div><span class="k">Phòng ban</span><span class="v">${esc(emp.dept || "—")}</span></div>
    <div><span class="k">Trạng thái</span><span class="v">${esc(STATUS_LABEL[p.status] ?? p.status)}</span></div>
    <div><span class="k">Ngày công</span><span class="v">${p.actualWorkDays} / ${p.standardWorkDays}</span></div>
    <div><span class="k">Lương chuẩn</span><span class="v">${money(p.baseSalary)}</span></div>
  </div>

  <div class="net-box"><span class="lbl">LƯƠNG THỰC NHẬN (NET)</span><span class="amt">${money(p.netSalary)}</span></div>

  <h2>Lương theo hiệu suất (20 / 60 / 20)</h2>
  <table>${groupRows}
    <tr class="tot"><td>Lương cấu thành theo hiệu suất</td><td></td><td class="r">${money(p.proRatedBaseSalary)}</td></tr>
  </table>

  ${segmentBlock}

  ${addons.length ? `<h2>Phụ cấp &amp; thưởng</h2><table>${addonRows}<tr class="tot"><td>Tổng thu nhập (Gross)</td><td class="r">${money(p.grossSalary)}</td></tr></table>` : ""}

  <h2>Khấu trừ</h2>
  <table>${dedRows}<tr class="tot"><td>Tổng khấu trừ</td><td class="r neg">−${money(p.totalDeductions)}</td></tr></table>

  <div class="sign">
    <div><div class="role">Người lao động</div><div class="hint">(Ký, ghi rõ họ tên)</div><div class="line">${esc(emp.name)}</div></div>
    <div><div class="role">Phòng Nhân sự</div><div class="hint">(Ký, ghi rõ họ tên)</div><div class="line">&nbsp;</div></div>
  </div>

  <div class="ft">Phiếu lương được tạo từ hệ thống ${esc(COMPANY_NAME)} — mang tính tham khảo nội bộ.</div>
</div>
</body></html>`;
}

/**
 * Open the payslip in an isolated window and trigger the browser print dialog,
 * where the user can choose "Save as PDF". No extra dependency, perfect
 * Vietnamese rendering. Returns false if the popup was blocked.
 */
export function printPayslip(p: PayrollRecord, emp: EmpInfo, periodName: string): boolean {
  const win = window.open("", "_blank", "width=900,height=1000");
  if (!win) return false;
  win.document.open();
  win.document.write(buildPayslipHtml(p, emp, periodName));
  win.document.close();
  win.focus();
  // Wait for fonts/layout before printing.
  win.onload = () => {
    win.print();
  };
  // Fallback if onload already fired (cached/empty resources).
  setTimeout(() => {
    try { win.print(); } catch { /* window may have been closed */ }
  }, 400);
  return true;
}
