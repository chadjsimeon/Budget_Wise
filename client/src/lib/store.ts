import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';

let syncErrorShown = false;

async function syncToServer(method: string, url: string, data?: unknown) {
  try {
    await apiRequest(method, url, data);
    syncErrorShown = false;
  } catch (err) {
    console.error(`[sync] ${method} ${url} failed:`, err);
    if (!syncErrorShown) {
      syncErrorShown = true;
      toast({
        title: "Sync failed",
        description: "Your changes couldn't be saved to the server. Please check your connection.",
        variant: "destructive",
      });
    }
  }
}

export type AccountType = 'checking' | 'savings' | 'cash' | 'credit' | 'loan';
export type TrackingAccountType = 'asset' | 'liability';

// Account types that contribute to "Ready to Assign" calculation
// Only liquid asset accounts (checking, savings, cash) are included
// Credit cards and loans are excluded as they represent liabilities
export const BUDGET_ACCOUNT_TYPES: readonly AccountType[] = ['checking', 'savings', 'cash'] as const;

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
  // Loan-specific fields
  interestRate?: number;      // Annual percentage rate (e.g., 12.0 for 12%)
  monthlyPayment?: number;    // Required monthly payment amount
  originalBalance?: number;   // Original loan amount (for progress calculation)
  loanStartDate?: string;     // When the loan started (for calculating original schedule)
  linkedCategoryId?: string;  // Links to auto-created category for loan payments
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
  linkedAccountId?: string; // Links back to loan account if auto-created
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
  isOpeningBalance?: boolean;
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

// Shape returned by GET /api/budget-data (dates are ISO strings over JSON)
export interface ServerBudgetData {
  budgets: Array<Omit<Budget, 'createdAt'> & { createdAt: string }>;
  currentBudgetId: string;
  accounts: Account[];
  trackingAccounts: TrackingAccount[];
  categoryGroups: CategoryGroup[];
  categories: Category[];
  transactions: Transaction[];
  monthlyAssignments: MonthlyAssignments;
  budgetTemplates: Array<Omit<BudgetTemplate, 'createdAt'> & { createdAt: string }>;
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
  addAccount: (account: Omit<Account, 'id' | 'budgetId'>, openingBalance?: number) => Account;
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

  // Onboarding
  helpModeEnabled: boolean;
  hasSeenWelcome: boolean;
  toggleHelpMode: () => void;
  dismissWelcome: () => void;

  // Auth
  _hasHydrated: boolean;
  hydrateFromServer: (data: ServerBudgetData) => void;
  clearHydrated: () => void;
  clearState: () => void;
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

// Default category structure for new budgets
const DEFAULT_CATEGORY_STRUCTURE = [
  {
    groupName: 'Bills',
    categories: ['Rent/Mortgage', 'Phone', 'Internet', 'Utilities']
  },
  {
    groupName: 'Needs',
    categories: ['Groceries', 'Transportation', 'Medical expenses', 'Emergency fund']
  },
  {
    groupName: 'Wants',
    categories: [
      'Dining out',
      'Entertainment',
      'Vacation',
      'Stuff I forgot to plan for',
      'Budget Wise subscription'
    ]
  }
];

// Constant for auto-created loan category group
const DEBT_REPAYMENTS_GROUP_NAME = 'Debt Repayments';

const STORAGE_VERSION = 6; // Increment this to reset all data

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
      helpModeEnabled: false,
      hasSeenWelcome: false,
      _hasHydrated: false,

      // ============= ONBOARDING =============
      toggleHelpMode: () => set((state) => ({ helpModeEnabled: !state.helpModeEnabled })),
      dismissWelcome: () => set({ hasSeenWelcome: true }),

