import { isbot } from 'isbot';
import { config } from './config.js';

export type DetectionResult = {
  isBot: boolean;
  reason: 'ua' | 'force-header' | 'bypass-query' | 'human';
};

export function detectBot(
  userAgent: string | undefined,
  headers: Record<string, string | string[] | undefined>,
  query: Record<string, unknown>,
): DetectionResult {
  if (config.bot.bypassQueryParam in query) {
    return { isBot: false, reason: 'bypass-query' };
  }
  const forced = headers[config.bot.forceRenderHeader.toLowerCase()];
  if (forced && (forced === '1' || forced === 'true')) {
    return { isBot: true, reason: 'force-header' };
  }
  if (userAgent && isbot(userAgent)) {
    return { isBot: true, reason: 'ua' };
  }
  return { isBot: false, reason: 'human' };
}
