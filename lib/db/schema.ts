import { sql } from 'drizzle-orm';
import {
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  vector,
} from 'drizzle-orm/pg-core';

const tsvector = customType<{ data: string }>({ dataType: () => 'tsvector' });
const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' });

export const EMBEDDING_DIMS = 1024;

export const documents = pgTable('documents', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  filename: text('filename').notNull().unique(),
  pages: integer('pages').notNull(),
  pdf: bytea('pdf').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const chunks = pgTable(
  'chunks',
  {
    id: serial('id').primaryKey(),
    documentId: integer('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    page: integer('page').notNull(),
    heading: text('heading'),
    content: text('content').notNull(),
    tsv: tsvector('tsv').generatedAlwaysAs(
      sql`to_tsvector('english', coalesce(heading, '') || ' ' || content)`,
    ),
    // null when the document was ingested without an embedding key (full-text only)
    embedding: vector('embedding', { dimensions: EMBEDDING_DIMS }),
  },
  (t) => [
    index('chunks_embedding_idx').using('hnsw', t.embedding.op('vector_cosine_ops')),
    index('chunks_tsv_idx').using('gin', t.tsv),
  ],
);

export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  conversationId: text('conversation_id').notNull(),
  role: text('role', { enum: ['user', 'assistant'] }).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [index('messages_conversation_idx').on(t.conversationId)]);

export const traces = pgTable('traces', {
  id: serial('id').primaryKey(),
  requestId: text('request_id').notNull(),
  conversationId: text('conversation_id').notNull(),
  question: text('question').notNull(),
  searchQuery: text('search_query').notNull(),
  mode: text('mode').notNull(),
  retrieved: jsonb('retrieved').notNull(),
  model: text('model'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  latencyMs: integer('latency_ms').notNull(),
  outcome: text('outcome').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
