import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import rateLimit from "express-rate-limit";
import { storage } from "./storage";
import { generateResetToken } from "./auth";
import { hashPassword, verifyPassword } from "./password";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  createTransactionBodySchema,
  upsertAssignmentSchema,
  bulkAssignmentsSchema,
  parseBody,
} from "./validation";
import { sendPasswordResetEmail } from "./email";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "./db";
import {
  budgets,
  accounts,
  trackingAccounts,
  categoryGroups,
  categories,
  transactions,
  monthlyAssignments,
  budgetTemplates,
  billReminders,
} from "@shared/schema";

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
}

/** Verify the given budgetId belongs to the authenticated user */
async function verifyBudgetOwnership(userId: string, budgetId: unknown): Promise<boolean> {
  if (typeof budgetId !== "string" || !budgetId) return false;
  const result = await db.select({ userId: budgets.userId })
    .from(budgets)
    .where(eq(budgets.id, budgetId))
    .limit(1);
  return result[0]?.userId === userId;
}

// Referenced-entity checks: a budget being owned doesn't mean an accountId or
// categoryId in the payload belongs to that budget — without these, a payload
// can point rows at entities from a different budget.
async function accountInBudget(accountId: unknown, budgetId: string): Promise<boolean> {
  if (typeof accountId !== "string" || !accountId) return false;
  const result = await db.select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.budgetId, budgetId)))
    .limit(1);
  return result.length > 0;
}

async function categoryInBudget(categoryId: unknown, budgetId: string): Promise<boolean> {
  if (typeof categoryId !== "string" || !categoryId) return false;
  const result = await db.select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.budgetId, budgetId)))
    .limit(1);
  return result.length > 0;
}

