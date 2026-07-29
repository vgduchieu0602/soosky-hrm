import DomainEvent from "@shared/core/domain/DomainEvent";
import EventBus from "@shared/core/domain/EventBus";

type EventHandler = (event: DomainEvent) => Promise<void>;

/**
 * EventBus chạy trong cùng tiến trình, đủ dùng cho modular monolith:
 * handler được gọi tuần tự, ngay trong lời gọi `publish`.
 *
 * Khi tách module ra service riêng thì thay bằng adapter cho message broker
 * thật (RabbitMQ, Kafka...) — các bên publish/subscribe không phải đổi gì.
 */
export default class InProcessEventBus implements EventBus {
    private readonly _handlers = new Map<string, EventHandler[]>();

    async publish(events: DomainEvent[]): Promise<void> {
        for (const event of events) {
            const handlers = this._handlers.get(event.type) ?? [];
            for (const handler of handlers) {
                await handler(event);
            }
        }
    }

    subscribe(type: string, handler: EventHandler): void {
        const handlers = this._handlers.get(type) ?? [];
        handlers.push(handler);
        this._handlers.set(type, handlers);
    }
}
