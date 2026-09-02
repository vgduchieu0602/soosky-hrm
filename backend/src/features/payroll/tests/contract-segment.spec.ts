/**
 * Chia kỳ lương thành đoạn theo hợp đồng — hàm thuần, không DB.
 *
 * Điều được khoá: ngày biên không đếm hai lần; hợp đồng đã hết hiệu lực vẫn dùng
 * được cho đoạn quá khứ; chồng ngày thì BÁO LỖI chứ không tự chọn; khoảng trống
 * kẹp giữa hai hợp đồng thì lộ ra để tầng trên quyết định.
 */
import {
  buildContractSegments,
  dayLabel,
  effectivePayrollRange,
  describeGap,
  describeOverlap,
  type ContractInput,
} from '@features/payroll/domain/contract-segment';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const AUGUST = { startDate: d('2026-08-01'), endDate: d('2026-08-31') };

function contract(over: Partial<ContractInput> & { contractId: string }): ContractInput {
  return {
    startDate: d('2026-08-01'),
    endDate: null,
    employmentStatus: 'official',
    baseSalary: 10_000_000,
    ...over,
  };
}

describe('một hợp đồng phủ cả kỳ', () => {
  it('cho đúng một đoạn trùng khít kỳ — hành vi cũ giữ nguyên', () => {
    const { segments, overlaps, gaps } = buildContractSegments(
      [contract({ contractId: 'A', startDate: d('2026-01-01'), endDate: null })],
      AUGUST,
    );

    expect(segments).toHaveLength(1);
    expect(dayLabel(segments[0]!.from)).toBe('2026-08-01');
    expect(dayLabel(segments[0]!.to)).toBe('2026-08-31');
    expect(overlaps).toEqual([]);
    expect(gaps).toEqual([]);
  });

  it('hợp đồng không thời hạn được kẹp về ngày cuối kỳ', () => {
    const { segments } = buildContractSegments(
      [contract({ contractId: 'A', startDate: d('2026-08-11'), endDate: null })],
      AUGUST,
    );

    expect(dayLabel(segments[0]!.from)).toBe('2026-08-11');
    expect(dayLabel(segments[0]!.to)).toBe('2026-08-31');
  });

  it('hợp đồng bắt đầu trước kỳ được kẹp về ngày đầu kỳ', () => {
    const { segments } = buildContractSegments(
      [contract({ contractId: 'A', startDate: d('2025-03-01'), endDate: d('2026-12-31') })],
      AUGUST,
    );

    expect(dayLabel(segments[0]!.from)).toBe('2026-08-01');
    expect(dayLabel(segments[0]!.to)).toBe('2026-08-31');
  });
});

describe('chuyển hợp đồng giữa kỳ', () => {
  it('thử việc → chính thức cho hai đoạn, không đếm trùng ngày biên', () => {
    const { segments, overlaps, gaps } = buildContractSegments(
      [
        contract({ contractId: 'A', startDate: d('2026-01-01'), endDate: d('2026-08-10'), employmentStatus: 'probation', baseSalary: 10_000_000 }),
        contract({ contractId: 'B', startDate: d('2026-08-11'), endDate: null, baseSalary: 15_000_000 }),
      ],
      AUGUST,
    );

    expect(overlaps).toEqual([]);
    expect(gaps).toEqual([]);
    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({ contractId: 'A', employmentStatus: 'probation', baseSalary: 10_000_000 });
    expect(dayLabel(segments[0]!.from)).toBe('2026-08-01');
    expect(dayLabel(segments[0]!.to)).toBe('2026-08-10');
    expect(segments[1]).toMatchObject({ contractId: 'B', employmentStatus: 'official', baseSalary: 15_000_000 });
    expect(dayLabel(segments[1]!.from)).toBe('2026-08-11');
    expect(dayLabel(segments[1]!.to)).toBe('2026-08-31');
  });

  it('đổi mức lương giữa kỳ (cùng chính thức) vẫn ra hai mức lương khác nhau', () => {
    const { segments } = buildContractSegments(
      [
        contract({ contractId: 'A', endDate: d('2026-08-10'), baseSalary: 10_000_000 }),
        contract({ contractId: 'B', startDate: d('2026-08-11'), baseSalary: 15_000_000 }),
      ],
      AUGUST,
    );

    expect(segments.map((s) => s.baseSalary)).toEqual([10_000_000, 15_000_000]);
  });

  it('KHÔNG phụ thuộc `status`: hợp đồng đã hết hiệu lực vẫn tạo đoạn quá khứ', () => {
    // `status` không có trong đầu vào — chỉ ngày hiệu lực quyết định.
    const { segments } = buildContractSegments(
      [
        contract({ contractId: 'expired-A', endDate: d('2026-08-10') }),
        contract({ contractId: 'active-B', startDate: d('2026-08-11') }),
      ],
      AUGUST,
    );

    expect(segments.map((s) => s.contractId)).toEqual(['expired-A', 'active-B']);
  });

  it('tự sắp xếp theo ngày bắt đầu dù đầu vào lộn xộn', () => {
    const { segments, overlaps } = buildContractSegments(
      [
        contract({ contractId: 'B', startDate: d('2026-08-11') }),
        contract({ contractId: 'A', endDate: d('2026-08-10') }),
      ],
      AUGUST,
    );

    expect(segments.map((s) => s.contractId)).toEqual(['A', 'B']);
    expect(overlaps).toEqual([]);
  });
});

