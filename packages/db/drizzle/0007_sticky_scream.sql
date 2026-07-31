CREATE TABLE "notification_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_key" text NOT NULL,
	"installation_id" uuid NOT NULL,
	"recipient_user_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processing_started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_installation" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"platform" text NOT NULL,
	"environment" text NOT NULL,
	"token" text NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_installation_id_push_installation_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."push_installation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_recipient_user_id_user_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_installation" ADD CONSTRAINT "push_installation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_outbox_event_unique" ON "notification_outbox" USING btree ("event_key");--> statement-breakpoint
CREATE INDEX "notification_outbox_pending_idx" ON "notification_outbox" USING btree ("status","available_at");--> statement-breakpoint
CREATE INDEX "notification_outbox_installation_idx" ON "notification_outbox" USING btree ("installation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "push_installation_token_unique" ON "push_installation" USING btree ("token");--> statement-breakpoint
CREATE INDEX "push_installation_user_idx" ON "push_installation" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "push_installation_delivery_idx" ON "push_installation" USING btree ("environment","disabled_at");