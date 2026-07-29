export default abstract class DomainEvent<EventPayloadType extends Record<string, unknown> = Record<string, unknown>> {
    protected constructor(
        public readonly type: string,
        public readonly occurredAt: Date,
        public readonly payload: EventPayloadType
    ) {}
}