      // ============= BUDGETS =============
      addBudget: (budget) => {
        const newBudget: Budget = {
          ...budget,
          id: crypto.randomUUID(),
          createdAt: new Date()
        };

        const newGroups: CategoryGroup[] = DEFAULT_CATEGORY_STRUCTURE.map(template => ({
          id: crypto.randomUUID(),
          budgetId: newBudget.id,
          name: template.groupName
        }));

        const newCategories: Category[] = [];
        DEFAULT_CATEGORY_STRUCTURE.forEach((template, idx) => {
          const groupId = newGroups[idx].id;
          template.categories.forEach(categoryName => {
            newCategories.push({
              id: crypto.randomUUID(),
              budgetId: newBudget.id,
              groupId: groupId,
              name: categoryName
            });
          });
        });

        set((state) => ({
          budgets: [...state.budgets, newBudget],
          currentBudgetId: newBudget.id,
          categoryGroups: [...state.categoryGroups, ...newGroups],
          categories: [...state.categories, ...newCategories]
        }));

        syncToServer("POST", "/api/budgets", {
          budget: {
            id: newBudget.id,
            name: newBudget.name,
            currency: newBudget.currency,
            currencyPlacement: newBudget.currencyPlacement,
            numberFormat: newBudget.numberFormat,
            dateFormat: newBudget.dateFormat,
          },
          categoryGroups: newGroups,
          categories: newCategories,
        });
      },

      switchBudget: (budgetId) => set({ currentBudgetId: budgetId }),

      updateBudget: (budgetId, updates) => {
        set((state) => ({
          budgets: state.budgets.map(b => b.id === budgetId ? { ...b, ...updates } : b)
        }));
        syncToServer("PATCH", `/api/budgets/${budgetId}`, updates);
      },

      deleteBudget: (budgetId) => {
        const state = get();
        if (state.budgets.length <= 1) return;

        const remainingBudgets = state.budgets.filter(b => b.id !== budgetId);
        const newCurrentId = state.currentBudgetId === budgetId ? remainingBudgets[0].id : state.currentBudgetId;
        const { [budgetId]: removed, ...remainingAssignments } = state.monthlyAssignments;

        set({
          budgets: remainingBudgets,
          currentBudgetId: newCurrentId,
          accounts: state.accounts.filter(a => a.budgetId !== budgetId),
          categoryGroups: state.categoryGroups.filter(g => g.budgetId !== budgetId),
          categories: state.categories.filter(c => c.budgetId !== budgetId),
          transactions: state.transactions.filter(t => t.budgetId !== budgetId),
          monthlyAssignments: remainingAssignments
        });

        syncToServer("DELETE", `/api/budgets/${budgetId}`);
      },

      // ============= MONTH =============
      setMonth: (month) => set({ currentMonth: month }),

