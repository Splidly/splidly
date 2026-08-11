CREATE INDEX "expense_active_group_idx" ON "expense" USING btree ("group_id","deleted_at","occurred_at");--> statement-breakpoint
CREATE INDEX "expense_active_friendship_idx" ON "expense" USING btree ("friendship_id","deleted_at","occurred_at");--> statement-breakpoint
CREATE INDEX "friendship_active_low_idx" ON "friendship" USING btree ("user_low_id","removed_at");--> statement-breakpoint
CREATE INDEX "friendship_active_high_idx" ON "friendship" USING btree ("user_high_id","removed_at");--> statement-breakpoint
CREATE INDEX "group_member_active_user_idx" ON "group_member" USING btree ("user_id","removed_at");--> statement-breakpoint
CREATE INDEX "settlement_active_group_idx" ON "settlement" USING btree ("group_id","deleted_at","occurred_at");--> statement-breakpoint
CREATE INDEX "settlement_active_friendship_idx" ON "settlement" USING btree ("friendship_id","deleted_at","occurred_at");