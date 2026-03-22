import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  text,
  varchar,
  timestamp,
  boolean,
  numeric,
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
// USERS TABLE
// ============================================================================

export const users = pgTable("users", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  resetToken: varchar("reset_token", { length: 64 }),
  resetTokenExpiresAt: timestamp("reset_token_expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ============================================================================
// GLOBAL TABLES (No Budget Scoping)
// ============================================================================

export const budgets = pgTable("budgets", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  currency: varchar("currency", { length: 10 }).notNull(),
  currencyPlacement: currencyPlacementEnum("currency_placement").notNull(),
  numberFormat: numberFormatEnum("number_format").notNull(),
  dateFormat: dateFormatEnum("date_format").notNull(),
}, (table) => ({
  userIdIdx: index("budgets_user_id_idx").on(table.userId),
}));

export const trackingAccounts = pgTable("tracking_accounts", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: trackingAccountTypeEnum("type").notNull(),
  balance: numeric("balance", { precision: 15, scale: 2 }).notNull().default('0'),
  notes: text("notes"),
}, (table) => ({
  userIdIdx: index("tracking_accounts_user_id_idx").on(table.userId),
}));

export const budgetTemplates = pgTable("budget_templates", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  goals: jsonb("goals").notNull(), // { [categoryId: string]: number }
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("budget_templates_user_id_idx").on(table.userId),
  isDefaultIdx: index("budget_templates_is_default_idx").on(table.isDefault),
}));

export const assets = pgTable("assets", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  value: numeric("value", { precision: 15, scale: 2 }).notNull(),
  type: varchar("type", { length: 20 }).notNull(), // 'property' | 'vehicle' | 'investment' | 'other'
});

// ============================================================================
// BUDGET-SCOPED LEVEL 1 (FK → budgets)
// ============================================================================

export const accounts = pgTable("accounts", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  budgetId: varchar("budget_id", { length: 36 }).notNull()
    .references(() => budgets.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  type: accountTypeEnum("type").notNull(),
  balance: numeric("balance", { precision: 15, scale: 2 }).notNull().default('0'),
  isActive: boolean("is_active").notNull().default(true),
  interestRate: numeric("interest_rate", { precision: 7, scale: 4 }),
  monthlyPayment: numeric("monthly_payment", { precision: 15, scale: 2 }),
  originalBalance: numeric("original_balance", { precision: 15, scale: 2 }),
  loanStartDate: varchar("loan_start_date", { length: 10 }),
  linkedCategoryId: varchar("linked_category_id", { length: 36 }),
}, (table) => ({
  budgetIdIdx: index("accounts_budget_id_idx").on(table.budgetId),
  activeIdx: index("accounts_is_active_idx").on(table.isActive),
}));

export const categoryGroups = pgTable("category_groups", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  budgetId: varchar("budget_id", { length: 36 }).notNull()
    .references(() => budgets.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
}, (table) => ({
  budgetIdIdx: index("category_groups_budget_id_idx").on(table.budgetId),
}));

// ============================================================================
// BUDGET-SCOPED LEVEL 2 (FK → budgets + categoryGroups)
// ============================================================================

export const categories = pgTable("categories", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  budgetId: varchar("budget_id", { length: 36 }).notNull()
    .references(() => budgets.id, { onDelete: 'cascade' }),
  groupId: varchar("group_id", { length: 36 }).notNull()
    .references(() => categoryGroups.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  goal: numeric("goal", { precision: 15, scale: 2 }),
  linkedAccountId: varchar("linked_account_id", { length: 36 }),
}, (table) => ({
  budgetIdIdx: index("categories_budget_id_idx").on(table.budgetId),
  groupIdIdx: index("categories_group_id_idx").on(table.groupId),
}));

// ============================================================================
// TRANSACTIONAL DATA
// ============================================================================

export const transactions = pgTable("transactions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  budgetId: varchar("budget_id", { length: 36 }).notNull()
    .references(() => budgets.id, { onDelete: 'cascade' }),
  date: varchar("date", { length: 10 }).notNull(), // "YYYY-MM-DD"
  payee: text("payee").notNull(),
  categoryId: varchar("category_id", { length: 36 })
    .references(() => categories.id, { onDelete: 'set null' }), // Allow income transactions
  accountId: varchar("account_id", { length: 36 }).notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  memo: text("memo"),
  cleared: boolean("cleared").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  budgetIdIdx: index("transactions_budget_id_idx").on(table.budgetId),
  accountIdIdx: index("transactions_account_id_idx").on(table.accountId),
  categoryIdIdx: index("transactions_category_id_idx").on(table.categoryId),
  dateIdx: index("transactions_date_idx").on(table.date),
  // CRITICAL: Composite for getCategoryActivity query
  budgetCategoryDateIdx: index("transactions_budget_category_date_idx")
    .on(table.budgetId, table.categoryId, table.date),
}));