      // ============= ACCOUNTS =============
      addAccount: (account, openingBalance) => {
        const currentBudgetId = get().currentBudgetId;
        const newAccount = {
          ...account,
          id: crypto.randomUUID(),
          budgetId: currentBudgetId,
          isActive: true
        };

        let newGroup: CategoryGroup | undefined;
        let newCategory: Category | undefined;

        // Build opening balance transaction locally if a non-zero balance was provided.
        // This is included in the same POST /api/accounts payload so the server creates
        // the account and transaction atomically — avoiding the FK race condition that
        // occurs when two separate fire-and-forget requests are dispatched in sequence.
        let openingTx: Transaction | undefined;
        if (openingBalance !== undefined && openingBalance !== 0) {
          openingTx = {
            id: crypto.randomUUID(),
            budgetId: currentBudgetId,
            accountId: newAccount.id,
            date: format(new Date(), 'yyyy-MM-dd'),
            payee: 'Opening Balance',
            amount: openingBalance,
            memo: `Initial balance for ${account.name}`,
            cleared: true,
            isOpeningBalance: true,
          };
          newAccount.balance = openingBalance;
        }

        if (account.type === 'loan' && account.monthlyPayment && account.monthlyPayment > 0) {
          set((state) => {
            let debtGroupId = state.categoryGroups.find(
              g => g.budgetId === currentBudgetId &&
                   g.name.toLowerCase() === DEBT_REPAYMENTS_GROUP_NAME.toLowerCase()
            )?.id;

            let updatedGroups = state.categoryGroups;

            if (!debtGroupId) {
              debtGroupId = crypto.randomUUID();
              newGroup = {
                id: debtGroupId,
                budgetId: currentBudgetId,
                name: DEBT_REPAYMENTS_GROUP_NAME
              };
              updatedGroups = [...state.categoryGroups, newGroup];
            }

            const categoryId = crypto.randomUUID();
            newCategory = {
              id: categoryId,
              budgetId: currentBudgetId,
              groupId: debtGroupId,
              name: `${account.name} Payment`,
              goal: account.monthlyPayment,
              linkedAccountId: newAccount.id
            };

            newAccount.linkedCategoryId = categoryId;

            return {
              accounts: [...state.accounts, newAccount],
              categoryGroups: updatedGroups,
              categories: [...state.categories, newCategory],
              ...(openingTx ? { transactions: [openingTx, ...state.transactions] } : {}),
            };
          });
        } else {
          set((state) => ({
            accounts: [...state.accounts, newAccount],
            ...(openingTx ? { transactions: [openingTx!, ...state.transactions] } : {}),
          }));
        }

        syncToServer("POST", "/api/accounts", {
          account: {
            id: newAccount.id,
            budgetId: newAccount.budgetId,
            name: newAccount.name,
            type: newAccount.type,
            balance: newAccount.balance,
            isActive: newAccount.isActive,
            interestRate: newAccount.interestRate,
            monthlyPayment: newAccount.monthlyPayment,
            originalBalance: newAccount.originalBalance,
            loanStartDate: newAccount.loanStartDate,
            linkedCategoryId: newAccount.linkedCategoryId,
          },
          categoryGroup: newGroup,
          category: newCategory ? {
            id: newCategory.id,
            budgetId: newCategory.budgetId,
            groupId: newCategory.groupId,
            name: newCategory.name,
            goal: newCategory.goal,
            linkedAccountId: newCategory.linkedAccountId,
          } : undefined,
          openingTransaction: openingTx ? {
            id: openingTx.id,
            budgetId: openingTx.budgetId,
            accountId: openingTx.accountId,
            date: openingTx.date,
            payee: openingTx.payee,
            amount: openingTx.amount,
            memo: openingTx.memo,
            cleared: openingTx.cleared,
            isOpeningBalance: openingTx.isOpeningBalance,
          } : undefined,
        });

        return newAccount;
      },

      updateAccount: (id, updates) => {
        const state = get();
        const account = state.accounts.find(a => a.id === id);
        if (!account) return;

        const updatedAccount = { ...account, ...updates };
        const updatedAccounts = state.accounts.map(a => a.id === id ? updatedAccount : a);

        if (
          account.type === 'loan' &&
          account.linkedCategoryId &&
          updates.monthlyPayment !== undefined
        ) {
          const updatedCategories = state.categories.map(c =>
            c.id === account.linkedCategoryId
              ? { ...c, goal: updates.monthlyPayment }
              : c
          );
          set({ accounts: updatedAccounts, categories: updatedCategories });
        } else if (
          account.type === 'loan' &&
          updates.type &&
          updates.type !== 'loan' &&
          account.linkedCategoryId
        ) {
          const updatedCategories = state.categories.map(c =>
            c.id === account.linkedCategoryId
              ? { ...c, linkedAccountId: undefined }
              : c
          );
          updatedAccount.linkedCategoryId = undefined;
          set({
            accounts: state.accounts.map(a => a.id === id ? updatedAccount : a),
            categories: updatedCategories
          });
        } else {
          set({ accounts: updatedAccounts });
        }

        syncToServer("PATCH", `/api/accounts/${id}`, { budgetId: account.budgetId, ...updates });
      },

