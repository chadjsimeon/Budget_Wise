import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { hashPassword } from "./auth";
import passport from "passport";
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

  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }
      req.logIn(user, (loginErr) => {
        if (loginErr) return next(loginErr);
        res.json(user);
      });
    })(req, res, next);
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

  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }
      if (username.length < 3) {
        return res.status(400).json({ message: "Username must be at least 3 characters" });
      }
      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(409).json({ message: "Username already taken" });
      }

      const hashedPassword = hashPassword(password);
      const user = await storage.createUser({ username, password: hashedPassword });

      // Create a default budget for the new user
      const budgetId = crypto.randomUUID();
      await storage.createBudget({
        id: budgetId,
        userId: user.id,
        name: "My Budget",
        currency: "TTD",
        currencyPlacement: "before",
        numberFormat: "1,234.56",
        dateFormat: "DD/MM/YYYY",
      });

      // Auto-login after registration
      req.logIn({ id: user.id, username: user.username }, (loginErr) => {
        if (loginErr) return next(loginErr);
        res.status(201).json({ id: user.id, username: user.username });
      });
    } catch (error) {
      next(error);
    }
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
