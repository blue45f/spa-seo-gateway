import { getRecentAudit, recordAudit, verifyAuditChain } from '@heejun/spa-seo-gateway-core';
import { describe, expect, it } from 'vitest';

describe('audit chain integrity', () => {
  it('verifies clean chain after several recordAudit calls', () => {
    recordAudit({ actor: 'test', action: 'a.one', outcome: 'ok' });
    recordAudit({ actor: 'test', action: 'a.two', outcome: 'ok' });
    recordAudit({ actor: 'test', action: 'a.three', outcome: 'error' });

    const verification = verifyAuditChain();
    expect(verification.ok).toBe(true);
    expect(verification.brokenAt).toBeNull();
  });

  it('records prevHash linking each event to the previous', () => {
    recordAudit({ actor: 'test', action: 'chain.first', outcome: 'ok' });
    recordAudit({ actor: 'test', action: 'chain.second', outcome: 'ok' });

    const recent = getRecentAudit(10);
    // recent 는 reverse 순 — 가장 최신이 0번.
    const last = recent[0];
    const prev = recent[1];
    expect(last?.prevHash).toBe(prev?.hash);
    expect(last?.hash).toBeTypeOf('string');
    expect(last?.hash?.length).toBe(64); // sha256 hex
  });

  it('records hash field for every event', () => {
    recordAudit({ actor: 'test', action: 'has.hash', outcome: 'ok' });
    const recent = getRecentAudit(1);
    expect(recent[0]?.hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
