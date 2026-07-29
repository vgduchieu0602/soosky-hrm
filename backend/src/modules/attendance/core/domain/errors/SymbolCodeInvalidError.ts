import DomainError from "@shared/core/domain/DomainError";

export default class SymbolCodeInvalidError extends DomainError {
    readonly code       = "SYMBOL_CODE_INVALID";
    readonly httpStatus = 422;

    constructor(reason: string) {
        super(reason);
    }
}
