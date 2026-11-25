// The one-off release step, run once per deploy before the app starts (compose: the `release` service).
// Checks the environment, then migrates and seeds under a database lock.
import './check-env';
import { sqlClient } from '@/lib/db/client';
import { release } from '@/lib/db/release';

await release();
await sqlClient.end();
