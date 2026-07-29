export default abstract class ApplicationError extends Error {
    abstract readonly code:       string;
    abstract readonly httpStatus: number;

    constructor(message: string) {
        super(message);
        this.name = new.target.name;
    }
}
