export default abstract class Entity<TId = string> {

    public abstract readonly id: TId;

    equals(other: Entity<TId>): boolean {
        return this.id === other.id;
    }
}
