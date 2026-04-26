import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { config } from './config.js';
import { logger } from './logger.js';

export type AuditEvent = {
  ts: string;
  actor: string;
  action: string;
  target?: string;
  outcome: 'ok' | 'error';
  meta?: Record<string, unknown>;
};

const buffer: AuditEvent[] = [];
const BUFFER_MAX = 500;

let appending = false;
let pendingWrite: AuditEvent[] = [];

async function flush() {
  if (appending) return;
  if (!pendingWrite.length) return;
  if (!config.audit.file) {
    pendingWrite = [];
    return;
  }
  appending = true;
  const events = pendingWrite;
  pendingWrite = [];
  try {
    await mkdir(dirname(config.audit.file), { recursive: true });
    await appendFile(
      config.audit.file,
      `${events.map((e) => JSON.stringify(e)).join('\n')}\n`,
      'utf8',
    );
  } catch (e) {
    logger.warn({ err: (e as Error).message }, 'audit log file write failed');
  } finally {
    appending = false;
  }
  if (pendingWrite.length) void flush();
}

async function postWebhook(event: AuditEvent) {
  if (!config.audit.webhookUrl) return;
  try {
    await fetch(config.audit.webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(2_000),
    });
  } catch (e) {
    logger.warn({ err: (e as Error).message }, 'audit webhook failed');
  }
}

export function recordAudit(event: Omit<AuditEvent, 'ts'>): void {
  const full: AuditEvent = { ts: new Date().toISOString(), ...event };
  buffer.push(full);
  while (buffer.length > BUFFER_MAX) buffer.shift();
  if (config.audit.file) {
    pendingWrite.push(full);
    void flush();
  }
  if (config.audit.webhookUrl) void postWebhook(full);
  logger.info({ audit: full }, 'audit');
}

export function getRecentAudit(limit = 100): AuditEvent[] {
  return buffer.slice(-limit).reverse();
}
