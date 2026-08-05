import type { DomainEvent } from '@/events/domain-event';

export const EVENT_PUBLISHER = Symbol('EVENT_PUBLISHER');

export interface EventPublisher {
  publish<T>(event: DomainEvent<T>): Promise<void>;
}
