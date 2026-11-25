import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  test: { include: ['tests/**/*.test.ts'], env: { LOG_LEVEL: 'silent', QUESTIONS_PER_MIN_PER_CLIENT: '1000', QUESTIONS_PER_MIN_TOTAL: '1000' } },
});
