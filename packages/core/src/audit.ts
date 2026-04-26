import { createHash, createHmac } from 'node:crypto';
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
  /** 직전 이벤트의 hash 와 본 이벤트 직렬화의 SHA-256 체인. 변조 감지용. */
  hash?: string;
  prevHash?: string;
  /** webhookSecret 설정 시 본 이벤트의 HMAC-SHA256. */
  signature?: string;
};

const GENESIS = '0'.repeat(64);
let lastHash = GENESIS;

function hashEvent(
  prev: string,
  event: Omit<AuditEvent, 'hash' | 'prevHash' | 'signature'>,
): string {
  const canonical = JSON.stringify({
    prev,
    ts: event.ts,
    actor: event.actor,
    action: event.action,
    target: event.target ?? '',
    outcome: event.outcome,
    meta: event.meta ?? {},
  });
  return createHash('sha256').update(canonical).digest('hex');
}

function signEvent(event: AuditEvent): string | undefined {
  const secret = process.env.AUDIT_WEBHOOK_SECRET ?? process.env.HMAC_SECRET;
  if (!secret) return undefined;
  return createHmac('sha256', secret).update(JSON.stringify(event)).digest('hex');
}

/** 단순 검증: 메모리 내 buffer 의 hash chain 이 끊긴 곳을 찾아 반환. */
export function verifyAuditChain(): { ok: boolean; brokenAt: number | null } {
  let prev = GENESIS;
  for (let i = 0; i < buffer.length; i++) {
    const e = buffer[i];
    if (!e) continue;
    if (e.prevHash !== prev) return { ok: false, brokenAt: i };
    const expected = hashEvent(prev, {
      ts: e.ts,
      actor: e.actor,
      action: e.action,
      target: e.target,
      outcome: e.outcome,
      meta: e.meta,
    });
    if (e.hash !== expected) return { ok: false, brokenAt: i };
    prev = e.hash;
  }
  return { ok: true, brokenAt: null };
}

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

export function recordAudit(
  event: Omit<AuditEvent, 'ts' | 'hash' | 'prevHash' | 'signature'>,
): void {
  const base = { ts: new Date().toISOString(), ...event };
  const prevHash = lastHash;
  const hash = hashEvent(prevHash, base);
  lastHash = hash;
  const full: AuditEvent = { ...base, prevHash, hash };
  full.signature = signEvent(full);
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
