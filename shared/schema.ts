import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  text,
  varchar,
  boolean,
  timestamp,
  date,
  decimal,
  jsonb,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================================================
// ENUMS
// ============================================================================

export const accountTypeEnum = pgEnum("account_type", [
  "checking",
  "savings",
  "credit",
  "loan",
]);

export const trackingAccountTypeEnum = pgEnum("tracking_account_type", [
  "asset",
  "liability",
]);

export const currencyPlacementEnum = pgEnum("currency_placement", [
  "before",
  "after",
]);

export const numberFormatEnum = pgEnum("number_format", [
  "1,234.56",
  "1.234,56",
  "1 234.56",
  "1 234,56",
]);

export const dateFormatEnum = pgEnum("date_format", [
  "DD/MM/YYYY",
  "MM/DD/YYYY",
  "YYYY-MM-DD",
]);

// ============================================================================
// TABLES
// ============================================================================

// Users table (existing)
export const users = pgTable("users", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

// Budgets table - top-level container with currency settings
export const budgets = pgTable(
  "budgets",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    currency: varchar("currency", { length: 10 }).notNull().default("USD"),
    currencyPlacement: currencyPlacementEnum("currency_placement")
      .notNull()
      .default("before"),
    numberFormat: numberFormatEnum("number_format").notNull().default("1,234.56"),
    dateFormat: dateFormatEnum("date_format").notNull().default("MM/DD/YYYY"),
  },
  (table) => [index("budgets_user_id_idx").on(table.userId)]
);

// Tracking Accounts - user-scoped, not budget-scoped (for net worth tracking)
export const trackingAccounts = pgTable(
  "tracking_accounts",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: trackingAccountTypeEnum("type").notNull(),
    balance: decimal("balance", { precision: 19, scale: 4 }).notNull().default("0"),
    notes: text("notes"),
  },
  (table) => [index("tracking_accounts_user_id_idx").on(table.userId)]
);

// Budget Templates - user-scoped, reusable budget allocation templates
export const budgetTemplates = pgTable(
  "budget_templates",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    goals: jsonb("goals").notNull().default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("budget_templates_user_id_idx").on(table.userId)]
);

// Accounts - budget-scoped financial accounts
export const accounts = pgTable(
  "accounts",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    budgetId: varchar("budget_id", { length: 36 })
      .notNull()
      .references(() => budgets.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: accountTypeEnum("type").notNull(),
    balance: decimal("balance", { precision: 19, scale: 4 }).notNull().default("0"),
    isActive: boolean("is_active").notNull().default(true),
  },
  (table) => [index("accounts_budget_id_idx").on(table.budgetId)]
);

// Category Groups - organizational containers for categories
export const categoryGroups = pgTable(
  "category_groups",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    budgetId: varchar("budget_id", { length: 36 })
      .notNull()
      .references(() => budgets.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
  },
  (table) => [index("category_groups_budget_id_idx").on(table.budgetId)]
);

// Categories - spending categories with optional monthly goals
export const categories = pgTable(
  "categories",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    budgetId: varchar("budget_id", { length: 36 })
      .notNull()
      .references(() => budgets.id, { onDelete: "cascade" }),
    groupId: varchar("group_id", { length: 36 })
      .notNull()
      .references(() => categoryGroups.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    goal: decimal("goal", { precision: 19, scale: 4 }),
  },
  (table) => [
    index("categories_budget_id_idx").on(table.budgetId),
    index("categories_group_id_idx").on(table.groupId),
  ]
);

// Transactions - financial movements
export const transactions = pgTable(
  "transactions",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    budgetId: varchar("budget_id", { length: 36 })
      .notNull()
      .references(() => budgets.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    payee: text("payee").notNull(),
    categoryId: varchar("category_id", { length: 36 }).references(
      () => categories.id,
      { onDelete: "set null" }
    ),
    accountId: varchar("account_id", { length: 36 })
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    amount: decimal("amount", { precision: 19, scale: 4 }).notNull(),
    memo: text("memo"),
    cleared: boolean("cleared").notNull().default(false),
  },
  (table) => [
    index("transactions_budget_id_idx").on(table.budgetId),
    index("transactions_date_idx").on(table.date),
    index("transactions_account_id_idx").on(table.accountId),
    index("transactions_category_id_idx").on(table.categoryId),
  ]
);

// Monthly Assignments - budget allocations per category per month
export const monthlyAssignments = pgTable(
  "monthly_assignments",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    budgetId: varchar("budget_id", { length: 36 })
      .notNull()
      .references(() => budgets.id, { onDelete: "cascade" }),
    monthKey: varchar("month_key", { length: 7 }).notNull(), // Format: "YYYY-MM"
    categoryId: varchar("category_id", { length: 36 })
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    amount: decimal("amount", { precision: 19, scale: 4 }).notNull().default("0"),
  },
  (table) => [
    index("monthly_assignments_budget_id_idx").on(table.budgetId),
    index("monthly_assignments_category_id_idx").on(table.categoryId),
    unique("monthly_assignments_unique").on(
      table.budgetId,
      table.monthKey,
      table.categoryId
    ),
  ]
);

// ============================================================================
// ZOD SCHEMAS & TYPES
// ============================================================================

// Users
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Budgets
export const insertBudgetSchema = createInsertSchema(budgets).omit({
  id: true,
  createdAt: true,
});
export type InsertBudget = z.infer<typeof insertBudgetSchema>;
export type Budget = typeof budgets.$inferSelect;

// Tracking Accounts
export const insertTrackingAccountSchema = createInsertSchema(trackingAccounts).omit({
  id: true,
});
export type InsertTrackingAccount = z.infer<typeof insertTrackingAccountSchema>;
export type TrackingAccount = typeof trackingAccounts.$inferSelect;

// Budget Templates
export const insertBudgetTemplateSchema = createInsertSchema(budgetTemplates).omit({
  id: true,
  createdAt: true,
});
export type InsertBudgetTemplate = z.infer<typeof insertBudgetTemplateSchema>;
export type BudgetTemplate = typeof budgetTemplates.$inferSelect;

// Accounts
export const insertAccountSchema = createInsertSchema(accounts).omit({
  id: true,
});
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Account = typeof accounts.$inferSelect;

// Category Groups
export const insertCategoryGroupSchema = createInsertSchema(categoryGroups).omit({
  id: true,
});
export type InsertCategoryGroup = z.infer<typeof insertCategoryGroupSchema>;
export type CategoryGroup = typeof categoryGroups.$inferSelect;

// Categories
export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
});
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

// Transactions
export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
});
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

// Monthly Assignments
export const insertMonthlyAssignmentSchema = createInsertSchema(monthlyAssignments).omit({
  id: true,
});
export type InsertMonthlyAssignment = z.infer<typeof insertMonthlyAssignmentSchema>;
export type MonthlyAssignment = typeof monthlyAssignments.$inferSelect;
