import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { format } from 'date-fns';

export type AccountType = 'checking' | 'savings' | 'credit' | 'loan';
export type TrackingAccountType = 'asset' | 'liability';

export interface Budget {
  id: string;
  name: string;
  createdAt: Date;
  currency: string;
  currencyPlacement: 'before' | 'after';
  numberFormat: '1,234.56' | '1.234,56' | '1 234.56' | '1 234,56';
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
}

export interface Account {
  id: string;
  budgetId: string;
  name: string;
  type: AccountType;
  balance: number;
  isActive: boolean;
}

export interface TrackingAccount {
  id: string;
  name: string;
  type: TrackingAccountType;
  balance: number;
  notes?: string;
}

export interface Asset {
  id: string;
  name: string;
  value: number;
  type: 'property' | 'vehicle' | 'investment' | 'other';
}

export interface CategoryGroup {
  id: string;
  budgetId: string;
  name: string;
}

export interface Category {
  id: string;
  budgetId: string;
  groupId: string;
  name: string;
  goal?: number; // Monthly target amount
}

export interface Transaction {
  id: string;
  budgetId: string;
  date: string;
  payee: string;
  categoryId?: string;
  accountId: string;
  amount: number;
  memo?: string;
  cleared: boolean;
}

export interface BudgetTemplate {
  id: string;
  name: string;
  isDefault: boolean;
  goals: {
    [categoryId: string]: number;
  };
  createdAt: Date;
}

export interface MonthlyAssignments {
  [budgetId: string]: {
    [monthKey: string]: {
      [categoryId: string]: number;
    };
  };
}

interface AppState {
  budgets: Budget[];
  currentBudgetId: string;
  accounts: Account[];
  trackingAccounts: TrackingAccount[];
  assets: Asset[];
  categoryGroups: CategoryGroup[];
  categories: Category[];
  transactions: Transaction[];
  monthlyAssignments: MonthlyAssignments;
  budgetTemplates: BudgetTemplate[];
  currentMonth: string;

  // Budget Actions
  addBudget: (budget: Omit<Budget, 'id' | 'createdAt'>) => void;
  switchBudget: (budgetId: string) => void;
  deleteBudget: (budgetId: string) => void;
  updateBudget: (budgetId: string, updates: Partial<Budget>) => void;

  // Month Actions
  setMonth: (month: string) => void;

  // Account Actions (Budget-specific)
  addAccount: (account: Omit<Account, 'id' | 'budgetId'>) => void;
  updateAccount: (id: string, updates: Partial<Account>) => void;
  deleteAccount: (id: string) => void;

  // Tracking Account Actions
  addTrackingAccount: (account: Omit<TrackingAccount, 'id'>) => void;
  updateTrackingAccount: (id: string, updates: Partial<TrackingAccount>) => void;
  deleteTrackingAccount: (id: string) => void;

  // Asset Actions (deprecated - use tracking accounts)
  addAsset: (asset: Omit<Asset, 'id'>) => void;
  updateAsset: (id: string, updates: Partial<Asset>) => void;
  deleteAsset: (id: string) => void;

  // Transaction Actions
  addTransaction: (transaction: Omit<Transaction, 'id' | 'budgetId'>) => void;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;

  // Category Actions
  addCategory: (category: Omit<Category, 'id' | 'budgetId'>) => void;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  deleteCategory: (id: string) => void;
  setCategoryGoal: (categoryId: string, goal: number) => void;
  addCategoryGroup: (group: Omit<CategoryGroup, 'id' | 'budgetId'>) => void;
  updateCategoryGroup: (id: string, updates: Partial<CategoryGroup>) => void;
  deleteCategoryGroup: (id: string) => void;

  // Budget Assignment Actions
  setCategoryAssignment: (month: string, categoryId: string, amount: number) => void;
  moveMoney: (fromCategoryId: string, toCategoryId: string, amount: number, month: string) => void;

