import { Module } from '@nestjs/common';
import { EVENT_PUBLISHER } from './interfaces/event-publisher.interface';
import { InProcessPublisher } from './providers/in-process.publisher';
import { OutboxRelay } from './providers/outbox-relay.service';
import { BillingOutboxWriter } from './services/billing-outbox-writer.service';

@Module({
  providers: [
    BillingOutboxWriter,
    OutboxRelay,
    {
      provide: EVENT_PUBLISHER,
      useClass: InProcessPublisher,
    },
  ],
  exports: [BillingOutboxWriter, OutboxRelay, EVENT_PUBLISHER],
})
export class EventOutboxModule {}