describe('phát hiện chồng ngày', () => {
  it('A 01–15 và B 10–31 → báo chồng, không tự chọn hợp đồng nào', () => {
    const { overlaps } = buildContractSegments(
      [
        contract({ contractId: 'A', endDate: d('2026-08-15') }),
        contract({ contractId: 'B', startDate: d('2026-08-10') }),
      ],
      AUGUST,
    );

    expect(overlaps).toHaveLength(1);
    expect(dayLabel(overlaps[0]!.range.from)).toBe('2026-08-10');
    expect(dayLabel(overlaps[0]!.range.to)).toBe('2026-08-15');
    const message = describeOverlap(overlaps[0]!);
    expect(message).toContain('A');
    expect(message).toContain('B');
  });

  it('trùng đúng một ngày cũng là chồng', () => {
    const { overlaps } = buildContractSegments(
      [
        contract({ contractId: 'A', endDate: d('2026-08-10') }),
        contract({ contractId: 'B', startDate: d('2026-08-10') }),
      ],
      AUGUST,
    );

    expect(overlaps).toHaveLength(1);
  });
});

describe('phát hiện khoảng trống', () => {
  it('A hết 10, B bắt đầu 15 → lộ khoảng 11–14', () => {
    const { gaps } = buildContractSegments(
      [
        contract({ contractId: 'A', endDate: d('2026-08-10') }),
        contract({ contractId: 'B', startDate: d('2026-08-15') }),
      ],
      AUGUST,
    );

    expect(gaps).toHaveLength(1);
    expect(dayLabel(gaps[0]!.from)).toBe('2026-08-11');
    expect(dayLabel(gaps[0]!.to)).toBe('2026-08-14');
    expect(describeGap(gaps[0]!)).toContain('2026-08-11');
  });

  it('hai hợp đồng liền kề (10 → 11) không sinh khoảng trống', () => {
    const { gaps, overlaps } = buildContractSegments(
      [
        contract({ contractId: 'A', endDate: d('2026-08-10') }),
        contract({ contractId: 'B', startDate: d('2026-08-11') }),
      ],
      AUGUST,
    );

    expect(gaps).toEqual([]);
    expect(overlaps).toEqual([]);
  });

  it('hợp đồng bắt đầu muộn hơn phạm vi → lộ khoảng trống ĐẦU', () => {
    // Người vào làm giữa kỳ KHÔNG rơi vào đây: phạm vi truyền vào đã được kẹp
    // theo ngày vào làm (xem `effectivePayrollRange`).
    const { gaps, segments } = buildContractSegments(
      [contract({ contractId: 'A', startDate: d('2026-08-11') })],
      AUGUST,
    );

    expect(gaps).toHaveLength(1);
    expect(dayLabel(gaps[0]!.from)).toBe('2026-08-01');
    expect(dayLabel(gaps[0]!.to)).toBe('2026-08-10');
    expect(dayLabel(segments[0]!.from)).toBe('2026-08-11');
  });

  it('hợp đồng kết thúc sớm hơn phạm vi → lộ khoảng trống CUỐI', () => {
    const { gaps, segments } = buildContractSegments(
      [contract({ contractId: 'A', endDate: d('2026-08-20') })],
      AUGUST,
    );

    expect(gaps).toHaveLength(1);
    expect(dayLabel(gaps[0]!.from)).toBe('2026-08-21');
    expect(dayLabel(gaps[0]!.to)).toBe('2026-08-31');
    expect(dayLabel(segments[0]!.to)).toBe('2026-08-20');
  });
});