  // Budget Templates
  addBudgetTemplate: (template: Omit<BudgetTemplate, 'id' | 'createdAt'>) => void;
  updateBudgetTemplate: (id: string, updates: Partial<BudgetTemplate>) => void;
  deleteBudgetTemplate: (id: string) => void;
  applyBudgetTemplate: (templateId: string, month: string) => void;
  saveCurrentAsTemplate: (name: string, isDefault?: boolean) => void;

  // Getters
  getAccountBalance: (accountId: string) => number;
  getCategoryActivity: (month: string, categoryId: string) => number;
  getCategoryAvailable: (month: string, categoryId: string) => number;
  getReadyToAssign: (month: string) => number;
  getNetWorth: () => number;
}

// Initial Mock Data
const DEFAULT_BUDGET_ID = 'budget1';

const INITIAL_BUDGETS: Budget[] = [
  {
    id: DEFAULT_BUDGET_ID,
    name: 'My Budget',
    createdAt: new Date('2025-01-01'),
    currency: 'TTD',
    currencyPlacement: 'before',
    numberFormat: '1,234.56',
    dateFormat: 'DD/MM/YYYY'
  },
];

const INITIAL_ACCOUNTS: Account[] = [];

const INITIAL_TRACKING_ACCOUNTS: TrackingAccount[] = [];

const INITIAL_ASSETS: Asset[] = [];

const INITIAL_GROUPS: CategoryGroup[] = [];

const INITIAL_CATEGORIES: Category[] = [];

const INITIAL_TRANSACTIONS: Transaction[] = [];

const INITIAL_ASSIGNMENTS: MonthlyAssignments = {};

