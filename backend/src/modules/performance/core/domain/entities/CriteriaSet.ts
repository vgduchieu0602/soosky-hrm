import CriteriaSetInvalidError from "@modules/performance/core/domain/errors/CriteriaSetInvalidError";
import CriterionKind from "@modules/performance/core/domain/value-objects/CriterionKind";
import AggregateRoot from "@shared/core/domain/AggregateRoot";

const NAME_MAX_LENGTH = 120;
const WEIGHT_SUM_TOLERANCE = 0.01;

/** Một tiêu chí trong một phiên bản bộ tiêu chí. Bất biến cùng phiên bản. */
export interface Criterion {
    id:     string;
    code:   string;
    name:   string;
    kind:   CriterionKind;
    /** Trọng số trong NHÓM của nó (%), tổng mỗi nhóm phải bằng 100. */
    weight: number;
}

/**
 * Một PHIÊN BẢN của bộ tiêu chí — bất biến sau khi phát hành.
 *
 * Vì sao bất biến: phiếu đánh giá tham chiếu tới đúng phiên bản đã dùng để
 * chấm. Nếu sửa được tiêu chí tại chỗ thì điểm cũ sẽ được diễn giải theo bộ
 * tiêu chí mới — lịch sử đánh giá tự đổi nghĩa mà không ai biết. Muốn đổi tiêu
 * chí thì phát hành phiên bản mới.
 */
export interface CriteriaVersion {
    version:     number;
    criteria:    Criterion[];
    publishedAt: Date;
    publishedBy: string;
}

export interface CriteriaSetProps {
    id:          string;
    name:        string;
    description: string | null;
    versions:    CriteriaVersion[];
    createdBy:   string;
    createdAt:   Date;
}

export type CriteriaSetCreationInput = Omit<CriteriaSetProps, "versions" | "createdAt">;

export interface PublishCriteriaVersionInput {
    criteria:    Omit<Criterion, "id">[];
    publishedBy: string;
    /** Sinh id cho từng tiêu chí — do use-case cấp (domain không tự sinh UUID). */
    newCriterionId: () => string;
}

/**
 * Bộ tiêu chí đánh giá, giữ TOÀN BỘ các phiên bản đã phát hành trong cùng một
 * aggregate.
 *
 * Vì sao một aggregate thay vì hai: phiên bản không có vòng đời riêng — nó chỉ
 * tồn tại bên trong một bộ tiêu chí, luôn được đọc cùng bộ, và bất biến. Tách
 * ra chỉ thêm một repo và nguy cơ hai bên lệch nhau.
 */
export default class CriteriaSet extends AggregateRoot<string> {
    private constructor(
        public readonly id: string,
        public readonly createdBy: string,
        public readonly createdAt: Date,
        private _name: string,
        private _description: string | null,
        private _versions: CriteriaVersion[],
    ) {
        super();
    }

    get name(): string { return this._name; }
    get description(): string | null { return this._description; }
    /** Chỉ đọc: phiên bản đã phát hành không sửa được, chỉ thêm phiên bản mới. */
    get versions(): readonly CriteriaVersion[] { return this._versions.map(v => ({ ...v, criteria: v.criteria.map(c => ({ ...c })) })); }

    get latestVersion(): CriteriaVersion | undefined {
        return this._versions.length === 0 ? undefined : { ...this._versions[this._versions.length - 1] as CriteriaVersion };
    }

    static create(input: CriteriaSetCreationInput): CriteriaSet {
        return CriteriaSet.rehydrate({ ...input, versions: [], createdAt: new Date() });
    }

    static rehydrate(props: CriteriaSetProps): CriteriaSet {
        const name = props.name.trim();
        if (name.length === 0) throw new CriteriaSetInvalidError("Criteria set name must not be empty");
        if (name.length > NAME_MAX_LENGTH) {
            throw new CriteriaSetInvalidError(`Criteria set name must be at most ${NAME_MAX_LENGTH} characters`);
        }

        return new CriteriaSet(props.id, props.createdBy, props.createdAt, name, props.description, props.versions);
    }

    rename(name: string): void {
        const trimmed = name.trim();
        if (trimmed.length === 0) throw new CriteriaSetInvalidError("Criteria set name must not be empty");
        this._name = trimmed;
    }

    changeDescription(description: string | null): void {
        this._description = description;
    }

    getVersion(version: number): CriteriaVersion | undefined {
        const found = this._versions.find(v => v.version === version);
        return found == undefined ? undefined : { ...found, criteria: found.criteria.map(c => ({ ...c })) };
    }

    /**
     * Phát hành một phiên bản mới. Số phiên bản tự tăng — không nhận từ ngoài để
     * không bao giờ có hai phiên bản cùng số.
     *
     * @throws {CriteriaSetInvalidError} Danh sách rỗng, mã tiêu chí trùng, hoặc
     *         tổng trọng số của một nhóm khác 100.
     */
    publishVersion(input: PublishCriteriaVersionInput): CriteriaVersion {
        if (input.criteria.length === 0) {
            throw new CriteriaSetInvalidError("A criteria version must contain at least one criterion");
        }

        const codes = new Set<string>();
        for (const criterion of input.criteria) {
            const code = criterion.code.trim();
            if (code.length === 0) throw new CriteriaSetInvalidError("Criterion code must not be empty");
            if (criterion.name.trim().length === 0) throw new CriteriaSetInvalidError(`Criterion "${code}" must have a name`);
            if (!Number.isFinite(criterion.weight) || criterion.weight <= 0) {
                throw new CriteriaSetInvalidError(`Criterion "${code}" weight must be greater than 0`);
            }
            if (codes.has(code)) throw new CriteriaSetInvalidError(`Duplicated criterion code: ${code}`);
            codes.add(code);
        }

        // Trọng số theo NHÓM phải đủ 100: điểm mỗi nhóm là bình quân gia quyền
        // trong nhóm đó, nên tổng khác 100 sẽ cho ra điểm không nằm trên thang
        // 0..100 và bảng lương nhận số vô nghĩa.
        this._assertWeightsPerKind(input.criteria);

        const version: CriteriaVersion = {
            version:     this._versions.length + 1,
            criteria:    input.criteria.map(criterion => ({
                id:     input.newCriterionId(),
                code:   criterion.code.trim(),
                name:   criterion.name.trim(),
                kind:   criterion.kind,
                weight: criterion.weight,
            })),
            publishedAt: new Date(),
            publishedBy: input.publishedBy,
        };

        this._versions.push(version);
        return { ...version, criteria: version.criteria.map(c => ({ ...c })) };
    }

    private _assertWeightsPerKind(criteria: Omit<Criterion, "id">[]): void {
        const sumByKind = new Map<string, number>();
        for (const criterion of criteria) {
            sumByKind.set(criterion.kind.value, (sumByKind.get(criterion.kind.value) ?? 0) + criterion.weight);
        }

        for (const [kind, sum] of sumByKind) {
            if (Math.abs(sum - 100) > WEIGHT_SUM_TOLERANCE) {
                throw new CriteriaSetInvalidError(`Weights of kind "${kind}" must sum to 100, got ${sum}`);
            }
        }
    }
}
