import { useEffect, useState } from "react";
import { Plus, Wallet, Gauge } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { fmtVND } from "@/shared/utils/money";
import { settingsService } from "@features/settings/services/settings.service";
import { SalaryPolicyDialog } from "@features/settings/components/SalaryPolicyDialog";
import { SettingsSection, CountBadge } from "@features/settings/components/SettingsSection";
import type { SalaryPolicy } from "@features/settings/types/settings.types";

interface Props {
  /** HR hoặc admin. */
  canManage: boolean;
  /** Chỉ admin/HR có `payroll:prepare` được tạo chính sách lương. */
  canManagePolicy: boolean;
}

function fmtDate(iso: string): string {
  return iso.slice(0, 10).split("-").reverse().join("/");
}

/**
 * Chính sách lương + trỏ sang bộ tiêu chí đánh giá.
 *
 * Chính sách lương là bản ghi CÓ HIỆU LỰC TỪ một ngày và KHÔNG sửa được: phiếu
 * lương đã tính giữ id chính sách đã dùng, sửa tại chỗ sẽ làm lịch sử lương tự
 * đổi nghĩa. Muốn đổi thì tạo bản mới với ngày hiệu lực mới.
 *
 * Bộ tiêu chí hiệu suất/mục tiêu KHÔNG ở đây: chúng thuộc module Đánh giá, có
 * phiên bản bất biến riêng (`/performance/criteria-sets`).
 */
export function SalaryPerformanceSettings({ canManage, canManagePolicy }: Props) {
  const [policies, setPolicies] = useState<SalaryPolicy[]>([]);
  const [rk, setRk] = useState(0);
  const [loading, setLoading] = useState(true);
  const [policyDlg, setPolicyDlg] = useState(false);

  useEffect(() => {
    let cancelled = false;
    settingsService.listPolicies()
      .then((rows) => { if (!cancelled) { setPolicies(rows); setLoading(false); } })
      .catch(() => { if (!cancelled) { setPolicies([]); setLoading(false); } });
    return () => { cancelled = true; };
  }, [rk]);

  // Backend trả danh sách theo ngày hiệu lực giảm dần; bản đầu là bản đang dùng.
  const latest = policies[0];
  const reload = () => setRk((k) => k + 1);

  return (
    <div className="flex flex-col gap-6">
      <SettingsSection
        icon={Wallet}
        tone="cyan"
        title="Chính sách lương"
        description="Mỗi chính sách có hiệu lực từ một ngày. Không sửa bản cũ — tạo bản mới để lịch sử lương giữ nguyên."
        badge={!loading && <CountBadge tone="cyan">{policies.length}</CountBadge>}
        action={canManagePolicy && (
          <Button variant="outline" size="sm" onClick={() => setPolicyDlg(true)} className="h-8 gap-1.5 rounded-lg text-[12.5px]">
            <Plus className="size-3.5" /> Tạo chính sách mới
          </Button>
        )}
      >
        {loading ? (
          <div className="h-20 animate-pulse rounded-xl bg-muted/50" />
        ) : policies.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">
            Chưa có chính sách lương — payroll sẽ không tính được.{" "}
            {canManagePolicy ? "Bấm “Tạo chính sách mới”." : "Liên hệ quản trị viên."}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {policies.map((policy) => (
              <div key={policy._id} className="flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-xl border px-4 py-3 text-[13px]">
                <span className="font-semibold text-foreground">Từ {fmtDate(policy.effectiveFrom)}</span>
                {policy._id === latest?._id && <CountBadge tone="emerald">Đang dùng</CountBadge>}
                <span className="text-muted-foreground">Lương tham chiếu <b className="text-foreground">{fmtVND(policy.baseSalaryReference)}₫</b></span>
                <span className="text-muted-foreground">Nền BHXH <b className="text-foreground">{fmtVND(policy.socialInsuranceSalary)}₫</b></span>
                <span className="text-muted-foreground">Thử việc <b className="text-foreground">{policy.probationPayRate}%</b></span>
                <span className={policy.taxEnabled ? "text-emerald-600" : "text-amber-600"}>
                  {policy.taxEnabled ? "Có tính thuế TNCN" : "Tắt thuế TNCN"}
                </span>
                {policy.unionFeeEnabled && <span className="text-muted-foreground">Đoàn phí {policy.unionFeeRate}%</span>}
              </div>
            ))}
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        icon={Gauge}
        tone="violet"
        title="Bộ tiêu chí đánh giá"
        description="Tiêu chí hiệu suất/mục tiêu thuộc module Đánh giá, có phiên bản bất biến riêng để lịch sử đánh giá không tự đổi nghĩa."
      >
        <p className="text-[13px] text-muted-foreground">
          Quản lý tại trang <Link to="/performance" className="font-medium text-primary-600 underline-offset-2 hover:underline">Đánh giá</Link>
          {canManage ? " — tạo bộ tiêu chí, phát hành phiên bản, rồi gắn vào chu kỳ đánh giá của kỳ lương." : "."}
        </p>
      </SettingsSection>

      {policyDlg && (
        <SalaryPolicyDialog open onOpenChange={setPolicyDlg} previous={latest ?? null} onSaved={reload} />
      )}
    </div>
  );
}