async function groupInBudget(groupId: unknown, budgetId: string): Promise<boolean> {
  if (typeof groupId !== "string" || !groupId) return false;
  const result = await db.select({ id: categoryGroups.id })
    .from(categoryGroups)
    .where(and(eq(categoryGroups.id, groupId), eq(categoryGroups.budgetId, budgetId)))
    .limit(1);
  return result.length > 0;
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many login attempts, please try again in 15 minutes." },
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many password reset requests, please try again later." },
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ============= HEALTH =============
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // ============= AUTH =============
  app.use("/api/auth", authLimiter);

  app.get("/api/auth/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json(req.user);
  });

  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const parsed = parseBody(registerSchema, req.body);
      if (parsed.error !== undefined) {
        return res.status(400).json({ message: parsed.error });
      }
      const { email: normalizedEmail, password } = parsed.data;

      const existing = await storage.getUserByEmail(normalizedEmail);
      if (existing) {
        return res.status(409).json({ message: "An account with this email already exists" });
      }

      const user = await storage.createUser({
        email: normalizedEmail,
        password: await hashPassword(password),
      });

      // Create a default budget with starter categories for new users
      const budgetId = crypto.randomUUID();
      await storage.createBudget({
        id: budgetId,
        userId: user.id,
        name: "My Budget",
        currency: "TTD",
        currencyPlacement: "before",
        numberFormat: "1,234.56",
        dateFormat: "MM/DD/YYYY",
      });

      const DEFAULT_GROUPS = [
        { name: 'Monthly Bills', cats: ['Rent/Mortgage', 'Electricity', 'Water', 'Internet', 'Phone'] },
        { name: 'Lifestyle',     cats: ['Groceries', 'Dining Out', 'Gym', 'Entertainment'] },
        { name: 'Transport',     cats: ['Fuel', 'Car Insurance', 'Car Maintenance'] },
        { name: 'Subscriptions', cats: ['Netflix', 'Amazon Prime', 'Spotify'] },
        { name: 'Savings',       cats: ['Emergency Fund', 'Vacation'] },
      ];
      for (const group of DEFAULT_GROUPS) {
        const groupId = crypto.randomUUID();
        await storage.createCategoryGroup({ id: groupId, budgetId, name: group.name });
        for (const catName of group.cats) {
          await storage.createCategory({ id: crypto.randomUUID(), budgetId, groupId, name: catName });
        }
      }

      req.logIn({ id: user.id, email: user.email }, (loginErr) => {
        if (loginErr) return next(loginErr);
        res.status(201).json({ id: user.id, email: user.email });
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/login", loginLimiter, async (req, res, next) => {
    try {
      const parsed = parseBody(loginSchema, req.body);
      if (parsed.error !== undefined) {
        return res.status(400).json({ message: parsed.error });
      }
      const { email: normalizedEmail, password } = parsed.data;

      const user = await storage.getUserByEmail(normalizedEmail);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      const { ok, needsRehash } = await verifyPassword(password, user.password);
      if (!ok) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      if (needsRehash) {
        await storage.updatePassword(user.id, await hashPassword(password));
      }

      req.logIn({ id: user.id, email: user.email }, (loginErr) => {
        if (loginErr) return next(loginErr);
        res.json({ id: user.id, email: user.email });
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/forgot-password", forgotPasswordLimiter, async (req, res, next) => {
    try {
      const parsed = parseBody(forgotPasswordSchema, req.body);
      if (parsed.error !== undefined) {
        return res.status(400).json({ message: parsed.error });
      }
      const { email: normalizedEmail } = parsed.data;
      const token = generateResetToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Only email actual account holders — mailing arbitrary addresses would
      // make this endpoint an open spam relay through our sending domain.
      const userExists = await storage.setResetToken(normalizedEmail, token, expiresAt);
      if (userExists) {
        const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
        const resetUrl = `${baseUrl}/reset-password?token=${token}`;
        await sendPasswordResetEmail(normalizedEmail, resetUrl);
      }

      // Same response either way to avoid email enumeration
      res.json({ message: "If an account exists with that email, a reset link has been sent." });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/reset-password", async (req, res, next) => {
    try {
      const parsed = parseBody(resetPasswordSchema, req.body);
      if (parsed.error !== undefined) {
        return res.status(400).json({ message: parsed.error });
      }
      const { token, password } = parsed.data;

      const user = await storage.getUserByResetToken(token);
      if (!user) {
        return res.status(400).json({ message: "Invalid or expired reset link" });
      }

      await storage.updatePassword(user.id, await hashPassword(password));
      res.json({ message: "Password has been reset. You can now sign in." });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      req.session.destroy((destroyErr) => {
        if (destroyErr) return next(destroyErr);
        res.json({ message: "Logged out" });
      });
    });
  });

  // ============= BUDGET DATA (read) =============
  app.get("/api/budget-data", async (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const userId = req.user!.id;

      const userBudgets = await db
        .select()
        .from(budgets)
        .where(eq(budgets.userId, userId));

      if (userBudgets.length === 0) {
        return res.json({
          budgets: [],
          currentBudgetId: "",
          accounts: [],
          trackingAccounts: [],
          categoryGroups: [],
          categories: [],
          transactions: [],
          monthlyAssignments: {},
          budgetTemplates: [],
          billReminders: [],
        });
      }

      const budgetIds = userBudgets.map((b) => b.id);

      const [
        userAccounts,
        userTrackingAccounts,
        userCategoryGroups,
        userCategories,
        userTransactions,
        userMonthlyAssignments,
        userBudgetTemplates,
        userBillReminders,
      ] = await Promise.all([
        db.select().from(accounts).where(inArray(accounts.budgetId, budgetIds)),
        db.select().from(trackingAccounts).where(eq(trackingAccounts.userId, userId)),
        db.select().from(categoryGroups).where(inArray(categoryGroups.budgetId, budgetIds)),
        db.select().from(categories).where(inArray(categories.budgetId, budgetIds)),
        db.select().from(transactions).where(inArray(transactions.budgetId, budgetIds)),
        db.select().from(monthlyAssignments).where(inArray(monthlyAssignments.budgetId, budgetIds)),
        db.select().from(budgetTemplates).where(eq(budgetTemplates.userId, userId)),
        db.select().from(billReminders).where(inArray(billReminders.budgetId, budgetIds)),
      ]);

      const assignmentsMap: Record<string, Record<string, Record<string, number>>> = {};
      for (const ma of userMonthlyAssignments) {
        if (!assignmentsMap[ma.budgetId]) assignmentsMap[ma.budgetId] = {};
        if (!assignmentsMap[ma.budgetId][ma.monthKey]) assignmentsMap[ma.budgetId][ma.monthKey] = {};
        assignmentsMap[ma.budgetId][ma.monthKey][ma.categoryId] = parseFloat(ma.amount);
      }

      res.json({
        budgets: userBudgets.map((b) => ({
          id: b.id,
          name: b.name,
          createdAt: b.createdAt,
          currency: b.currency,
          currencyPlacement: b.currencyPlacement,
          numberFormat: b.numberFormat,
          dateFormat: b.dateFormat,
        })),
        currentBudgetId: userBudgets[0].id,
        accounts: userAccounts.map((a) => ({
          id: a.id,
          budgetId: a.budgetId,
          name: a.name,
          type: a.type,
          balance: parseFloat(a.balance),
          isActive: a.isActive,
          interestRate: a.interestRate ? parseFloat(a.interestRate) : undefined,
          monthlyPayment: a.monthlyPayment ? parseFloat(a.monthlyPayment) : undefined,
          originalBalance: a.originalBalance ? parseFloat(a.originalBalance) : undefined,
          loanStartDate: a.loanStartDate ?? undefined,
          linkedCategoryId: a.linkedCategoryId ?? undefined,
        })),
        trackingAccounts: userTrackingAccounts.map((ta) => ({
          id: ta.id,
          name: ta.name,
          type: ta.type,
          balance: parseFloat(ta.balance),
          notes: ta.notes ?? undefined,
        })),
        categoryGroups: userCategoryGroups.map((cg) => ({
          id: cg.id,
          budgetId: cg.budgetId,
          name: cg.name,
        })),
        categories: userCategories.map((c) => ({
          id: c.id,
          budgetId: c.budgetId,
          groupId: c.groupId,
          name: c.name,
          goal: c.goal ? parseFloat(c.goal) : undefined,
          linkedAccountId: c.linkedAccountId ?? undefined,
        })),
        transactions: userTransactions.map((t) => ({
          id: t.id,
          budgetId: t.budgetId,
          date: t.date,
          payee: t.payee,
          categoryId: t.categoryId ?? undefined,
          accountId: t.accountId,
          amount: parseFloat(t.amount),
          memo: t.memo ?? undefined,
          cleared: t.cleared,
          autoGeneratedById: t.autoGeneratedById ?? undefined,
        })),
        monthlyAssignments: assignmentsMap,
        budgetTemplates: userBudgetTemplates.map((bt) => ({
          id: bt.id,
          name: bt.name,
          isDefault: bt.isDefault,
          goals: bt.goals as Record<string, number>,
          createdAt: bt.createdAt,
        })),
        billReminders: userBillReminders.map((br) => ({
          id: br.id,
          budgetId: br.budgetId,
          name: br.name,
          amount: parseFloat(br.amount),
          frequency: br.frequency,
          dueDay: parseInt(br.dueDay),
          dueDateOverride: br.dueDateOverride ?? undefined,
          categoryId: br.categoryId ?? undefined,
          accountId: br.accountId ?? undefined,
          isActive: br.isActive,
          autoCreateTransaction: br.autoCreateTransaction,
          reminderDaysBefore: parseInt(br.reminderDaysBefore),
          lastPaidDate: br.lastPaidDate ?? undefined,
          notes: br.notes ?? undefined,
          createdAt: br.createdAt,
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  // ============= BUDGETS =============
  app.post("/api/budgets", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const { budget, categoryGroups: groups, categories: cats } = req.body;

      // Create the budget
      await storage.createBudget({
        id: budget.id,
        userId,
        name: budget.name,
        currency: budget.currency,
        currencyPlacement: budget.currencyPlacement,
        numberFormat: budget.numberFormat,
        dateFormat: budget.dateFormat,
      });

      // Create default category groups
      for (const g of groups || []) {
        await storage.createCategoryGroup({ id: g.id, budgetId: budget.id, name: g.name });
      }

      // Create default categories
      for (const c of cats || []) {
        await storage.createCategory({
          id: c.id,
          budgetId: budget.id,
          groupId: c.groupId,
          name: c.name,
          goal: c.goal,
        });
      }

      res.status(201).json({ id: budget.id });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/budgets/:id", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      await storage.updateBudget(req.params.id, userId, req.body);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/budgets/:id", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      await storage.deleteBudget(req.params.id, userId);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  // Idempotent default category seeder for existing budgets that have no categories
  app.post("/api/budgets/:id/seed-categories", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const budgetId = req.params.id;

      if (!await verifyBudgetOwnership(userId, budgetId)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Skip if categories already exist — idempotent
      const existing = await db
        .select({ id: categoryGroups.id })
        .from(categoryGroups)
        .where(eq(categoryGroups.budgetId, budgetId))
        .limit(1);

      if (existing.length > 0) {
        return res.json({ ok: true, seeded: false });
      }

      const { categoryGroups: groups = [], categories: cats = [] } = req.body;

      for (const g of groups) {
        await storage.createCategoryGroup({ id: g.id, budgetId, name: g.name });
      }
      for (const c of cats) {
        await storage.createCategory({ id: c.id, budgetId, groupId: c.groupId, name: c.name, goal: c.goal });
      }

      res.json({ ok: true, seeded: true });
    } catch (error) {
      next(error);
    }
  });

  // ============= ACCOUNTS =============
  app.post("/api/accounts", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const { account, category, categoryGroup, openingTransaction } = req.body;

      if (!await verifyBudgetOwnership(userId, account.budgetId)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Nested entities are created with their own budgetId from the body —
      // require them all to target the budget that was just verified.
      if (
        (categoryGroup && categoryGroup.budgetId !== account.budgetId) ||
        (category && category.budgetId !== account.budgetId) ||
        (openingTransaction &&
          (openingTransaction.budgetId !== account.budgetId ||
            openingTransaction.accountId !== account.id))
      ) {
        return res.status(400).json({ message: "Entities must belong to the same budget" });
      }

      // Create optional debt repayments group
      if (categoryGroup) {
        await storage.createCategoryGroup({
          id: categoryGroup.id,
          budgetId: categoryGroup.budgetId,
          name: categoryGroup.name,
        });
      }

      // Create optional linked category for loans
      if (category) {
        await storage.createCategory({
          id: category.id,
          budgetId: category.budgetId,
          groupId: category.groupId,
          name: category.name,
          goal: category.goal,
          linkedAccountId: category.linkedAccountId,
        });
      }

      await storage.createAccount({
        id: account.id,
        budgetId: account.budgetId,
        name: account.name,
        type: account.type,
        balance: account.balance,
        isActive: account.isActive,
        interestRate: account.interestRate,
        monthlyPayment: account.monthlyPayment,
        originalBalance: account.originalBalance,
        loanStartDate: account.loanStartDate,
        linkedCategoryId: account.linkedCategoryId,
      });

      // Create opening balance transaction in the same request so the account row
      // is guaranteed to exist before the transaction FK is checked.
      if (openingTransaction) {
        await storage.createTransaction({
          id: openingTransaction.id,
          budgetId: openingTransaction.budgetId,
          accountId: openingTransaction.accountId,
          date: openingTransaction.date,
          payee: openingTransaction.payee,
          amount: openingTransaction.amount,
          memo: openingTransaction.memo,
          cleared: openingTransaction.cleared,
        });
      }

      res.status(201).json({ id: account.id });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/accounts/:id", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const { budgetId, ...updates } = req.body;
      if (!await verifyBudgetOwnership(userId, budgetId)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      await storage.updateAccount(req.params.id, budgetId, updates);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/accounts/:id", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const { budgetId } = req.body;
      if (!await verifyBudgetOwnership(userId, budgetId)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      await storage.deleteAccount(req.params.id, budgetId);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  // ============= TRACKING ACCOUNTS =============
  app.post("/api/tracking-accounts", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      await storage.createTrackingAccount({ ...req.body, userId });
      res.status(201).json({ id: req.body.id });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/tracking-accounts/:id", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      await storage.updateTrackingAccount(req.params.id, userId, req.body);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/tracking-accounts/:id", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      await storage.deleteTrackingAccount(req.params.id, userId);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  // ============= CATEGORY GROUPS =============
  app.post("/api/category-groups", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const { id, budgetId, name } = req.body;
      if (!await verifyBudgetOwnership(userId, budgetId)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      await storage.createCategoryGroup({ id, budgetId, name });
      res.status(201).json({ id });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/category-groups/:id", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const { budgetId, ...updates } = req.body;
      if (!await verifyBudgetOwnership(userId, budgetId)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      await storage.updateCategoryGroup(req.params.id, budgetId, updates);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/category-groups/:id", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const { budgetId } = req.body;
      if (!await verifyBudgetOwnership(userId, budgetId)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      await storage.deleteCategoryGroup(req.params.id, budgetId);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  // ============= CATEGORIES =============
  app.post("/api/categories", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const { id, budgetId, groupId, name, goal, linkedAccountId } = req.body;
      if (!await verifyBudgetOwnership(userId, budgetId)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      if (!await groupInBudget(groupId, budgetId)) {
        return res.status(400).json({ message: "Category group does not belong to this budget" });
      }
      if (linkedAccountId && !await accountInBudget(linkedAccountId, budgetId)) {
        return res.status(400).json({ message: "Account does not belong to this budget" });
      }
      await storage.createCategory({ id, budgetId, groupId, name, goal, linkedAccountId });
      res.status(201).json({ id });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/categories/:id", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const { budgetId, ...updates } = req.body;
      if (!await verifyBudgetOwnership(userId, budgetId)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      if (updates.groupId && !await groupInBudget(updates.groupId, budgetId)) {
        return res.status(400).json({ message: "Category group does not belong to this budget" });
      }
      if (updates.linkedAccountId && !await accountInBudget(updates.linkedAccountId, budgetId)) {
        return res.status(400).json({ message: "Account does not belong to this budget" });
      }
      await storage.updateCategory(req.params.id, budgetId, updates);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/categories/:id", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const { budgetId } = req.body;
      if (!await verifyBudgetOwnership(userId, budgetId)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      await storage.deleteCategory(req.params.id, budgetId);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  // ============= TRANSACTIONS =============

  // Loan payment — creates parent + interest + principal atomically (must be before /:id routes)
  app.post("/api/transactions/loan-payment", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const { paymentTransaction, interestTransaction, principalTransaction, accountUpdates } = req.body;

      if (!await verifyBudgetOwnership(userId, paymentTransaction.budgetId)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // All three transactions must live in the verified budget and reference
      // accounts/categories belonging to it.
      const loanBudgetId = paymentTransaction.budgetId;
      for (const tx of [paymentTransaction, interestTransaction, principalTransaction]) {
        if (!tx) continue;
        if (tx.budgetId !== loanBudgetId) {
          return res.status(400).json({ message: "Transactions must belong to the same budget" });
        }
        if (!await accountInBudget(tx.accountId, loanBudgetId)) {
          return res.status(400).json({ message: "Account does not belong to this budget" });
        }
        if (tx.categoryId && !await categoryInBudget(tx.categoryId, loanBudgetId)) {
          return res.status(400).json({ message: "Category does not belong to this budget" });
        }
      }

      // 1. Parent payment transaction (on checking/savings account)
      await storage.createTransaction({
        id: paymentTransaction.id,
        budgetId: paymentTransaction.budgetId,
        date: paymentTransaction.date,
        payee: paymentTransaction.payee,
        categoryId: paymentTransaction.categoryId,
        accountId: paymentTransaction.accountId,
        amount: paymentTransaction.amount,
        memo: paymentTransaction.memo,
        cleared: paymentTransaction.cleared,
      });

      // 2. Interest charge on loan (account row guaranteed to exist already)
      if (interestTransaction) {
        await storage.createTransaction({
          id: interestTransaction.id,
          budgetId: interestTransaction.budgetId,
          date: interestTransaction.date,
          payee: interestTransaction.payee,
          accountId: interestTransaction.accountId,
          amount: interestTransaction.amount,
          memo: interestTransaction.memo,
          cleared: interestTransaction.cleared,
          autoGeneratedById: interestTransaction.autoGeneratedById,
        });
      }

      // 3. Principal payment on loan
      if (principalTransaction) {
        await storage.createTransaction({
          id: principalTransaction.id,
          budgetId: principalTransaction.budgetId,
          date: principalTransaction.date,
          payee: principalTransaction.payee,
          accountId: principalTransaction.accountId,
          amount: principalTransaction.amount,
          memo: principalTransaction.memo,
          cleared: principalTransaction.cleared,
          autoGeneratedById: principalTransaction.autoGeneratedById,
        });
      }

      // 4. Update all account balances (paying account + loan account)
      if (accountUpdates?.length) {
        for (const au of accountUpdates) {
          const updateData: Record<string, unknown> = { balance: au.balance };
          if (au.isActive !== undefined) updateData.isActive = au.isActive;
          await storage.updateAccount(au.id, paymentTransaction.budgetId, updateData);
        }
      }

      res.status(201).json({ id: paymentTransaction.id });
    } catch (error) {
      next(error);
    }
  });

  // Loan payment update — patches parent + both auto-generated children atomically
  app.patch("/api/transactions/:id/loan-payment", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const { budgetId, updates, interestTransactionId, interestUpdates,
              principalTransactionId, principalUpdates, accountUpdates } = req.body;

      if (!await verifyBudgetOwnership(userId, budgetId)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      for (const u of [updates, interestUpdates, principalUpdates]) {
        if (u?.accountId && !await accountInBudget(u.accountId, budgetId)) {
          return res.status(400).json({ message: "Account does not belong to this budget" });
        }
        if (u?.categoryId && !await categoryInBudget(u.categoryId, budgetId)) {
          return res.status(400).json({ message: "Category does not belong to this budget" });
        }
      }

      await storage.updateTransaction(req.params.id, budgetId, updates);

      if (interestTransactionId && interestUpdates) {
        const dbInterest: Record<string, unknown> = { ...interestUpdates };
        if (typeof dbInterest.amount === 'number') dbInterest.amount = String(dbInterest.amount);
        await storage.updateTransaction(interestTransactionId, budgetId, dbInterest);
      }
      if (principalTransactionId && principalUpdates) {
        const dbPrincipal: Record<string, unknown> = { ...principalUpdates };
        if (typeof dbPrincipal.amount === 'number') dbPrincipal.amount = String(dbPrincipal.amount);
        await storage.updateTransaction(principalTransactionId, budgetId, dbPrincipal);
      }
      if (accountUpdates?.length) {
        for (const au of accountUpdates) {
          const updateData: Record<string, unknown> = { balance: au.balance };
          if (au.isActive !== undefined) updateData.isActive = au.isActive;
          await storage.updateAccount(au.id, budgetId, updateData);
        }
      }

      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/transactions", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const parsed = parseBody(createTransactionBodySchema, req.body);
      if (parsed.error !== undefined) {
        return res.status(400).json({ message: parsed.error });
      }
      const { transaction, accountUpdate } = parsed.data;
      if (!await verifyBudgetOwnership(userId, transaction.budgetId)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      if (!await accountInBudget(transaction.accountId, transaction.budgetId)) {
        return res.status(400).json({ message: "Account does not belong to this budget" });
      }
      if (transaction.categoryId && !await categoryInBudget(transaction.categoryId, transaction.budgetId)) {
        return res.status(400).json({ message: "Category does not belong to this budget" });
      }
      await storage.createTransaction({
        ...transaction,
        categoryId: transaction.categoryId ?? undefined,
        memo: transaction.memo ?? undefined,
        autoGeneratedById: transaction.autoGeneratedById ?? undefined,
      });
      // Also update the account balance
      if (accountUpdate) {
        await storage.updateAccount(accountUpdate.id, transaction.budgetId, { balance: accountUpdate.balance });
      }
      res.status(201).json({ id: transaction.id });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/transactions/:id", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const { budgetId, updates, accountUpdates } = req.body;
      if (!await verifyBudgetOwnership(userId, budgetId)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      if (updates?.accountId && !await accountInBudget(updates.accountId, budgetId)) {
        return res.status(400).json({ message: "Account does not belong to this budget" });
      }
      if (updates?.categoryId && !await categoryInBudget(updates.categoryId, budgetId)) {
        return res.status(400).json({ message: "Category does not belong to this budget" });
      }
      await storage.updateTransaction(req.params.id, budgetId, updates);
      // Update affected account balances
      if (accountUpdates) {
        for (const au of accountUpdates) {
          await storage.updateAccount(au.id, budgetId, { balance: au.balance });
        }
      }
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/transactions/:id", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const { budgetId, pairedTransactionId, linkedTransactionIds, accountUpdates } = req.body;
      if (!await verifyBudgetOwnership(userId, budgetId)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      // Delete linked children first (avoids any potential FK constraint issues)
      if (linkedTransactionIds?.length) {
        for (const lid of linkedTransactionIds) {
          await storage.deleteTransaction(lid, budgetId);
        }
      }
      await storage.deleteTransaction(req.params.id, budgetId);
      if (pairedTransactionId) {
        await storage.deleteTransaction(pairedTransactionId, budgetId);
      }
      // Update affected account balances (includes isActive for loan auto-close reversal)
      if (accountUpdates) {
        for (const au of accountUpdates) {
          const updateData: Record<string, unknown> = { balance: au.balance };
          if (au.isActive !== undefined) updateData.isActive = au.isActive;
          await storage.updateAccount(au.id, budgetId, updateData);
        }
      }
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  // ============= MONTHLY ASSIGNMENTS =============
  app.put("/api/assignments", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const parsed = parseBody(upsertAssignmentSchema, req.body);
      if (parsed.error !== undefined) {
        return res.status(400).json({ message: parsed.error });
      }
      const { budgetId, monthKey, categoryId, amount } = parsed.data;
      if (!await verifyBudgetOwnership(userId, budgetId)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      await storage.upsertAssignment({ budgetId, monthKey, categoryId, amount });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/assignments/bulk", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const parsed = parseBody(bulkAssignmentsSchema, req.body);
      if (parsed.error !== undefined) {
        return res.status(400).json({ message: parsed.error });
      }
      const { budgetId, assignments } = parsed.data;
      if (!await verifyBudgetOwnership(userId, budgetId)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      await storage.upsertAssignmentsBulk(
        assignments.map((a) => ({ ...a, budgetId }))
      );
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  // ============= BUDGET TEMPLATES =============
  app.post("/api/budget-templates", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      await storage.createBudgetTemplate({ ...req.body, userId });
      res.status(201).json({ id: req.body.id });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/budget-templates/:id", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      await storage.updateBudgetTemplate(req.params.id, userId, req.body);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/budget-templates/:id", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      await storage.deleteBudgetTemplate(req.params.id, userId);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  // ============= BILL REMINDERS =============
  app.post("/api/bill-reminders", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const { budgetId, ...data } = req.body;
      if (!await verifyBudgetOwnership(userId, budgetId)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      if (data.categoryId && !await categoryInBudget(data.categoryId, budgetId)) {
        return res.status(400).json({ message: "Category does not belong to this budget" });
      }
      if (data.accountId && !await accountInBudget(data.accountId, budgetId)) {
        return res.status(400).json({ message: "Account does not belong to this budget" });
      }
      await storage.createBillReminder({ ...data, budgetId });
      res.status(201).json({ id: data.id });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/bill-reminders/:id", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const { budgetId, ...updates } = req.body;
      if (!await verifyBudgetOwnership(userId, budgetId)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      if (updates.categoryId && !await categoryInBudget(updates.categoryId, budgetId)) {
        return res.status(400).json({ message: "Category does not belong to this budget" });
      }
      if (updates.accountId && !await accountInBudget(updates.accountId, budgetId)) {
        return res.status(400).json({ message: "Account does not belong to this budget" });
      }
      await storage.updateBillReminder(req.params.id, budgetId, updates);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/bill-reminders/:id", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const { budgetId } = req.body;
      if (!await verifyBudgetOwnership(userId, budgetId)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      await storage.deleteBillReminder(req.params.id, budgetId);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  return httpServer;
}