export const monthlyAssignments = pgTable("monthly_assignments", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  budgetId: varchar("budget_id", { length: 36 }).notNull()
    .references(() => budgets.id, { onDelete: 'cascade' }),
  monthKey: varchar("month_key", { length: 7 }).notNull(), // "YYYY-MM"
  categoryId: varchar("category_id", { length: 36 }).notNull()
    .references(() => categories.id, { onDelete: 'cascade' }),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull().default('0'),
}, (table) => ({
  uniqueAssignment: unique("unique_budget_month_category")
    .on(table.budgetId, table.monthKey, table.categoryId),
  budgetMonthIdx: index("monthly_assignments_budget_month_idx")
    .on(table.budgetId, table.monthKey),
  categoryIdIdx: index("monthly_assignments_category_id_idx").on(table.categoryId),
}));

// ============================================================================
// DRIZZLE RELATIONS (for query building)
// ============================================================================

export const budgetsRelations = relations(budgets, ({ one, many }) => ({
  user: one(users, { fields: [budgets.userId], references: [users.id] }),
  accounts: many(accounts),
  categoryGroups: many(categoryGroups),
  categories: many(categories),
  transactions: many(transactions),
  monthlyAssignments: many(monthlyAssignments),
}));

export const trackingAccountsRelations = relations(trackingAccounts, ({ one }) => ({
  user: one(users, { fields: [trackingAccounts.userId], references: [users.id] }),
}));

export const budgetTemplatesRelations = relations(budgetTemplates, ({ one }) => ({
  user: one(users, { fields: [budgetTemplates.userId], references: [users.id] }),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  budget: one(budgets, { fields: [accounts.budgetId], references: [budgets.id] }),
  transactions: many(transactions),
}));

export const categoryGroupsRelations = relations(categoryGroups, ({ one, many }) => ({
  budget: one(budgets, { fields: [categoryGroups.budgetId], references: [budgets.id] }),
  categories: many(categories),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  budget: one(budgets, { fields: [categories.budgetId], references: [budgets.id] }),
  group: one(categoryGroups, { fields: [categories.groupId], references: [categoryGroups.id] }),
  transactions: many(transactions),
  monthlyAssignments: many(monthlyAssignments),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  budget: one(budgets, { fields: [transactions.budgetId], references: [budgets.id] }),
  account: one(accounts, { fields: [transactions.accountId], references: [accounts.id] }),
  category: one(categories, { fields: [transactions.categoryId], references: [categories.id] }),
}));

export const monthlyAssignmentsRelations = relations(monthlyAssignments, ({ one }) => ({
  budget: one(budgets, { fields: [monthlyAssignments.budgetId], references: [budgets.id] }),
  category: one(categories, { fields: [monthlyAssignments.categoryId], references: [categories.id] }),
}));

// ============================================================================
// ZOD VALIDATION SCHEMAS
// ============================================================================

export const insertUserSchema = createInsertSchema(users, {
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
}).pick({
  email: true,
  password: true,
});

export const insertBudgetSchema = createInsertSchema(budgets, {
  currencyPlacement: z.enum(['before', 'after']),
  numberFormat: z.enum(['1,234.56', '1.234,56', '1 234.56', '1 234,56']),
  dateFormat: z.enum(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']),
}).omit({ id: true, createdAt: true });

export const insertAccountSchema = createInsertSchema(accounts, {
  type: z.enum(['checking', 'savings', 'credit', 'loan']),
  balance: z.number(),
}).omit({ id: true, budgetId: true, isActive: true });

export const insertTrackingAccountSchema = createInsertSchema(trackingAccounts, {
  type: z.enum(['asset', 'liability']),
  balance: z.number(),
  notes: z.string().optional(),
}).omit({ id: true });

export const insertCategoryGroupSchema = createInsertSchema(categoryGroups)
  .omit({ id: true, budgetId: true });

export const insertCategorySchema = createInsertSchema(categories, {
  goal: z.number().optional(),
}).omit({ id: true, budgetId: true });

export const insertTransactionSchema = createInsertSchema(transactions, {
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number(),
  categoryId: z.string().optional(),
  memo: z.string().optional(),
}).omit({ id: true, budgetId: true, createdAt: true, updatedAt: true });

export const insertMonthlyAssignmentSchema = createInsertSchema(monthlyAssignments, {
  monthKey: z.string().regex(/^\d{4}-\d{2}$/),
  amount: z.number(),
}).omit({ id: true });

export const insertBudgetTemplateSchema = createInsertSchema(budgetTemplates, {
  goals: z.record(z.string(), z.number()),
}).omit({ id: true, createdAt: true });

export const insertAssetSchema = createInsertSchema(assets, {
  type: z.enum(['property', 'vehicle', 'investment', 'other']),
  value: z.number(),
}).omit({ id: true });

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type User = typeof users.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type TrackingAccount = typeof trackingAccounts.$inferSelect;
export type CategoryGroup = typeof categoryGroups.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type MonthlyAssignment = typeof monthlyAssignments.$inferSelect;
export type BudgetTemplate = typeof budgetTemplates.$inferSelect;
export type Asset = typeof assets.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertBudget = z.infer<typeof insertBudgetSchema>;
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type InsertTrackingAccount = z.infer<typeof insertTrackingAccountSchema>;
export type InsertCategoryGroup = z.infer<typeof insertCategoryGroupSchema>;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type InsertMonthlyAssignment = z.infer<typeof insertMonthlyAssignmentSchema>;
export type InsertBudgetTemplate = z.infer<typeof insertBudgetTemplateSchema>;
export type InsertAsset = z.infer<typeof insertAssetSchema>;
