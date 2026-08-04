export interface ParsedWebhookEvent {
  id: string;
  type: string;
  data: any;
  raw: any;
}

export interface WebhookStrategy {
  parseEvent(
    payload: Buffer | string,
    signature: string,
  ): ParsedWebhookEvent | Promise<ParsedWebhookEvent>;
  extractEventType(event: ParsedWebhookEvent): string;
}
