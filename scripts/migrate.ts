import { sqlClient } from '@/lib/db/client';
import { migrateDb } from '@/lib/db/release';

await migrateDb();
console.log('migrations applied');
await sqlClient.end();
