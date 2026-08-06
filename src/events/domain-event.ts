import { randomUUID } from 'node:crypto';

export interface DomainEventMetadata {
  providerEventId?: string;
  causationId?: string;
  correlationId?: string;
}

export interface DomainEvent<T = unknown> {
  id: string;
  type: string;
  version: number;
  occurredAt: Date;
  payload: T;
  metadata: DomainEventMetadata;
}

export interface CreateDomainEventOptions {
  id?: string;
  causationId?: string;
  correlationId?: string;
}

export function createDomainEvent<T>(
  type: string,
  payload: T,
  metadata: DomainEventMetadata = {},
  options: CreateDomainEventOptions = {},
): DomainEvent<T> {
  return {
    id: options.id ?? randomUUID(),
    type,
    version: 1,
    occurredAt: new Date(),
    payload,
    metadata,
  };
}
