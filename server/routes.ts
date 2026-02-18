import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // put application routes here
  // prefix all routes with /api

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

      // Transform monthly assignments from flat array → nested object
      // { [budgetId]: { [monthKey]: { [categoryId]: amount } } }
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

  return httpServer;
}
