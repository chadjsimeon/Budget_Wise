import {
  type User,
  type InsertUser,
  type OtpCode,
  users,
  otpCodes,
  budgets,
  accounts,
  trackingAccounts,
  categoryGroups,
  categories,
  transactions,
  monthlyAssignments,
  budgetTemplates,
} from "@shared/schema";
import { eq, and, gt, desc } from "drizzle-orm";
import { db } from "./db";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // OTP Codes
  createOtp(data: { email: string; code: string; expiresAt: Date }): Promise<void>;
  getValidOtp(email: string): Promise<OtpCode | undefined>;
  markOtpUsed(id: string): Promise<void>;
  incrementOtpAttempts(id: string): Promise<number>;
  invalidateOtpsForEmail(email: string): Promise<void>;
  countRecentOtps(email: string, since: Date): Promise<number>;

  // Budgets
  createBudget(data: {
    id: string;
    userId: string;
    name: string;
    currency: string;
    currencyPlacement: "before" | "after";
    numberFormat: string;
    dateFormat: string;
  }): Promise<void>;
  updateBudget(id: string, userId: string, data: Record<string, unknown>): Promise<void>;
  deleteBudget(id: string, userId: string): Promise<void>;

  // Accounts
  createAccount(data: {
    id: string;
    budgetId: string;
    name: string;
    type: "checking" | "savings" | "credit" | "loan";
    balance: number;
    isActive: boolean;
    interestRate?: number;
    monthlyPayment?: number;
    originalBalance?: number;
    loanStartDate?: string;
    linkedCategoryId?: string;
  }): Promise<void>;
  updateAccount(id: string, budgetId: string, data: Record<string, unknown>): Promise<void>;
  deleteAccount(id: string, budgetId: string): Promise<void>;

  // Tracking Accounts
  createTrackingAccount(data: {
    id: string;
    userId: string;
    name: string;
    type: "asset" | "liability";
    balance: number;
    notes?: string;
  }): Promise<void>;
  updateTrackingAccount(id: string, userId: string, data: Record<string, unknown>): Promise<void>;
  deleteTrackingAccount(id: string, userId: string): Promise<void>;

  // Category Groups
  createCategoryGroup(data: {
    id: string;
    budgetId: string;
    name: string;
  }): Promise<void>;
  updateCategoryGroup(id: string, budgetId: string, data: Record<string, unknown>): Promise<void>;
  deleteCategoryGroup(id: string, budgetId: string): Promise<void>;

  // Categories
  createCategory(data: {
    id: string;
    budgetId: string;
    groupId: string;
    name: string;
    goal?: number;
    linkedAccountId?: string;
  }): Promise<void>;
  updateCategory(id: string, budgetId: string, data: Record<string, unknown>): Promise<void>;
  deleteCategory(id: string, budgetId: string): Promise<void>;

  // Transactions
  createTransaction(data: {
    id: string;
    budgetId: string;
    date: string;
    payee: string;
    categoryId?: string;
    accountId: string;
    amount: number;
    memo?: string;
    cleared: boolean;
  }): Promise<void>;
  updateTransaction(id: string, budgetId: string, data: Record<string, unknown>): Promise<void>;
  deleteTransaction(id: string, budgetId: string): Promise<void>;

  // Monthly Assignments
  upsertAssignment(data: {
    budgetId: string;
    monthKey: string;
    categoryId: string;
    amount: number;
  }): Promise<void>;
  upsertAssignmentsBulk(assignments: Array<{
    budgetId: string;
    monthKey: string;
    categoryId: string;
    amount: number;
  }>): Promise<void>;

  // Budget Templates
  createBudgetTemplate(data: {
    id: string;
    userId: string;
    name: string;
    isDefault: boolean;
    goals: Record<string, number>;
  }): Promise<void>;
  updateBudgetTemplate(id: string, userId: string, data: Record<string, unknown>): Promise<void>;
  deleteBudgetTemplate(id: string, userId: string): Promise<void>;
}

export class DbStorage implements IStorage {
  // ============= USERS =============
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  // ============= OTP CODES =============
  async createOtp(data: { email: string; code: string; expiresAt: Date }): Promise<void> {
    await db.insert(otpCodes).values({
      email: data.email,
      code: data.code,
      expiresAt: data.expiresAt,
    });
  }

  async getValidOtp(email: string): Promise<OtpCode | undefined> {
    const result = await db.select().from(otpCodes)
      .where(and(
        eq(otpCodes.email, email),
        eq(otpCodes.used, false),
        gt(otpCodes.expiresAt, new Date()),
      ))
      .orderBy(desc(otpCodes.createdAt))
      .limit(1);
    return result[0];
  }

  async markOtpUsed(id: string): Promise<void> {
    await db.update(otpCodes)
      .set({ used: true })
      .where(eq(otpCodes.id, id));
  }

