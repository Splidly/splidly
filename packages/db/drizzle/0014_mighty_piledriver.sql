ALTER TABLE "friendship" ADD COLUMN "archived_by_low_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "friendship" ADD COLUMN "archived_by_high_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "group_member" ADD COLUMN "archived_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "group_member"
SET "archived_at" = "expense_group"."archived_at"
FROM "expense_group"
WHERE "group_member"."group_id" = "expense_group"."id"
  AND "expense_group"."archived_at" IS NOT NULL;
--> statement-breakpoint
UPDATE "expense_group" SET "archived_at" = NULL WHERE "archived_at" IS NOT NULL;
