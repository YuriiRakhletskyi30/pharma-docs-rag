import pino from 'pino';
import { env } from '@/lib/env';

export const log = pino({ level: env.LOG_LEVEL });
