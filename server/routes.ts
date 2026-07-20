import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateResetToken } from "./auth";
import { hashPassword, verifyPassword } from "./password";
import { sendPasswordResetEmail } from "./email";
import { eq, inArray } from "drizzle-orm";
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
async function verifyBudgetOwnership(userId: string, budgetId: string): Promise<boolean> {
  const result = await db.select({ id: budgets.id })
    .from(budgets)
    .where(eq(budgets.id, budgetId))
    .limit(1);
  return result.length > 0 && (await db.select({ userId: budgets.userId }).from(budgets).where(eq(budgets.id, budgetId)).limit(1))[0]?.userId === userId;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ============= HEALTH =============
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // ============= AUTH =============
  app.get("/api/auth/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json(req.user);
  });

  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email address" });
      }
      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }

      const normalizedEmail = email.toLowerCase().trim();
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

  app.post("/api/auth/login", async (req, res, next) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const normalizedEmail = email.toLowerCase().trim();
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

  app.post("/api/auth/forgot-password", async (req, res, next) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const token = generateResetToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Always return success to avoid email enumeration
      await storage.setResetToken(normalizedEmail, token, expiresAt);

      const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
      const resetUrl = `${baseUrl}/reset-password?token=${token}`;
      await sendPasswordResetEmail(normalizedEmail, resetUrl);

      res.json({ message: "If an account exists with that email, a reset link has been sent." });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/reset-password", async (req, res, next) => {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        return res.status(400).json({ message: "Token and password are required" });
      }
      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }

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
      const { transaction, accountUpdate } = req.body;
      if (!await verifyBudgetOwnership(userId, transaction.budgetId)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      await storage.createTransaction(transaction);
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
      const { budgetId, monthKey, categoryId, amount } = req.body;
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
      const { budgetId, assignments } = req.body;
      if (!await verifyBudgetOwnership(userId, budgetId)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      await storage.upsertAssignmentsBulk(
        assignments.map((a: any) => ({ ...a, budgetId }))
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
