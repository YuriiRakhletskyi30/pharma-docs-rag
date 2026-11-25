import { asc, sql } from 'drizzle-orm';
import { UPLOAD_PREFIX } from '@/lib/constants';
import { db } from '@/lib/db/client';
import { documents } from '@/lib/db/schema';

/** Every loaded label by title, for library questions. */
export function listLabels() {
  return db
    .select({ title: documents.title, uploaded: sql<boolean>`${documents.filename} like ${UPLOAD_PREFIX + '%'}` })
    .from(documents)
    .orderBy(asc(documents.title));
}
