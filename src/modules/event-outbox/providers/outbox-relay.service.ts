import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OutboxRepository } from './outbox.repository';
import {
  EVENT_PUBLISHER,
  type EventPublisher,
} from '../interfaces/event-publisher.interface';
import { Inject } from '@nestjs/common';
import { AbstractOutboxRelay } from './abstract-outbox-relay';

@Injectable()
export class BillingOutboxRelay extends AbstractOutboxRelay {
  protected readonly logger = new Logger(BillingOutboxRelay.name);
  protected readonly tableName = 'BillingOutbox';
  protected readonly modelName = 'billingOutbox';

  constructor(
    repository: OutboxRepository,
    @Inject(EVENT_PUBLISHER) publisher: EventPublisher,
    configService: ConfigService,
  ) {
    super(repository, publisher, configService);
  }
}
