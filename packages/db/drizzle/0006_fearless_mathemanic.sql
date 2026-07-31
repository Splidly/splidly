CREATE TABLE "expense_payment" (
	"expense_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"source_amount_minor" bigint NOT NULL,
	CONSTRAINT "expense_payment_expense_id_user_id_pk" PRIMARY KEY("expense_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "expense_payment" ADD CONSTRAINT "expense_payment_expense_id_expense_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expense"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_payment" ADD CONSTRAINT "expense_payment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
INSERT INTO "expense_payment" ("expense_id", "user_id", "source_amount_minor")
SELECT "id", "payer_id", "source_amount_minor"
FROM "expense"
ON CONFLICT ("expense_id", "user_id") DO NOTHING;--> statement-breakpoint
CREATE INDEX "expense_payment_user_idx" ON "expense_payment" USING btree ("user_id");
