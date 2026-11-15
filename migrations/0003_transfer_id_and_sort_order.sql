ALTER TABLE "accounts" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "category_groups" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tracking_accounts" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "transfer_id" varchar(36);--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "is_opening_balance" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "transactions_transfer_id_idx" ON "transactions" USING btree ("transfer_id");--> statement-breakpoint
-- Backfill sort_order for existing rows. These tables have no created_at, so the
-- physical row position (ctid) is the closest thing to creation order available.
-- New rows get max + 1 from the server, so they always sort after these.
UPDATE "accounts" t SET "sort_order" = s.rn
FROM (SELECT "id", row_number() OVER (PARTITION BY "budget_id" ORDER BY ctid) AS rn FROM "accounts") s
WHERE t."id" = s."id";--> statement-breakpoint
UPDATE "category_groups" t SET "sort_order" = s.rn
FROM (SELECT "id", row_number() OVER (PARTITION BY "budget_id" ORDER BY ctid) AS rn FROM "category_groups") s
WHERE t."id" = s."id";--> statement-breakpoint
UPDATE "categories" t SET "sort_order" = s.rn
FROM (SELECT "id", row_number() OVER (PARTITION BY "budget_id" ORDER BY ctid) AS rn FROM "categories") s
WHERE t."id" = s."id";--> statement-breakpoint
UPDATE "tracking_accounts" t SET "sort_order" = s.rn
FROM (SELECT "id", row_number() OVER (PARTITION BY "user_id" ORDER BY ctid) AS rn FROM "tracking_accounts") s
WHERE t."id" = s."id";--> statement-breakpoint
-- Opening-balance transactions were only ever marked on the client. Recover the
-- flag from the payee and memo the app has always written for them.
UPDATE "transactions" SET "is_opening_balance" = true
WHERE "payee" = 'Opening Balance' AND "memo" LIKE 'Initial balance for %';