describe('phạm vi thuộc bảng lương', () => {
  const employment = (from: string, to?: string) => ({ from: d(from), to: to ? d(to) : null });

  it('vào làm giữa kỳ → phạm vi bắt đầu từ ngày vào làm', () => {
    expect(effectivePayrollRange(AUGUST, employment('2026-08-15'))).toEqual({
      startDate: d('2026-08-15'),
      endDate: d('2026-08-31'),
    });
  });

  it('nghỉ giữa kỳ → phạm vi kết thúc ở ngày nghỉ', () => {
    expect(effectivePayrollRange(AUGUST, employment('2020-01-01', '2026-08-20'))).toEqual({
      startDate: d('2026-08-01'),
      endDate: d('2026-08-20'),
    });
  });

  it('làm cả kỳ → phạm vi đúng bằng kỳ', () => {
    expect(effectivePayrollRange(AUGUST, employment('2020-01-01'))).toEqual({
      startDate: d('2026-08-01'),
      endDate: d('2026-08-31'),
    });
  });

  it('vào làm sau kỳ → không thuộc kỳ', () => {
    expect(effectivePayrollRange(AUGUST, employment('2026-09-01'))).toBeNull();
  });

  it('nghỉ trước kỳ → không thuộc kỳ', () => {
    expect(effectivePayrollRange(AUGUST, employment('2020-01-01', '2026-07-31'))).toBeNull();
  });

  it('vào làm đúng ngày cuối kỳ vẫn thuộc kỳ (một ngày)', () => {
    expect(effectivePayrollRange(AUGUST, employment('2026-08-31'))).toEqual({
      startDate: d('2026-08-31'),
      endDate: d('2026-08-31'),
    });
  });

  it('người vào làm giữa kỳ, hợp đồng khớp ngày vào làm → KHÔNG có khoảng trống', () => {
    const scope = effectivePayrollRange(AUGUST, employment('2026-08-15'))!;
    const { gaps, segments } = buildContractSegments(
      [contract({ contractId: 'A', startDate: d('2026-08-15'), endDate: null })],
      scope,
    );

    expect(gaps).toEqual([]);
    expect(dayLabel(segments[0]!.from)).toBe('2026-08-15');
    expect(dayLabel(segments[0]!.to)).toBe('2026-08-31');
  });

  it('người nghỉ giữa kỳ, hợp đồng khớp ngày nghỉ → KHÔNG có khoảng trống', () => {
    const scope = effectivePayrollRange(AUGUST, employment('2020-01-01', '2026-08-20'))!;
    const { gaps } = buildContractSegments(
      [contract({ contractId: 'A', endDate: d('2026-08-20') })],
      scope,
    );

    expect(gaps).toEqual([]);
  });
});

describe('trường hợp biên', () => {
  it('không có hợp đồng nào → không đoạn, không lỗi (tầng trên quyết định)', () => {
    expect(buildContractSegments([], AUGUST)).toEqual({ segments: [], overlaps: [], gaps: [] });
  });

  it('hợp đồng nằm hoàn toàn ngoài kỳ bị bỏ qua', () => {
    const { segments } = buildContractSegments(
      [contract({ contractId: 'old', startDate: d('2026-01-01'), endDate: d('2026-07-31') })],
      AUGUST,
    );

    expect(segments).toEqual([]);
  });

  it('bỏ qua phần giờ, chỉ so theo ngày', () => {
    const { segments, overlaps } = buildContractSegments(
      [
        { contractId: 'A', startDate: new Date('2026-08-01T09:30:00.000Z'), endDate: new Date('2026-08-10T18:00:00.000Z'), employmentStatus: 'probation', baseSalary: 1 },
        { contractId: 'B', startDate: new Date('2026-08-11T07:15:00.000Z'), endDate: null, employmentStatus: 'official', baseSalary: 2 },
      ],
      AUGUST,
    );

    expect(overlaps).toEqual([]);
    expect(dayLabel(segments[0]!.to)).toBe('2026-08-10');
    expect(dayLabel(segments[1]!.from)).toBe('2026-08-11');
  });
});
