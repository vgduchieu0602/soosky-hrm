import DomainEvent from "@shared/core/domain/DomainEvent";

export default interface DomainEventHandler {
    eventType: string;
    handle(event: DomainEvent): Promise<void>;
}
