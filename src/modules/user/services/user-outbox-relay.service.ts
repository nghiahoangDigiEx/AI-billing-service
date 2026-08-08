import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OutboxRepository } from '@/modules/event-outbox/providers/outbox.repository';
import {
  EVENT_PUBLISHER,
  type EventPublisher,
} from '@/modules/event-outbox/interfaces/event-publisher.interface';
import { AbstractOutboxRelay } from '@/modules/event-outbox/providers/abstract-outbox-relay';

@Injectable()
export class UserOutboxRelay extends AbstractOutboxRelay {
  protected readonly logger = new Logger(UserOutboxRelay.name);
  protected readonly tableName = 'UserOutbox';
  protected readonly modelName = 'userOutbox';

  constructor(
    repository: OutboxRepository,
    @Inject(EVENT_PUBLISHER) publisher: EventPublisher,
    configService: ConfigService,
  ) {
    super(repository, publisher, configService);
  }
}
