import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { format } from 'date-fns';

export type AccountType = 'checking' | 'savings' | 'credit' | 'loan';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
}

export interface CategoryGroup {
  id: string;
  name: string;
}

export interface Category {
  id: string;
  groupId: string;
  name: string;
}

export interface Transaction {
  id: string;
  date: string; // ISO date
  payee: string;
  categoryId?: string; // Optional for transfers/initial balance
  accountId: string;
  amount: number; // Negative for expense, Positive for income
  memo?: string;
  cleared: boolean;
}

// Keyed by "YYYY-MM" -> categoryId -> amount
export interface MonthlyAssignments {
  [monthKey: string]: {
    [categoryId: string]: number;
  };
}

interface AppState {
  accounts: Account[];
  categoryGroups: CategoryGroup[];
  categories: Category[];
  transactions: Transaction[];
  monthlyAssignments: MonthlyAssignments;
  currentMonth: string; // "YYYY-MM"

  // Actions
  setMonth: (month: string) => void;
  addAccount: (account: Omit<Account, 'id'>) => void;
  addTransaction: (transaction: Omit<Transaction, 'id'>) => void;
  setCategoryAssignment: (month: string, categoryId: string, amount: number) => void;
  
  // Getters (computed)
  getAccountBalance: (accountId: string) => number;
  getCategoryActivity: (month: string, categoryId: string) => number;
  getCategoryAvailable: (month: string, categoryId: string) => number;
  getReadyToAssign: (month: string) => number;
}

// Initial Mock Data
const INITIAL_ACCOUNTS: Account[] = [
  { id: '1', name: 'Republic Bank Checking', type: 'checking', balance: 12500.00 },
  { id: '2', name: 'Unit Trust Savings', type: 'savings', balance: 45000.00 },
  { id: '3', name: 'Scotiabank Magna', type: 'credit', balance: -2450.50 },
  { id: '4', name: 'Car Loan', type: 'loan', balance: -85000.00 },
];

const INITIAL_GROUPS: CategoryGroup[] = [
  { id: 'g1', name: 'Immediate Obligations' },
  { id: 'g2', name: 'True Expenses' },
  { id: 'g3', name: 'Quality of Life' },
];

const INITIAL_CATEGORIES: Category[] = [
  { id: 'c1', groupId: 'g1', name: 'Rent/Mortgage' },
  { id: 'c2', groupId: 'g1', name: 'Electric' },
  { id: 'c3', groupId: 'g1', name: 'Water' },
  { id: 'c4', groupId: 'g1', name: 'Internet' },
  { id: 'c5', groupId: 'g1', name: 'Groceries' },
  { id: 'c6', groupId: 'g2', name: 'Car Maintenance' },
  { id: 'c7', groupId: 'g2', name: 'Medical' },
  { id: 'c8', groupId: 'g2', name: 'Clothing' },
  { id: 'c9', groupId: 'g3', name: 'Dining Out' },
  { id: 'c10', groupId: 'g3', name: 'Vacation' },
];

const INITIAL_TRANSACTIONS: Transaction[] = [
  { id: 't1', date: '2025-10-01', payee: 'Employer', categoryId: undefined, accountId: '1', amount: 15000, cleared: true, memo: 'Salary' },
  { id: 't2', date: '2025-10-02', payee: 'Massy Stores', categoryId: 'c5', accountId: '1', amount: -1200.50, cleared: true },
  { id: 't3', date: '2025-10-03', payee: 'T&TEC', categoryId: 'c2', accountId: '1', amount: -350.00, cleared: true },
  { id: 't4', date: '2025-10-05', payee: 'KFC', categoryId: 'c9', accountId: '3', amount: -85.00, cleared: false },
  { id: 't5', date: '2025-10-10', payee: 'Gas Station', categoryId: 'c6', accountId: '3', amount: -250.00, cleared: true },
];

const INITIAL_ASSIGNMENTS: MonthlyAssignments = {
  '2025-10': {
    'c1': 5000,
    'c2': 400,
    'c3': 100,
    'c4': 350,
    'c5': 3000,
    'c9': 500,
  }
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      accounts: INITIAL_ACCOUNTS,
      categoryGroups: INITIAL_GROUPS,
      categories: INITIAL_CATEGORIES,
      transactions: INITIAL_TRANSACTIONS,
      monthlyAssignments: INITIAL_ASSIGNMENTS,
      currentMonth: '2025-10',

      setMonth: (month) => set({ currentMonth: month }),

      addAccount: (account) => set((state) => ({
        accounts: [...state.accounts, { ...account, id: Math.random().toString(36).substr(2, 9) }]
      })),

      addTransaction: (transaction) => set((state) => {
        const newTx = { ...transaction, id: Math.random().toString(36).substr(2, 9) };
        // Update account balance
        const updatedAccounts = state.accounts.map(acc => 
          acc.id === transaction.accountId 
            ? { ...acc, balance: acc.balance + transaction.amount }
            : acc
        );
        return {
          transactions: [newTx, ...state.transactions],
          accounts: updatedAccounts
        };
      }),

      setCategoryAssignment: (month, categoryId, amount) => set((state) => ({
        monthlyAssignments: {
          ...state.monthlyAssignments,
          [month]: {
            ...(state.monthlyAssignments[month] || {}),
            [categoryId]: amount
          }
        }
      })),

      getAccountBalance: (accountId) => {
        const state = get();
        return state.accounts.find(a => a.id === accountId)?.balance || 0;
      },

      getCategoryActivity: (month, categoryId) => {
        const state = get();
        // Filter transactions for this month and category
        return state.transactions
          .filter(t => t.categoryId === categoryId && t.date.startsWith(month))
          .reduce((sum, t) => sum + t.amount, 0);
      },

      getCategoryAvailable: (month, categoryId) => {
        const state = get();
        const assigned = state.monthlyAssignments[month]?.[categoryId] || 0;
        const activity = get().getCategoryActivity(month, categoryId);
        // Available = Assigned + Activity (Activity is usually negative)
        return assigned + activity;
      },

      getReadyToAssign: (month) => {
        const state = get();
        // Total Cash in Budget Accounts (Checking + Savings + Cash)
        // Note: Credit/Loan accounts usually don't count towards "Ready to Assign" directly unless positive
        const totalCash = state.accounts
          .filter(a => ['checking', 'savings'].includes(a.type))
          .reduce((sum, a) => sum + a.balance, 0);
        
        // Total Assigned in this month
        const assignments = state.monthlyAssignments[month] || {};
        const totalAssigned = Object.values(assignments).reduce((sum, val) => sum + val, 0);

        // In a real app, this logic is much more complex (rollovers, credit card handling)
        // For prototype: Simple Cash - Assigned
        return totalCash - totalAssigned;
      }
    }),
    {
      name: 'zerobased-storage',
    }
  )
);
