import DomainEvent from "./DomainEvent";

export default interface EventBus {
    publish(events: DomainEvent[]): Promise<void>;
    subscribe(type: string, handler: (event: DomainEvent) => Promise<void>): void;
}
