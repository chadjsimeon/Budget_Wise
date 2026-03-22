import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { sendOtpEmail } from "./email";
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

  // ============= AUTH =============
  app.get("/api/auth/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json(req.user);
  });

  app.post("/api/auth/request-otp", async (req, res, next) => {
    try {
      const { email } = req.body;

      if (!email || typeof email !== "string") {
        return res.status(400).json({ message: "Email is required" });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email address" });
      }

      const normalizedEmail = email.toLowerCase().trim();

      // Rate limit: max 5 OTPs per email per 15 minutes
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      const recentCount = await storage.countRecentOtps(normalizedEmail, fifteenMinutesAgo);
      if (recentCount >= 5) {
        return res.status(429).json({ message: "Too many requests. Please try again later." });
      }

      // Invalidate any existing unused OTPs
      await storage.invalidateOtpsForEmail(normalizedEmail);

      // Generate 6-digit code
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      await storage.createOtp({ email: normalizedEmail, code, expiresAt });
      await sendOtpEmail(normalizedEmail, code);

      res.json({ message: "Verification code sent" });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/verify-otp", async (req, res, next) => {
    try {
      const { email, code } = req.body;

      if (!email || !code) {
        return res.status(400).json({ message: "Email and code are required" });
      }

      const normalizedEmail = email.toLowerCase().trim();

      const otp = await storage.getValidOtp(normalizedEmail);
      if (!otp) {
        return res.status(401).json({ message: "Code expired or not found. Please request a new one." });
      }

      // Check max attempts (5)
      const attempts = await storage.incrementOtpAttempts(otp.id);
      if (attempts > 5) {
        await storage.markOtpUsed(otp.id);
        return res.status(401).json({ message: "Too many attempts. Please request a new code." });
      }

      if (otp.code !== code) {
        return res.status(401).json({ message: "Invalid code. Please try again." });
      }

      // Mark OTP as used
      await storage.markOtpUsed(otp.id);

      // Find or create user
      let user = await storage.getUserByEmail(normalizedEmail);
      if (!user) {
        user = await storage.createUser({ email: normalizedEmail });

        // Create a default budget for new users
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
      }

      // Log the user in via passport session
      req.logIn({ id: user.id, email: user.email }, (loginErr) => {
        if (loginErr) return next(loginErr);
        res.json({ id: user.id, email: user.email });
      });
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
      ] = await Promise.all([
        db.select().from(accounts).where(inArray(accounts.budgetId, budgetIds)),
        db.select().from(trackingAccounts).where(eq(trackingAccounts.userId, userId)),
        db.select().from(categoryGroups).where(inArray(categoryGroups.budgetId, budgetIds)),
        db.select().from(categories).where(inArray(categories.budgetId, budgetIds)),
        db.select().from(transactions).where(inArray(transactions.budgetId, budgetIds)),
        db.select().from(monthlyAssignments).where(inArray(monthlyAssignments.budgetId, budgetIds)),
        db.select().from(budgetTemplates).where(eq(budgetTemplates.userId, userId)),
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
        })),
        monthlyAssignments: assignmentsMap,
        budgetTemplates: userBudgetTemplates.map((bt) => ({
          id: bt.id,
          name: bt.name,
          isDefault: bt.isDefault,
          goals: bt.goals as Record<string, number>,
          createdAt: bt.createdAt,
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

  // ============= ACCOUNTS =============
  app.post("/api/accounts", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const { account, category, categoryGroup } = req.body;

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
      const { budgetId, pairedTransactionId, accountUpdates } = req.body;
      if (!await verifyBudgetOwnership(userId, budgetId)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      await storage.deleteTransaction(req.params.id, budgetId);
      if (pairedTransactionId) {
        await storage.deleteTransaction(pairedTransactionId, budgetId);
      }
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

  return httpServer;
}