      deleteAccount: (id) => {
        const state = get();
        const account = state.accounts.find(a => a.id === id);
        if (!account) return;

        const stateUpdates: Partial<AppState> = {
          accounts: state.accounts.filter(a => a.id !== id),
          transactions: state.transactions.filter(t => t.accountId !== id)
        };

        if (account.linkedCategoryId) {
          stateUpdates.categories = state.categories.filter(c => c.id !== account.linkedCategoryId);
          stateUpdates.monthlyAssignments = Object.fromEntries(
            Object.entries(state.monthlyAssignments).map(([budgetId, budgetAssignments]) => [
              budgetId,
              Object.fromEntries(
                Object.entries(budgetAssignments).map(([monthKey, monthAssignments]) => [
                  monthKey,
                  Object.fromEntries(
                    Object.entries(monthAssignments).filter(([catId]) => catId !== account.linkedCategoryId)
                  )
                ])
              )
            ])
          );
        }

        set(stateUpdates);
        syncToServer("DELETE", `/api/accounts/${id}`, { budgetId: account.budgetId });
      },

      // ============= TRACKING ACCOUNTS =============
      addTrackingAccount: (account) => {
        const newAccount = { ...account, id: crypto.randomUUID() };
        set((state) => ({
          trackingAccounts: [...state.trackingAccounts, newAccount]
        }));
        syncToServer("POST", "/api/tracking-accounts", newAccount);
      },

      updateTrackingAccount: (id, updates) => {
        set((state) => ({
          trackingAccounts: state.trackingAccounts.map(a => a.id === id ? { ...a, ...updates } : a)
        }));
        syncToServer("PATCH", `/api/tracking-accounts/${id}`, updates);
      },

      deleteTrackingAccount: (id) => {
        set((state) => ({
          trackingAccounts: state.trackingAccounts.filter(a => a.id !== id)
        }));
        syncToServer("DELETE", `/api/tracking-accounts/${id}`);
      },

      // ============= ASSETS (Deprecated - use tracking accounts) =============
      addAsset: (asset) => set((state) => ({
        assets: [...state.assets, { ...asset, id: crypto.randomUUID() }]
      })),

      updateAsset: (id, updates) => set((state) => ({
        assets: state.assets.map(a => a.id === id ? { ...a, ...updates } : a)
      })),

      deleteAsset: (id) => set((state) => ({
        assets: state.assets.filter(a => a.id !== id)
      })),

      // ============= TRANSACTIONS =============
      addTransaction: (transaction) => {
        const budgetId = get().currentBudgetId;
        const newTx = {
          ...transaction,
          id: crypto.randomUUID(),
          budgetId
        };

        let newAccountBalance: number | undefined;
        set((state) => {
          const updatedAccounts = state.accounts.map(acc => {
            if (acc.id === transaction.accountId) {
              const newBalance = acc.balance + transaction.amount;
              newAccountBalance = newBalance;
              return { ...acc, balance: newBalance };
            }
            return acc;
          });
          return {
            transactions: [newTx, ...state.transactions],
            accounts: updatedAccounts
          };
        });

        syncToServer("POST", "/api/transactions", {
          transaction: {
            id: newTx.id,
            budgetId: newTx.budgetId,
            date: newTx.date,
            payee: newTx.payee,
            categoryId: newTx.categoryId,
            accountId: newTx.accountId,
            amount: newTx.amount,
            memo: newTx.memo,
            cleared: newTx.cleared,
          },
          accountUpdate: newAccountBalance !== undefined
            ? { id: transaction.accountId, balance: newAccountBalance }
            : undefined,
        });
      },

