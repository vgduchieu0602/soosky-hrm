import pino from 'pino';
import { env } from '@infra/config';

export const logger = pino({
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport: env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } }
        : undefined,
})