  async incrementOtpAttempts(id: string): Promise<number> {
    const result = await db.select({ attempts: otpCodes.attempts })
      .from(otpCodes)
      .where(eq(otpCodes.id, id));
    const current = Number(result[0]?.attempts ?? 0);
    const newCount = current + 1;
    await db.update(otpCodes)
      .set({ attempts: String(newCount) })
      .where(eq(otpCodes.id, id));
    return newCount;
  }

  async invalidateOtpsForEmail(email: string): Promise<void> {
    await db.update(otpCodes)
      .set({ used: true })
      .where(and(eq(otpCodes.email, email), eq(otpCodes.used, false)));
  }

  async countRecentOtps(email: string, since: Date): Promise<number> {
    const result = await db.select().from(otpCodes)
      .where(and(
        eq(otpCodes.email, email),
        gt(otpCodes.createdAt, since),
      ));
    return result.length;
  }

  // ============= BUDGETS =============
  async createBudget(data: {
    id: string;
    userId: string;
    name: string;
    currency: string;
    currencyPlacement: "before" | "after";
    numberFormat: string;
    dateFormat: string;
  }): Promise<void> {
    await db.insert(budgets).values({
      id: data.id,
      userId: data.userId,
      name: data.name,
      currency: data.currency,
      currencyPlacement: data.currencyPlacement,
      numberFormat: data.numberFormat as any,
      dateFormat: data.dateFormat as any,
    });
  }

  async updateBudget(id: string, userId: string, data: Record<string, unknown>): Promise<void> {
    await db.update(budgets)
      .set(data as any)
      .where(and(eq(budgets.id, id), eq(budgets.userId, userId)));
  }

  async deleteBudget(id: string, userId: string): Promise<void> {
    await db.delete(budgets)
      .where(and(eq(budgets.id, id), eq(budgets.userId, userId)));
  }

  // ============= ACCOUNTS =============
  async createAccount(data: {
    id: string;
    budgetId: string;
    name: string;
    type: "checking" | "savings" | "credit" | "loan";
    balance: number;
    isActive: boolean;
    interestRate?: number;
    monthlyPayment?: number;
    originalBalance?: number;
    loanStartDate?: string;
    linkedCategoryId?: string;
  }): Promise<void> {
    await db.insert(accounts).values({
      id: data.id,
      budgetId: data.budgetId,
      name: data.name,
      type: data.type,
      balance: String(data.balance),
      isActive: data.isActive,
      interestRate: data.interestRate != null ? String(data.interestRate) : null,
      monthlyPayment: data.monthlyPayment != null ? String(data.monthlyPayment) : null,
      originalBalance: data.originalBalance != null ? String(data.originalBalance) : null,
      loanStartDate: data.loanStartDate ?? null,
      linkedCategoryId: data.linkedCategoryId ?? null,
    });
  }

  async updateAccount(id: string, budgetId: string, data: Record<string, unknown>): Promise<void> {
    const dbData: Record<string, unknown> = { ...data };
    for (const key of ['balance', 'interestRate', 'monthlyPayment', 'originalBalance']) {
      if (typeof dbData[key] === 'number') {
        dbData[key] = String(dbData[key]);
      }
    }
    await db.update(accounts)
      .set(dbData as any)
      .where(and(eq(accounts.id, id), eq(accounts.budgetId, budgetId)));
  }

  async deleteAccount(id: string, budgetId: string): Promise<void> {
    await db.delete(accounts)
      .where(and(eq(accounts.id, id), eq(accounts.budgetId, budgetId)));
  }

  // ============= TRACKING ACCOUNTS =============
  async createTrackingAccount(data: {
    id: string;
    userId: string;
    name: string;
    type: "asset" | "liability";
    balance: number;
    notes?: string;
  }): Promise<void> {
    await db.insert(trackingAccounts).values({
      id: data.id,
      userId: data.userId,
      name: data.name,
      type: data.type,
      balance: String(data.balance),
      notes: data.notes ?? null,
    });
  }

  async updateTrackingAccount(id: string, userId: string, data: Record<string, unknown>): Promise<void> {
    const dbData: Record<string, unknown> = { ...data };
    if (typeof dbData.balance === 'number') {
      dbData.balance = String(dbData.balance);
    }
    await db.update(trackingAccounts)
      .set(dbData as any)
      .where(and(eq(trackingAccounts.id, id), eq(trackingAccounts.userId, userId)));
  }

  async deleteTrackingAccount(id: string, userId: string): Promise<void> {
    await db.delete(trackingAccounts)
      .where(and(eq(trackingAccounts.id, id), eq(trackingAccounts.userId, userId)));
  }

