import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { DomainEvent } from '@/events/domain-event';
import type { EventPublisher } from '../interfaces/event-publisher.interface';

@Injectable()
export class InProcessPublisher implements EventPublisher {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  async publish<T>(event: DomainEvent<T>): Promise<void> {
    await this.eventEmitter.emitAsync(event.type, event);
  }
}