      updateTransaction: (id, updates) => {
        const state = get();
        const oldTx = state.transactions.find(t => t.id === id);
        if (!oldTx) return;

        let updatedAccounts = state.accounts.map(acc =>
          acc.id === oldTx.accountId
            ? { ...acc, balance: acc.balance - oldTx.amount }
            : acc
        );

        const newTx = { ...oldTx, ...updates };

        updatedAccounts = updatedAccounts.map(acc => {
          if (acc.id === newTx.accountId) {
            return { ...acc, balance: acc.balance + newTx.amount };
          }
          return acc;
        });

        set({
          transactions: state.transactions.map(t => t.id === id ? newTx : t),
          accounts: updatedAccounts
        });

        // Collect affected account balances
        const accountUpdates: Array<{ id: string; balance: number }> = [];
        for (const acc of updatedAccounts) {
          const orig = state.accounts.find(a => a.id === acc.id);
          if (orig && orig.balance !== acc.balance) {
            accountUpdates.push({ id: acc.id, balance: acc.balance });
          }
        }

        syncToServer("PATCH", `/api/transactions/${id}`, {
          budgetId: oldTx.budgetId,
          updates,
          accountUpdates: accountUpdates.length > 0 ? accountUpdates : undefined,
        });
      },

      deleteTransaction: (id) => {
        const state = get();
        const tx = state.transactions.find(t => t.id === id);
        if (!tx) return;

        const isTransfer = tx.payee.startsWith('Transfer to') || tx.payee.startsWith('Transfer from');
        let pairedTransferId: string | null = null;

        if (isTransfer) {
          pairedTransferId = state.transactions.find(t =>
            t.id !== id &&
            t.date === tx.date &&
            t.memo === tx.memo &&
            t.accountId !== tx.accountId &&
            Math.abs(t.amount) === Math.abs(tx.amount) &&
            (
              (tx.payee.startsWith('Transfer to') && t.payee.startsWith('Transfer from')) ||
              (tx.payee.startsWith('Transfer from') && t.payee.startsWith('Transfer to'))
            )
          )?.id || null;
        }

        const pairedTx = pairedTransferId ? state.transactions.find(t => t.id === pairedTransferId) : null;

        const updatedAccounts = state.accounts.map(acc => {
          let newBalance = acc.balance;
          if (acc.id === tx.accountId) {
            newBalance = acc.balance - tx.amount;
          }
          if (pairedTx && acc.id === pairedTx.accountId) {
            newBalance = acc.balance - pairedTx.amount;
          }
          if (acc.id === tx.accountId || (pairedTx && acc.id === pairedTx.accountId)) {
            return { ...acc, balance: newBalance };
          }
          return acc;
        });

        const transactionsToRemove = pairedTransferId ? [id, pairedTransferId] : [id];

        set({
          transactions: state.transactions.filter(t => !transactionsToRemove.includes(t.id)),
          accounts: updatedAccounts
        });

        // Collect affected account balances for the server
        const accountUpdates: Array<{ id: string; balance: number }> = [];
        for (const acc of updatedAccounts) {
          const orig = state.accounts.find(a => a.id === acc.id);
          if (orig && orig.balance !== acc.balance) {
            accountUpdates.push({ id: acc.id, balance: acc.balance });
          }
        }

        syncToServer("DELETE", `/api/transactions/${id}`, {
          budgetId: tx.budgetId,
          pairedTransactionId: pairedTransferId,
          accountUpdates: accountUpdates.length > 0 ? accountUpdates : undefined,
        });
      },

      // ============= CATEGORIES =============
      addCategory: (category) => {
        const budgetId = get().currentBudgetId;
        const newCategory = { ...category, id: crypto.randomUUID(), budgetId };
        set((state) => ({
          categories: [...state.categories, newCategory]
        }));
        syncToServer("POST", "/api/categories", newCategory);
      },

      updateCategory: (id, updates) => {
        set((state) => ({
          categories: state.categories.map(c => c.id === id ? { ...c, ...updates } : c)
        }));
        const cat = get().categories.find(c => c.id === id);
        if (cat) {
          syncToServer("PATCH", `/api/categories/${id}`, { budgetId: cat.budgetId, ...updates });
        }
      },

