import CircuitBreaker from 'opossum';
import { logger } from './logger.js';
import { renderErrors } from './metrics.js';

const breakers = new Map<string, CircuitBreaker<unknown[], unknown>>();

const OPTIONS = {
  timeout: 30_000,
  errorThresholdPercentage: 50,
  resetTimeout: 30_000,
  rollingCountTimeout: 60_000,
  rollingCountBuckets: 6,
  volumeThreshold: 5,
} as const;

type BreakerFn<TArgs extends unknown[], TResult> = (...args: TArgs) => Promise<TResult>;

export function withBreaker<TArgs extends unknown[], TResult>(
  host: string,
  fn: BreakerFn<TArgs, TResult>,
): BreakerFn<TArgs, TResult> {
  let breaker = breakers.get(host) as CircuitBreaker<TArgs, TResult> | undefined;
  if (!breaker) {
    breaker = new CircuitBreaker<TArgs, TResult>(fn as BreakerFn<TArgs, TResult>, OPTIONS);
    breaker.on('open', () => {
      logger.warn({ host }, 'circuit OPEN — origin failing');
      renderErrors.inc({ reason: 'circuit-open' });
    });
    breaker.on('halfOpen', () => logger.info({ host }, 'circuit HALF-OPEN'));
    breaker.on('close', () => logger.info({ host }, 'circuit CLOSED — recovered'));
    breakers.set(host, breaker as CircuitBreaker<unknown[], unknown>);
  }
  return ((...args: TArgs) =>
    (breaker as CircuitBreaker<TArgs, TResult>).fire(...args)) as BreakerFn<TArgs, TResult>;
}

export function isCircuitOpen(host: string): boolean {
  const b = breakers.get(host);
  return b ? b.opened : false;
}

export function breakerStats() {
  const out: Record<string, { opened: boolean; stats: unknown }> = {};
  for (const [host, b] of breakers) {
    out[host] = { opened: b.opened, stats: b.stats };
  }
  return out;
}
