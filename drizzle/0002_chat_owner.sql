DROP INDEX "messages_conversation_idx";--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "owner" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "traces" ADD COLUMN "owner" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX "messages_owner_conversation_idx" ON "messages" USING btree ("owner","conversation_id");