      setCategoryGoal: (categoryId, goal) => {
        set((state) => ({
          categories: state.categories.map(c =>
            c.id === categoryId ? { ...c, goal } : c
          )
        }));
        const cat = get().categories.find(c => c.id === categoryId);
        if (cat) {
          syncToServer("PATCH", `/api/categories/${categoryId}`, { budgetId: cat.budgetId, goal });
        }
      },

      deleteCategory: (id) => {
        const state = get();
        const category = state.categories.find(c => c.id === id);
        const budgetId = category?.budgetId || state.currentBudgetId;

        const stateUpdates: Partial<AppState> = {
          categories: state.categories.filter(c => c.id !== id),
          monthlyAssignments: Object.fromEntries(
            Object.entries(state.monthlyAssignments).map(([bId, budgetAssignments]) => [
              bId,
              Object.fromEntries(
                Object.entries(budgetAssignments).map(([monthKey, monthAssignments]) => [
                  monthKey,
                  Object.fromEntries(Object.entries(monthAssignments).filter(([catId]) => catId !== id))
                ])
              )
            ])
          )
        };

        if (category?.linkedAccountId) {
          stateUpdates.accounts = state.accounts.map(a =>
            a.id === category.linkedAccountId
              ? { ...a, linkedCategoryId: undefined }
              : a
          );
        }

        set(stateUpdates);
        syncToServer("DELETE", `/api/categories/${id}`, { budgetId });
      },

      addCategoryGroup: (group) => {
        const budgetId = get().currentBudgetId;
        const newGroup = { ...group, id: crypto.randomUUID(), budgetId };
        set((state) => ({
          categoryGroups: [...state.categoryGroups, newGroup]
        }));
        syncToServer("POST", "/api/category-groups", newGroup);
      },

      updateCategoryGroup: (id, updates) => {
        set((state) => ({
          categoryGroups: state.categoryGroups.map(g => g.id === id ? { ...g, ...updates } : g)
        }));
        const group = get().categoryGroups.find(g => g.id === id);
        if (group) {
          syncToServer("PATCH", `/api/category-groups/${id}`, { budgetId: group.budgetId, ...updates });
        }
      },

      deleteCategoryGroup: (id) => {
        const group = get().categoryGroups.find(g => g.id === id);
        const budgetId = group?.budgetId || get().currentBudgetId;
        set((state) => ({
          categoryGroups: state.categoryGroups.filter(g => g.id !== id),
          categories: state.categories.filter(c => c.groupId !== id)
        }));
        syncToServer("DELETE", `/api/category-groups/${id}`, { budgetId });
      },

      // ============= BUDGET =============
      setCategoryAssignment: (month, categoryId, amount) => {
        const budgetId = get().currentBudgetId;
        set((state) => {
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
        });
        syncToServer("PUT", "/api/assignments", { budgetId, monthKey: month, categoryId, amount });
      },

      moveMoney: (fromCategoryId, toCategoryId, amount, month) => {
        const budgetId = get().currentBudgetId;
        set((state) => {
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
        });
        // Get the final amounts after the state update
        const finalState = get();
        const finalAssignments = finalState.monthlyAssignments[budgetId]?.[month] || {};
        syncToServer("PUT", "/api/assignments", {
          budgetId, monthKey: month,
          categoryId: fromCategoryId,
          amount: finalAssignments[fromCategoryId] || 0,
        });
        syncToServer("PUT", "/api/assignments", {
          budgetId, monthKey: month,
          categoryId: toCategoryId,
          amount: finalAssignments[toCategoryId] || 0,
        });
      },

      // ============= BUDGET TEMPLATES =============
      addBudgetTemplate: (template) => {
        const newTemplate = {
          ...template,
          id: crypto.randomUUID(),
          createdAt: new Date()
        };

        set((state) => {
          const updatedTemplates = template.isDefault
            ? state.budgetTemplates.map(t => ({ ...t, isDefault: false }))
            : state.budgetTemplates;
          return { budgetTemplates: [...updatedTemplates, newTemplate] };
        });

        syncToServer("POST", "/api/budget-templates", {
          id: newTemplate.id,
          name: newTemplate.name,
          isDefault: newTemplate.isDefault,
          goals: newTemplate.goals,
        });
      },

