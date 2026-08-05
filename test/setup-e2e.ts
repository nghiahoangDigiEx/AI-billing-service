// Disable background cron jobs during E2E tests. Tests that need the outbox
// relay explicitly call outboxRelay.processPendingEvents().
process.env.OUTBOX_POLL_INTERVAL = '0 0 1 1 0';
