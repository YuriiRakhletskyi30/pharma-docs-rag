// Loads the seed labels with their precomputed vectors. Idempotent: skips labels already loaded.
import { sqlClient } from '@/lib/db/client';
import { seedLabels } from '@/lib/db/release';

await seedLabels();
await sqlClient.end();
