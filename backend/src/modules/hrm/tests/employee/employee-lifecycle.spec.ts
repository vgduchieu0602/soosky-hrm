/**
 * Quy tắc thuần của vòng đời nhân viên — không DB, không HTTP. Đây là nơi khoá
 * những luật dễ bị phá khi sửa use-case sau này: ngày hiệu lực, vòng lặp quản lý,
 * và "không có thay đổi nào" thì không được ghi lịch sử.
 */
import {
  MOVEMENT_EVENT,
  SEPARATION_EVENT,
  changesToHistoryValues,
  checkEffectiveDate,
  collectMovementChanges,
  isSeparated,
  sameRef,
  statusAfterProbationCompleted,
  wouldCreateManagerCycle,
} from '@modules/hrm/core/employee/domain/employee-lifecycle';

const NOW = new Date('2026-08-08T00:00:00.000Z');

describe('checkEffectiveDate', () => {
  it('chấp nhận ngày trong quá khứ gần (HR nhập bù)', () => {
    expect(checkEffectiveDate(new Date('2026-06-15'), NOW).ok).toBe(true);
  });

  it('chấp nhận ngày tương lai (quyết định đã ký, hiệu lực sau)', () => {
    expect(checkEffectiveDate(new Date('2026-09-01'), NOW).ok).toBe(true);
  });

  it('chặn ngày lệch quá 2 năm', () => {
    const far = checkEffectiveDate(new Date('2030-01-01'), NOW);
    expect(far.ok).toBe(false);
    expect(far.reason).toContain('2 năm');
  });

  it('chặn ngày trước ngày vào làm — lịch sử khi đó không giải thích được', () => {
    const before = checkEffectiveDate(new Date('2026-01-01'), NOW, new Date('2026-03-01'));
    expect(before.ok).toBe(false);
    expect(before.reason).toContain('trước ngày vào làm');
  });

  it('cho phép đúng ngày vào làm', () => {
    expect(checkEffectiveDate(new Date('2026-03-01'), NOW, new Date('2026-03-01')).ok).toBe(true);
  });

  it('từ chối ngày không hợp lệ', () => {
    expect(checkEffectiveDate(new Date('không-phải-ngày'), NOW).ok).toBe(false);
  });
});

describe('wouldCreateManagerCycle', () => {
  it('không cho tự quản lý chính mình', () => {
    expect(wouldCreateManagerCycle('emp-1', 'emp-1', ['emp-1'])).toBe(true);
  });

  it('chặn vòng lặp gián tiếp: A quản lý B, gán B làm quản lý của A', () => {
    // Chuỗi đi lên từ B: B → A.
    expect(wouldCreateManagerCycle('emp-A', 'emp-B', ['emp-B', 'emp-A'])).toBe(true);
  });

  it('cho phép khi chuỗi quản lý không chứa nhân viên', () => {
    expect(wouldCreateManagerCycle('emp-C', 'emp-B', ['emp-B', 'emp-A'])).toBe(false);
  });
});

describe('collectMovementChanges', () => {
  const current = { departmentId: 'dept-1', positionId: 'pos-1', managerId: 'emp-9' };

  it('chỉ lấy trường thực sự đổi', () => {
    const changes = collectMovementChanges(current, { departmentId: 'dept-2', positionId: 'pos-1' });
    expect(changes).toEqual([{ field: 'departmentId', from: 'dept-1', to: 'dept-2' }]);
  });

  it('bỏ qua trường không gửi lên (undefined)', () => {
    expect(collectMovementChanges(current, {})).toEqual([]);
  });

  it('gỡ quản lý (null) là một thay đổi hợp lệ', () => {
    expect(collectMovementChanges(current, { managerId: null })).toEqual([
      { field: 'managerId', from: 'emp-9', to: null },
    ]);
  });

  it('trả rỗng khi không đổi gì — use-case dựa vào đây để chặn bản ghi lịch sử vô nghĩa', () => {
    expect(collectMovementChanges(current, { departmentId: 'dept-1', managerId: 'emp-9' })).toEqual([]);
  });

  it('so sánh tham chiếu không phân biệt kiểu ObjectId/chuỗi', () => {
    expect(sameRef({ toString: () => 'dept-1' }, 'dept-1')).toBe(true);
    expect(sameRef(null, undefined)).toBe(true);
    expect(sameRef('', null)).toBe(true);
  });
});

describe('changesToHistoryValues', () => {
  it('tách thành fromValue/toValue đúng khoá', () => {
    const { fromValue, toValue } = changesToHistoryValues([
      { field: 'departmentId', from: 'dept-1', to: 'dept-2' },
      { field: 'managerId', from: null, to: 'emp-3' },
    ]);
    expect(fromValue).toEqual({ departmentId: 'dept-1', managerId: null });
    expect(toValue).toEqual({ departmentId: 'dept-2', managerId: 'emp-3' });
  });
});

describe('ánh xạ sự kiện', () => {
  it('điều chuyển phòng ban dùng lại eventType `transfer` cũ', () => {
    expect(MOVEMENT_EVENT.department_transfer).toBe('transfer');
    expect(MOVEMENT_EVENT.promotion).toBe('promotion');
    expect(MOVEMENT_EVENT.position_change).toBe('position_change');
    expect(MOVEMENT_EVENT.manager_change).toBe('manager_change');
  });

  it('nghỉ việc phân biệt được nguyện vọng và chấm dứt', () => {
    expect(SEPARATION_EVENT.resignation).toBe('resigned');
    expect(SEPARATION_EVENT.termination).toBe('terminated');
  });
});

describe('trạng thái sau thử việc', () => {
  it('onboarding → active', () => {
    expect(statusAfterProbationCompleted('onboarding')).toBe('active');
  });

  it('không hồi sinh người đã nghỉ', () => {
    expect(statusAfterProbationCompleted('terminated')).toBe('terminated');
  });

  it('giữ nguyên trạng thái khác', () => {
    expect(statusAfterProbationCompleted('on_leave')).toBe('on_leave');
  });

  it('isSeparated chỉ đúng với terminated', () => {
    expect(isSeparated('terminated')).toBe(true);
    expect(isSeparated('active')).toBe(false);
  });
});
