import Entity from "@shared/core/domain/Entity";

export default abstract class AggregateRoot<TId, TChange = undefined> extends Entity<TId> {

    private _changes: TChange[] = [];

    protected recordChange(change: TChange): void {
        this._changes.push(change);
    }

    pullChanges(): TChange[] {
        return this._changes.splice(0);
    }
}