const STORAGE_VERSION = 3; // Increment this to reset all data

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      budgets: INITIAL_BUDGETS,
      currentBudgetId: DEFAULT_BUDGET_ID,
      accounts: INITIAL_ACCOUNTS,
      trackingAccounts: INITIAL_TRACKING_ACCOUNTS,
      assets: INITIAL_ASSETS,
      categoryGroups: INITIAL_GROUPS,
      categories: INITIAL_CATEGORIES,
      transactions: INITIAL_TRANSACTIONS,
      monthlyAssignments: INITIAL_ASSIGNMENTS,
      budgetTemplates: [],
      currentMonth: format(new Date(), 'yyyy-MM'),

      // ============= BUDGETS =============
      addBudget: (budget) => set((state) => {
        const newBudget: Budget = {
          ...budget,
          id: Math.random().toString(36).substr(2, 9),
          createdAt: new Date()
        };
        return {
          budgets: [...state.budgets, newBudget],
          currentBudgetId: newBudget.id
        };
      }),

      switchBudget: (budgetId) => set({ currentBudgetId: budgetId }),

      updateBudget: (budgetId, updates) => set((state) => ({
        budgets: state.budgets.map(b => b.id === budgetId ? { ...b, ...updates } : b)
      })),

      deleteBudget: (budgetId) => set((state) => {
        // Prevent deleting the last budget (UI should prevent this, but double-check)
        if (state.budgets.length <= 1) {
          return state;
        }

        const remainingBudgets = state.budgets.filter(b => b.id !== budgetId);
        const newCurrentId = state.currentBudgetId === budgetId ? remainingBudgets[0].id : state.currentBudgetId;

        // Remove budget's assignments
        const { [budgetId]: removed, ...remainingAssignments } = state.monthlyAssignments;

        return {
          budgets: remainingBudgets,
          currentBudgetId: newCurrentId,
          // Clean up all budget-related data
          accounts: state.accounts.filter(a => a.budgetId !== budgetId),
          categoryGroups: state.categoryGroups.filter(g => g.budgetId !== budgetId),
          categories: state.categories.filter(c => c.budgetId !== budgetId),
          transactions: state.transactions.filter(t => t.budgetId !== budgetId),
          monthlyAssignments: remainingAssignments
        };
      }),

      // ============= MONTH =============
      setMonth: (month) => set({ currentMonth: month }),

      // ============= ACCOUNTS =============
      addAccount: (account) => set((state) => ({
        accounts: [...state.accounts, {
          ...account,
          id: Math.random().toString(36).substr(2, 9),
          budgetId: state.currentBudgetId,
          isActive: true
        }]
      })),

      updateAccount: (id, updates) => set((state) => ({
        accounts: state.accounts.map(a => a.id === id ? { ...a, ...updates } : a)
      })),

      deleteAccount: (id) => set((state) => ({
        accounts: state.accounts.filter(a => a.id !== id),
        transactions: state.transactions.filter(t => t.accountId !== id)
      })),

      // ============= TRACKING ACCOUNTS =============
      addTrackingAccount: (account) => set((state) => ({
        trackingAccounts: [...state.trackingAccounts, {
          ...account,
          id: Math.random().toString(36).substr(2, 9)
        }]
      })),

      updateTrackingAccount: (id, updates) => set((state) => ({
        trackingAccounts: state.trackingAccounts.map(a => a.id === id ? { ...a, ...updates } : a)
      })),

      deleteTrackingAccount: (id) => set((state) => ({
        trackingAccounts: state.trackingAccounts.filter(a => a.id !== id)
      })),

      // ============= ASSETS (Deprecated - use tracking accounts) =============
      addAsset: (asset) => set((state) => ({
        assets: [...state.assets, { ...asset, id: Math.random().toString(36).substr(2, 9) }]
      })),

      updateAsset: (id, updates) => set((state) => ({
        assets: state.assets.map(a => a.id === id ? { ...a, ...updates } : a)
      })),

      deleteAsset: (id) => set((state) => ({
        assets: state.assets.filter(a => a.id !== id)
      })),

      // ============= TRANSACTIONS =============
      addTransaction: (transaction) => set((state) => {
        const newTx = {
          ...transaction,
          id: Math.random().toString(36).substr(2, 9),
          budgetId: state.currentBudgetId
        };
        
        const updatedAccounts = state.accounts.map(acc => {
          if (acc.id === transaction.accountId) {
            const newBalance = acc.balance + transaction.amount;
            
            // 🎉 AUTO-CLOSE LOANS FEATURE
            if (acc.type === 'loan' && newBalance >= 0) {
              console.log(`🎉 Loan "${acc.name}" paid off! Auto-closing.`);
              return { ...acc, balance: newBalance, isActive: false };
            }
            
            return { ...acc, balance: newBalance };
          }
          return acc;
        });
        
        return {
          transactions: [newTx, ...state.transactions],
          accounts: updatedAccounts
        };
      }),

      updateTransaction: (id, updates) => set((state) => {
        const oldTx = state.transactions.find(t => t.id === id);
        if (!oldTx) return state;
        
        let updatedAccounts = state.accounts.map(acc => 
          acc.id === oldTx.accountId 
            ? { ...acc, balance: acc.balance - oldTx.amount }
            : acc
        );
        
        const newTx = { ...oldTx, ...updates };
        
        updatedAccounts = updatedAccounts.map(acc => {
          if (acc.id === newTx.accountId) {
            const newBalance = acc.balance + newTx.amount;
            
            if (acc.type === 'loan' && newBalance >= 0 && acc.isActive) {
              console.log(`🎉 Loan "${acc.name}" paid off!`);
              return { ...acc, balance: newBalance, isActive: false };
            }
            
            return { ...acc, balance: newBalance };
          }
          return acc;
        });
        
        return {
          transactions: state.transactions.map(t => t.id === id ? newTx : t),
          accounts: updatedAccounts
        };
      }),

      deleteTransaction: (id) => set((state) => {
        const tx = state.transactions.find(t => t.id === id);
        if (!tx) return state;
        
        const updatedAccounts = state.accounts.map(acc => {
          if (acc.id === tx.accountId) {
            const newBalance = acc.balance - tx.amount;
            
            // Reactivate loan if it goes back into debt
            if (acc.type === 'loan' && !acc.isActive && newBalance < 0) {
              console.log(`🔄 Reactivating "${acc.name}"`);
              return { ...acc, balance: newBalance, isActive: true };
            }
            
            return { ...acc, balance: newBalance };
          }
          return acc;
        });
        
        return {
          transactions: state.transactions.filter(t => t.id !== id),
          accounts: updatedAccounts
        };
      }),

      // ============= CATEGORIES =============
      addCategory: (category) => set((state) => ({
        categories: [...state.categories, {
          ...category,
          id: Math.random().toString(36).substr(2, 9),
          budgetId: state.currentBudgetId
        }]
      })),

      updateCategory: (id, updates) => set((state) => ({
        categories: state.categories.map(c => c.id === id ? { ...c, ...updates } : c)
      })),

      setCategoryGoal: (categoryId, goal) => set((state) => ({
        categories: state.categories.map(c =>
          c.id === categoryId ? { ...c, goal } : c
        )
      })),

      deleteCategory: (id) => set((state) => ({
        categories: state.categories.filter(c => c.id !== id),
        monthlyAssignments: Object.fromEntries(
          Object.entries(state.monthlyAssignments).map(([month, assignments]) => [
            month,
            Object.fromEntries(Object.entries(assignments).filter(([catId]) => catId !== id))
          ])
        )
      })),

      addCategoryGroup: (group) => set((state) => ({
        categoryGroups: [...state.categoryGroups, {
          ...group,
          id: Math.random().toString(36).substr(2, 9),
          budgetId: state.currentBudgetId
        }]
      })),

      updateCategoryGroup: (id, updates) => set((state) => ({
        categoryGroups: state.categoryGroups.map(g => g.id === id ? { ...g, ...updates} : g)
      })),

      deleteCategoryGroup: (id) => set((state) => ({
        categoryGroups: state.categoryGroups.filter(g => g.id !== id),
        categories: state.categories.filter(c => c.groupId !== id)
      })),

      // ============= BUDGET =============
      setCategoryAssignment: (month, categoryId, amount) => set((state) => {
        const budgetId = state.currentBudgetId;
        const budgetAssignments = state.monthlyAssignments[budgetId] || {};

        return {
          monthlyAssignments: {
            ...state.monthlyAssignments,
            [budgetId]: {
              ...budgetAssignments,
              [month]: {
                ...(budgetAssignments[month] || {}),
                [categoryId]: amount
              }
            }
          }
        };
      }),

      moveMoney: (fromCategoryId, toCategoryId, amount, month) => set((state) => {
        const budgetId = state.currentBudgetId;
        const budgetAssignments = state.monthlyAssignments[budgetId] || {};
        const currentAssignments = budgetAssignments[month] || {};
        const fromAmount = currentAssignments[fromCategoryId] || 0;
        const toAmount = currentAssignments[toCategoryId] || 0;

        return {
          monthlyAssignments: {
            ...state.monthlyAssignments,
            [budgetId]: {
              ...budgetAssignments,
              [month]: {
                ...currentAssignments,
                [fromCategoryId]: fromAmount - amount,
                [toCategoryId]: toAmount + amount
              }
            }
          }
        };
      }),

      // ============= BUDGET TEMPLATES =============
      addBudgetTemplate: (template) => set((state) => {
        const newTemplate = {
          ...template,
          id: Math.random().toString(36).substr(2, 9),
          createdAt: new Date()
        };

        // If this is set as default, unset other defaults
        const updatedTemplates = template.isDefault
          ? state.budgetTemplates.map(t => ({ ...t, isDefault: false }))
          : state.budgetTemplates;

        return {
          budgetTemplates: [...updatedTemplates, newTemplate]
        };
      }),

      updateBudgetTemplate: (id, updates) => set((state) => {
        const updatedTemplates = state.budgetTemplates.map(t => {
          if (t.id === id) {
            return { ...t, ...updates };
          }
          // If we're setting a new default, unset others
          if (updates.isDefault === true && t.isDefault) {
            return { ...t, isDefault: false };
          }
          return t;
        });

        return { budgetTemplates: updatedTemplates };
      }),

      deleteBudgetTemplate: (id) => set((state) => ({
        budgetTemplates: state.budgetTemplates.filter(t => t.id !== id)
      })),

      applyBudgetTemplate: (templateId, month) => set((state) => {
        const template = state.budgetTemplates.find(t => t.id === templateId);
        if (!template) return state;

        // Apply template goals to category assignments for the month
        const assignments = { ...template.goals };
        const budgetId = state.currentBudgetId;
        const budgetAssignments = state.monthlyAssignments[budgetId] || {};

        return {
          monthlyAssignments: {
            ...state.monthlyAssignments,
            [budgetId]: {
              ...budgetAssignments,
              [month]: assignments
            }
          }
        };
      }),

      saveCurrentAsTemplate: (name, isDefault = false) => set((state) => {
        // Get current month's goals from categories
        const goals: { [key: string]: number } = {};
        state.categories.forEach(cat => {
          if (cat.goal && cat.goal > 0) {
            goals[cat.id] = cat.goal;
          }
        });

        const newTemplate = {
          id: Math.random().toString(36).substr(2, 9),
          name,
          isDefault,
          goals,
          createdAt: new Date()
        };

        // If this is set as default, unset other defaults
        const updatedTemplates = isDefault
          ? state.budgetTemplates.map(t => ({ ...t, isDefault: false }))
          : state.budgetTemplates;

        return {
          budgetTemplates: [...updatedTemplates, newTemplate]
        };
      }),

      // ============= GETTERS =============
      getAccountBalance: (accountId) => {
        const state = get();
        return state.accounts.find(a => a.id === accountId)?.balance || 0;
      },

      getCategoryActivity: (month, categoryId) => {
        const state = get();
        return state.transactions
          .filter(t =>
            t.budgetId === state.currentBudgetId &&
            t.categoryId === categoryId &&
            t.date.startsWith(month)
          )
          .reduce((sum, t) => sum + t.amount, 0);
      },

      getCategoryAvailable: (month, categoryId) => {
        const state = get();
        const budgetAssignments = state.monthlyAssignments[state.currentBudgetId] || {};
        const assigned = budgetAssignments[month]?.[categoryId] || 0;
        const activity = get().getCategoryActivity(month, categoryId);
        return assigned + activity;
      },

      getReadyToAssign: (month) => {
        const state = get();

        // Only count ACTIVE accounts in current budget
        const totalAccountBalance = state.accounts
          .filter(a => a.isActive && a.budgetId === state.currentBudgetId)
          .reduce((sum, a) => sum + a.balance, 0);

        const budgetAssignments = state.monthlyAssignments[state.currentBudgetId] || {};
        const assignments = budgetAssignments[month] || {};
        const totalAssigned = Object.values(assignments).reduce((sum, val) => sum + val, 0);

        return totalAccountBalance - totalAssigned;
      },

      getNetWorth: () => {
        const state = get();
        // Budget accounts
        const budgetAccountsTotal = state.accounts
          .filter(a => a.budgetId === state.currentBudgetId)
          .reduce((sum, a) => sum + a.balance, 0);

        // Tracking accounts
        const trackingAccountsTotal = state.trackingAccounts
          .reduce((sum, a) => sum + (a.type === 'asset' ? a.balance : -a.balance), 0);

        // Legacy assets (deprecated)
        const assetsTotal = state.assets.reduce((sum, a) => sum + a.value, 0);

        return budgetAccountsTotal + trackingAccountsTotal + assetsTotal;
      }
    }),
    {
      name: 'zerobased-storage',
      version: STORAGE_VERSION,
      partialize: (state) => ({
        budgets: state.budgets,
        currentBudgetId: state.currentBudgetId,
        accounts: state.accounts,
        trackingAccounts: state.trackingAccounts,
        assets: state.assets,
        categoryGroups: state.categoryGroups,
        categories: state.categories,
        transactions: state.transactions,
        monthlyAssignments: state.monthlyAssignments,
        budgetTemplates: state.budgetTemplates,
        currentMonth: state.currentMonth,
      }),
      migrate: (persistedState: any, version: number) => {
        // If version doesn't match, return undefined to force initial state
        if (version !== STORAGE_VERSION) {
          // Clear localStorage to force fresh data
          if (typeof window !== 'undefined') {
            localStorage.removeItem('zerobased-storage');
          }
          return undefined;
        }
        return persistedState;
      },
    }
  )
);