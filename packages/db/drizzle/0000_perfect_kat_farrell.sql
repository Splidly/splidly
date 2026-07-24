CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "currency_quote" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"base" text NOT NULL,
	"rates" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_split" (
	"expense_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"source_amount_minor" bigint NOT NULL,
	CONSTRAINT "expense_split_expense_id_user_id_pk" PRIMARY KEY("expense_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "expense" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"context_type" text NOT NULL,
	"group_id" uuid,
	"friendship_id" uuid,
	"created_by" text NOT NULL,
	"payer_id" text NOT NULL,
	"description" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"source_currency" text NOT NULL,
	"source_amount_minor" bigint NOT NULL,
	"client_mutation_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_revision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"record_type" text NOT NULL,
	"record_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"action" text NOT NULL,
	"actor_id" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "friendship" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_low_id" text NOT NULL,
	"user_high_id" text NOT NULL,
	"created_via" text NOT NULL,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_member" (
	"group_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	CONSTRAINT "group_member_group_id_user_id_pk" PRIMARY KEY("group_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "expense_group" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"currency" text NOT NULL,
	"created_by" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"token_hash" text NOT NULL,
	"group_id" uuid,
	"inviter_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_type" text NOT NULL,
	"source_id" uuid NOT NULL,
	"context_type" text NOT NULL,
	"context_id" uuid NOT NULL,
	"debtor_id" text NOT NULL,
	"creditor_id" text NOT NULL,
	"canonical_currency" text NOT NULL,
	"canonical_amount_minor" bigint NOT NULL,
	"reversal_of_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_valuation" (
	"ledger_entry_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"currency" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	CONSTRAINT "ledger_valuation_ledger_entry_id_user_id_pk" PRIMARY KEY("ledger_entry_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"home_currency" text DEFAULT 'EUR' NOT NULL,
	"onboarded_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expense_id" uuid,
	"settlement_id" uuid,
	"base" text NOT NULL,
	"quote" text NOT NULL,
	"rate" numeric(30, 15) NOT NULL,
	"provider" text NOT NULL,
	"provider_date" text NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "settlement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"context_type" text NOT NULL,
	"group_id" uuid,
	"friendship_id" uuid,
	"created_by" text NOT NULL,
	"from_user_id" text NOT NULL,
	"to_user_id" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"source_currency" text NOT NULL,
	"source_amount_minor" bigint NOT NULL,
	"canonical_currency" text NOT NULL,
	"canonical_amount_minor" bigint NOT NULL,
	"client_mutation_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "currency_quote" ADD CONSTRAINT "currency_quote_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_split" ADD CONSTRAINT "expense_split_expense_id_expense_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expense"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_split" ADD CONSTRAINT "expense_split_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_group_id_expense_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."expense_group"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_friendship_id_friendship_id_fk" FOREIGN KEY ("friendship_id") REFERENCES "public"."friendship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_payer_id_user_id_fk" FOREIGN KEY ("payer_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_revision" ADD CONSTRAINT "financial_revision_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendship" ADD CONSTRAINT "friendship_user_low_id_user_id_fk" FOREIGN KEY ("user_low_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendship" ADD CONSTRAINT "friendship_user_high_id_user_id_fk" FOREIGN KEY ("user_high_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_member" ADD CONSTRAINT "group_member_group_id_expense_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."expense_group"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_member" ADD CONSTRAINT "group_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_group" ADD CONSTRAINT "expense_group_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite" ADD CONSTRAINT "invite_group_id_expense_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."expense_group"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite" ADD CONSTRAINT "invite_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_debtor_id_user_id_fk" FOREIGN KEY ("debtor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_creditor_id_user_id_fk" FOREIGN KEY ("creditor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_valuation" ADD CONSTRAINT "ledger_valuation_ledger_entry_id_ledger_entry_id_fk" FOREIGN KEY ("ledger_entry_id") REFERENCES "public"."ledger_entry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_valuation" ADD CONSTRAINT "ledger_valuation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_snapshot" ADD CONSTRAINT "rate_snapshot_expense_id_expense_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expense"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_snapshot" ADD CONSTRAINT "rate_snapshot_settlement_id_settlement_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."settlement"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement" ADD CONSTRAINT "settlement_group_id_expense_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."expense_group"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement" ADD CONSTRAINT "settlement_friendship_id_friendship_id_fk" FOREIGN KEY ("friendship_id") REFERENCES "public"."friendship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement" ADD CONSTRAINT "settlement_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement" ADD CONSTRAINT "settlement_from_user_id_user_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement" ADD CONSTRAINT "settlement_to_user_id_user_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_unique" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "currency_quote_user_idx" ON "currency_quote" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "currency_quote_expiry_idx" ON "currency_quote" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "expense_split_user_idx" ON "expense_split" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "expense_idempotency_unique" ON "expense" USING btree ("created_by","client_mutation_id");--> statement-breakpoint
CREATE INDEX "expense_group_idx" ON "expense" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "expense_friendship_idx" ON "expense" USING btree ("friendship_id");--> statement-breakpoint
CREATE UNIQUE INDEX "financial_revision_version_unique" ON "financial_revision" USING btree ("record_type","record_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "friendship_pair_unique" ON "friendship" USING btree ("user_low_id","user_high_id");--> statement-breakpoint
CREATE INDEX "friendship_low_idx" ON "friendship" USING btree ("user_low_id");--> statement-breakpoint
CREATE INDEX "friendship_high_idx" ON "friendship" USING btree ("user_high_id");--> statement-breakpoint
CREATE INDEX "group_member_user_idx" ON "group_member" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invite_token_unique" ON "invite" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "invite_group_idx" ON "invite" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "invite_inviter_idx" ON "invite" USING btree ("inviter_id");--> statement-breakpoint
CREATE INDEX "ledger_source_idx" ON "ledger_entry" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "ledger_context_idx" ON "ledger_entry" USING btree ("context_type","context_id");--> statement-breakpoint
CREATE INDEX "ledger_debtor_idx" ON "ledger_entry" USING btree ("debtor_id");--> statement-breakpoint
CREATE INDEX "ledger_creditor_idx" ON "ledger_entry" USING btree ("creditor_id");--> statement-breakpoint
CREATE INDEX "ledger_valuation_user_idx" ON "ledger_valuation" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "rate_expense_idx" ON "rate_snapshot" USING btree ("expense_id");--> statement-breakpoint
CREATE INDEX "rate_settlement_idx" ON "rate_snapshot" USING btree ("settlement_id");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "settlement_idempotency_unique" ON "settlement" USING btree ("created_by","client_mutation_id");--> statement-breakpoint
CREATE INDEX "settlement_group_idx" ON "settlement" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "settlement_friendship_idx" ON "settlement" USING btree ("friendship_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");