  // ============= CATEGORY GROUPS =============
  async createCategoryGroup(data: {
    id: string;
    budgetId: string;
    name: string;
  }): Promise<void> {
    await db.insert(categoryGroups).values(data);
  }

  async updateCategoryGroup(id: string, budgetId: string, data: Record<string, unknown>): Promise<void> {
    await db.update(categoryGroups)
      .set(data as any)
      .where(and(eq(categoryGroups.id, id), eq(categoryGroups.budgetId, budgetId)));
  }

  async deleteCategoryGroup(id: string, budgetId: string): Promise<void> {
    await db.delete(categoryGroups)
      .where(and(eq(categoryGroups.id, id), eq(categoryGroups.budgetId, budgetId)));
  }

  // ============= CATEGORIES =============
  async createCategory(data: {
    id: string;
    budgetId: string;
    groupId: string;
    name: string;
    goal?: number;
    linkedAccountId?: string;
  }): Promise<void> {
    await db.insert(categories).values({
      id: data.id,
      budgetId: data.budgetId,
      groupId: data.groupId,
      name: data.name,
      goal: data.goal != null ? String(data.goal) : null,
      linkedAccountId: data.linkedAccountId ?? null,
    });
  }

  async updateCategory(id: string, budgetId: string, data: Record<string, unknown>): Promise<void> {
    const dbData: Record<string, unknown> = { ...data };
    if (typeof dbData.goal === 'number') {
      dbData.goal = String(dbData.goal);
    }
    await db.update(categories)
      .set(dbData as any)
      .where(and(eq(categories.id, id), eq(categories.budgetId, budgetId)));
  }

  async deleteCategory(id: string, budgetId: string): Promise<void> {
    await db.delete(categories)
      .where(and(eq(categories.id, id), eq(categories.budgetId, budgetId)));
  }

  // ============= TRANSACTIONS =============
  async createTransaction(data: {
    id: string;
    budgetId: string;
    date: string;
    payee: string;
    categoryId?: string;
    accountId: string;
    amount: number;
    memo?: string;
    cleared: boolean;
  }): Promise<void> {
    await db.insert(transactions).values({
      id: data.id,
      budgetId: data.budgetId,
      date: data.date,
      payee: data.payee,
      categoryId: data.categoryId ?? null,
      accountId: data.accountId,
      amount: String(data.amount),
      memo: data.memo ?? null,
      cleared: data.cleared,
    });
  }

  async updateTransaction(id: string, budgetId: string, data: Record<string, unknown>): Promise<void> {
    const dbData: Record<string, unknown> = { ...data };
    if (typeof dbData.amount === 'number') {
      dbData.amount = String(dbData.amount);
    }
    await db.update(transactions)
      .set(dbData as any)
      .where(and(eq(transactions.id, id), eq(transactions.budgetId, budgetId)));
  }

  async deleteTransaction(id: string, budgetId: string): Promise<void> {
    await db.delete(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.budgetId, budgetId)));
  }

  // ============= MONTHLY ASSIGNMENTS =============
  async upsertAssignment(data: {
    budgetId: string;
    monthKey: string;
    categoryId: string;
    amount: number;
  }): Promise<void> {
    await db.insert(monthlyAssignments)
      .values({
        id: crypto.randomUUID(),
        budgetId: data.budgetId,
        monthKey: data.monthKey,
        categoryId: data.categoryId,
        amount: String(data.amount),
      })
      .onConflictDoUpdate({
        target: [monthlyAssignments.budgetId, monthlyAssignments.monthKey, monthlyAssignments.categoryId],
        set: { amount: String(data.amount) },
      });
  }

  async upsertAssignmentsBulk(assignments: Array<{
    budgetId: string;
    monthKey: string;
    categoryId: string;
    amount: number;
  }>): Promise<void> {
    for (const assignment of assignments) {
      await this.upsertAssignment(assignment);
    }
  }

  // ============= BUDGET TEMPLATES =============
  async createBudgetTemplate(data: {
    id: string;
    userId: string;
    name: string;
    isDefault: boolean;
    goals: Record<string, number>;
  }): Promise<void> {
    await db.insert(budgetTemplates).values({
      id: data.id,
      userId: data.userId,
      name: data.name,
      isDefault: data.isDefault,
      goals: data.goals,
    });
  }

  async updateBudgetTemplate(id: string, userId: string, data: Record<string, unknown>): Promise<void> {
    await db.update(budgetTemplates)
      .set(data as any)
      .where(and(eq(budgetTemplates.id, id), eq(budgetTemplates.userId, userId)));
  }

  async deleteBudgetTemplate(id: string, userId: string): Promise<void> {
    await db.delete(budgetTemplates)
      .where(and(eq(budgetTemplates.id, id), eq(budgetTemplates.userId, userId)));
  }
}

export const storage = new DbStorage();
