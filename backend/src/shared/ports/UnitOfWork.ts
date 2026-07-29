export interface UnitOfWork<Context> {
    run<T>(work: (ctx: Context) => Promise<T>): Promise<T>;
}
