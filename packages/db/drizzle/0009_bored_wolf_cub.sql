ALTER TABLE "notification_outbox" ADD COLUMN "delivery_mode" text DEFAULT 'immediate' NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "notification_only_when_involved" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "summarize_notification_bursts" boolean DEFAULT false NOT NULL;