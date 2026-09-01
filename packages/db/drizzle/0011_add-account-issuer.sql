ALTER TABLE "account" ADD COLUMN "issuer" text;--> statement-breakpoint
UPDATE "account"
SET "issuer" = CASE
	WHEN "provider_id" = 'credential' THEN 'local:credential'
	WHEN "provider_id" = 'apple' THEN 'https://appleid.apple.com'
	WHEN "provider_id" = 'google' THEN 'https://accounts.google.com'
	ELSE 'local:oauth:' || "provider_id"
END;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "issuer" SET NOT NULL;--> statement-breakpoint
DROP INDEX "account_provider_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "account_issuer_unique" ON "account" USING btree ("issuer","account_id");--> statement-breakpoint
DELETE FROM "user" AS "demo_user"
WHERE "demo_user"."email" = 'demo@local.splidly.invalid'
	AND NOT EXISTS (
		SELECT 1
		FROM "account"
		WHERE "account"."user_id" = "demo_user"."id"
	);