      updateBudgetTemplate: (id, updates) => {
        set((state) => {
          const updatedTemplates = state.budgetTemplates.map(t => {
            if (t.id === id) return { ...t, ...updates };
            if (updates.isDefault === true && t.isDefault) return { ...t, isDefault: false };
            return t;
          });
          return { budgetTemplates: updatedTemplates };
        });
        syncToServer("PATCH", `/api/budget-templates/${id}`, updates);
      },

      deleteBudgetTemplate: (id) => {
        set((state) => ({
          budgetTemplates: state.budgetTemplates.filter(t => t.id !== id)
        }));
        syncToServer("DELETE", `/api/budget-templates/${id}`);
      },

      applyBudgetTemplate: (templateId, month) => {
        const state = get();
        const template = state.budgetTemplates.find(t => t.id === templateId);
        if (!template) return;

        const assignments = { ...template.goals };
        const budgetId = state.currentBudgetId;
        const budgetAssignments = state.monthlyAssignments[budgetId] || {};

        set({
          monthlyAssignments: {
            ...state.monthlyAssignments,
            [budgetId]: {
              ...budgetAssignments,
              [month]: assignments
            }
          }
        });

        // Bulk upsert all assignments from the template
        const bulkAssignments = Object.entries(assignments).map(([categoryId, amount]) => ({
          monthKey: month,
          categoryId,
          amount,
        }));
        syncToServer("PUT", "/api/assignments/bulk", { budgetId, assignments: bulkAssignments });
      },

      saveCurrentAsTemplate: (name, isDefault = false) => {
        const state = get();
        const goals: { [key: string]: number } = {};
        state.categories.forEach(cat => {
          if (cat.goal && cat.goal > 0) {
            goals[cat.id] = cat.goal;
          }
        });

        const newTemplate = {
          id: crypto.randomUUID(),
          name,
          isDefault,
          goals,
          createdAt: new Date()
        };

        set((s) => {
          const updatedTemplates = isDefault
            ? s.budgetTemplates.map(t => ({ ...t, isDefault: false }))
            : s.budgetTemplates;
          return { budgetTemplates: [...updatedTemplates, newTemplate] };
        });

        syncToServer("POST", "/api/budget-templates", {
          id: newTemplate.id,
          name: newTemplate.name,
          isDefault: newTemplate.isDefault,
          goals: newTemplate.goals,
        });
      },

      // ============= AUTH =============
      hydrateFromServer: (data) => {
        set({
          budgets: data.budgets.map((b) => ({
            ...b,
            createdAt: new Date(b.createdAt),
          })),
          currentBudgetId: data.currentBudgetId,
          accounts: data.accounts,
          trackingAccounts: data.trackingAccounts,
          assets: INITIAL_ASSETS,
          categoryGroups: data.categoryGroups,
          categories: data.categories,
          transactions: data.transactions,
          monthlyAssignments: data.monthlyAssignments,
          budgetTemplates: data.budgetTemplates.map((t) => ({
            ...t,
            createdAt: new Date(t.createdAt),
          })),
          _hasHydrated: true,
        });
      },

      clearHydrated: () => {
        set({ _hasHydrated: false });
      },

      clearState: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('zerobased-storage');
        }
        set({
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
          _hasHydrated: false,
        });
      },

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

        // Only count budget accounts (checking, savings, cash) that are active
        // Excludes credit cards and loans as they are liabilities, not available funds
        const totalAccountBalance = state.accounts
          .filter(a =>
            a.isActive &&
            a.budgetId === state.currentBudgetId &&
            BUDGET_ACCOUNT_TYPES.includes(a.type)
          )
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
        helpModeEnabled: state.helpModeEnabled,
        hasSeenWelcome: state.hasSeenWelcome,
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