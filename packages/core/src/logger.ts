import pino from 'pino';
import { config } from './config.js';

export const logger = pino({
  level: config.log.level,
  transport: config.log.pretty
    ? {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' },
      }
    : undefined,
  base: { service: 'spa-seo-gateway' },
});

export type Logger = typeof logger;
