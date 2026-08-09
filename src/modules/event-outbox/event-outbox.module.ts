import { Module } from '@nestjs/common';
import { EVENT_PUBLISHER } from './interfaces/event-publisher.interface';
import { InProcessPublisher } from './providers/in-process.publisher';
import { BillingOutboxRelay } from './providers/outbox-relay.service';
import { OutboxRepository } from './providers/outbox.repository';
import { BillingOutboxWriter } from './services/billing-outbox-writer.service';

@Module({
  providers: [
    OutboxRepository,
    BillingOutboxWriter,
    BillingOutboxRelay,
    {
      provide: EVENT_PUBLISHER,
      useClass: InProcessPublisher,
    },
  ],
  exports: [BillingOutboxWriter, BillingOutboxRelay, EVENT_PUBLISHER],
})
export class EventOutboxModule {}
