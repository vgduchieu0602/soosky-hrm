import EmployeeSubResourceInvalidError from "@modules/employee/core/domain/errors/EmployeeSubResourceInvalidError";
import AggregateRoot from "@shared/core/domain/AggregateRoot";

export const ASSET_CONDITIONS = ["new", "good", "fair", "damaged"] as const;
export type AssetCondition = (typeof ASSET_CONDITIONS)[number];

export interface EmployeeAssetProps {
    id:           string;
    employeeId:   string;
    assetName:    string;
    assetCode:    string;
    assignedDate: Date;
    returnedDate: Date | null;
    condition:    AssetCondition;
    note:         string | null;
    createdAt:    Date;
}

/** Tài sản công ty cấp phát cho nhân viên — nhiều bản ghi trên một nhân viên. */
export default class EmployeeAsset extends AggregateRoot<string> {
    private constructor(
        public readonly id: string,
        public readonly employeeId: string,
        public readonly createdAt: Date,
        private _assetName: string,
        private _assetCode: string,
        private _assignedDate: Date,
        private _returnedDate: Date | null,
        private _condition: AssetCondition,
        private _note: string | null,
    ) {
        super();
    }

    get assetName(): string { return this._assetName; }
    get assetCode(): string { return this._assetCode; }
    get assignedDate(): Date { return this._assignedDate; }
    get returnedDate(): Date | null { return this._returnedDate; }
    get condition(): AssetCondition { return this._condition; }
    get note(): string | null { return this._note; }

    static create(props: Omit<EmployeeAssetProps, "createdAt">): EmployeeAsset {
        return EmployeeAsset.rehydrate({ ...props, createdAt: new Date() });
    }

    static rehydrate(props: EmployeeAssetProps): EmployeeAsset {
        if (props.assetName.trim().length === 0) {
            throw new EmployeeSubResourceInvalidError("Asset name must not be empty");
        }
        if (props.assetCode.trim().length === 0) {
            throw new EmployeeSubResourceInvalidError("Asset code must not be empty");
        }
        if (!ASSET_CONDITIONS.includes(props.condition)) {
            throw new EmployeeSubResourceInvalidError(`Invalid asset condition: ${props.condition}`);
        }
        return new EmployeeAsset(
            props.id, props.employeeId, props.createdAt,
            props.assetName.trim(), props.assetCode.trim(), props.assignedDate, props.returnedDate, props.condition, props.note,
        );
    }

    update(patch: { returnedDate?: Date | null | undefined; condition?: AssetCondition | undefined; note?: string | null | undefined; }): void {
        if (patch.returnedDate !== undefined) this._returnedDate = patch.returnedDate;
        if (patch.condition != undefined) {
            if (!ASSET_CONDITIONS.includes(patch.condition)) throw new EmployeeSubResourceInvalidError(`Invalid asset condition: ${patch.condition}`);
            this._condition = patch.condition;
        }
        if (patch.note !== undefined) this._note = patch.note;
    }
}
