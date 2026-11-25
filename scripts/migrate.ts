import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, sqlClient } from '@/lib/db/client';

await migrate(db, { migrationsFolder: 'drizzle' });
console.log('migrations applied');
await sqlClient.end();
