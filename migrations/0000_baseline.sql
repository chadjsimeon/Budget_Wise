-- Baseline migration, hand-edited to be idempotent so it can be adopted by
-- databases whose schema was previously created with `drizzle-kit push`
-- (every statement no-ops when the object already exists).
DO $$ BEGIN
	CREATE TYPE "public"."account_type" AS ENUM('checking', 'savings', 'credit', 'loan');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."bill_frequency" AS ENUM('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."currency_placement" AS ENUM('before', 'after');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."date_format" AS ENUM('DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."number_format" AS ENUM('1,234.56', '1.234,56', '1 234.56', '1 234,56');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."tracking_account_type" AS ENUM('asset', 'liability');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounts" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"budget_id" varchar(36) NOT NULL,
	"name" text NOT NULL,
	"type" "account_type" NOT NULL,
	"balance" numeric(15, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"interest_rate" numeric(7, 4),
	"monthly_payment" numeric(15, 2),
	"original_balance" numeric(15, 2),
	"loan_start_date" varchar(10),
	"linked_category_id" varchar(36)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assets" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"value" numeric(15, 2) NOT NULL,
	"type" varchar(20) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bill_reminders" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"budget_id" varchar(36) NOT NULL,
	"name" text NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"frequency" "bill_frequency" NOT NULL,
	"due_day" numeric NOT NULL,
	"due_date_override" varchar(10),
	"category_id" varchar(36),
	"account_id" varchar(36),
	"is_active" boolean DEFAULT true NOT NULL,
	"auto_create_transaction" boolean DEFAULT false NOT NULL,
	"reminder_days_before" numeric DEFAULT '3' NOT NULL,
	"last_paid_date" varchar(10),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "budget_templates" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"goals" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "budgets" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"currency" varchar(10) NOT NULL,
	"currency_placement" "currency_placement" NOT NULL,
	"number_format" "number_format" NOT NULL,
	"date_format" date_format NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "categories" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"budget_id" varchar(36) NOT NULL,
	"group_id" varchar(36) NOT NULL,
	"name" text NOT NULL,
	"goal" numeric(15, 2),
	"linked_account_id" varchar(36)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "category_groups" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"budget_id" varchar(36) NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "monthly_assignments" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"budget_id" varchar(36) NOT NULL,
	"month_key" varchar(7) NOT NULL,
	"category_id" varchar(36) NOT NULL,
	"amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	CONSTRAINT "unique_budget_month_category" UNIQUE("budget_id","month_key","category_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tracking_accounts" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"name" text NOT NULL,
	"type" "tracking_account_type" NOT NULL,
	"balance" numeric(15, 2) DEFAULT '0' NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transactions" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"budget_id" varchar(36) NOT NULL,
	"date" varchar(10) NOT NULL,
	"payee" text NOT NULL,
	"category_id" varchar(36),
	"account_id" varchar(36) NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"memo" text,
	"cleared" boolean DEFAULT false NOT NULL,
	"auto_generated_by_id" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"reset_token" varchar(64),
	"reset_token_expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "accounts" ADD CONSTRAINT "accounts_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "bill_reminders" ADD CONSTRAINT "bill_reminders_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "bill_reminders" ADD CONSTRAINT "bill_reminders_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "bill_reminders" ADD CONSTRAINT "bill_reminders_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "budget_templates" ADD CONSTRAINT "budget_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "categories" ADD CONSTRAINT "categories_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "categories" ADD CONSTRAINT "categories_group_id_category_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."category_groups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "category_groups" ADD CONSTRAINT "category_groups_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "monthly_assignments" ADD CONSTRAINT "monthly_assignments_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "monthly_assignments" ADD CONSTRAINT "monthly_assignments_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "tracking_accounts" ADD CONSTRAINT "tracking_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "transactions" ADD CONSTRAINT "transactions_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounts_budget_id_idx" ON "accounts" USING btree ("budget_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounts_is_active_idx" ON "accounts" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bill_reminders_budget_id_idx" ON "bill_reminders" USING btree ("budget_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "budget_templates_user_id_idx" ON "budget_templates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "budget_templates_is_default_idx" ON "budget_templates" USING btree ("is_default");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "budgets_user_id_idx" ON "budgets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "categories_budget_id_idx" ON "categories" USING btree ("budget_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "categories_group_id_idx" ON "categories" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "category_groups_budget_id_idx" ON "category_groups" USING btree ("budget_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "monthly_assignments_budget_month_idx" ON "monthly_assignments" USING btree ("budget_id","month_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "monthly_assignments_category_id_idx" ON "monthly_assignments" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tracking_accounts_user_id_idx" ON "tracking_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_budget_id_idx" ON "transactions" USING btree ("budget_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_account_id_idx" ON "transactions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_category_id_idx" ON "transactions" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_date_idx" ON "transactions" USING btree ("date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_budget_category_date_idx" ON "transactions" USING btree ("budget_id","category_id","date");