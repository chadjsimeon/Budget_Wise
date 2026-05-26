import { describe, test, expect, beforeEach } from 'vitest';
import { useStore } from './store';
import { format } from 'date-fns';

// ============= HELPERS =============

function addTestAccount(overrides: { name?: string; type?: string; balance?: number } = {}) {
  const { addAccount } = useStore.getState();
  return addAccount({
    name: overrides.name || 'Test Checking',
    type: (overrides.type as any) || 'checking',
    balance: overrides.balance ?? 1000,
    isActive: true,
  });
}

function addTestCategoryGroup(name = 'Test Group') {
  const { addCategoryGroup } = useStore.getState();
  addCategoryGroup({ name });
  const state = useStore.getState();
  return state.categoryGroups[state.categoryGroups.length - 1];
}

function addTestCategory(groupId: string, name = 'Test Category', goal?: number) {
  const { addCategory } = useStore.getState();
  addCategory({ groupId, name, goal });
  const state = useStore.getState();
  return state.categories[state.categories.length - 1];
}

function addTestTransaction(accountId: string, amount: number, overrides: Record<string, any> = {}) {
  const { addTransaction } = useStore.getState();
  addTransaction({
    accountId,
    date: overrides.date || format(new Date(), 'yyyy-MM-dd'),
    payee: overrides.payee || 'Test Payee',
    amount,
    memo: overrides.memo,
    cleared: overrides.cleared ?? false,
    categoryId: overrides.categoryId,
  });
  const state = useStore.getState();
  return state.transactions[0]; // addTransaction prepends
}

const currentMonth = format(new Date(), 'yyyy-MM');

beforeEach(() => {
  useStore.getState().clearState();
});

// ============= A. BUDGET CRUD =============

describe('Budget CRUD', () => {
  test('initializes with default state', () => {
    const state = useStore.getState();
    expect(state.budgets).toHaveLength(1);
    expect(state.budgets[0].id).toBe('budget1');
    expect(state.budgets[0].name).toBe('My Budget');
    expect(state.currentBudgetId).toBe('budget1');
    expect(state.categoryGroups).toHaveLength(0);
    expect(state.categories).toHaveLength(0);
    expect(state.transactions).toHaveLength(0);
    expect(state.currentMonth).toBe(currentMonth);
  });

  test('addBudget creates budget with default categories', () => {
    const { addBudget } = useStore.getState();
    addBudget({
      name: 'Second Budget',
      currency: 'USD',
      currencyPlacement: 'before',
      numberFormat: '1,234.56',
      dateFormat: 'MM/DD/YYYY',
    });

    const state = useStore.getState();
    expect(state.budgets).toHaveLength(2);
    const newBudget = state.budgets[1];
    expect(newBudget.name).toBe('Second Budget');
    expect(state.currentBudgetId).toBe(newBudget.id);

    // Default category structure: 3 groups
    const newGroups = state.categoryGroups.filter(g => g.budgetId === newBudget.id);
    expect(newGroups).toHaveLength(3);
    expect(newGroups.map(g => g.name)).toEqual(['Bills', 'Needs', 'Wants']);

    // Default categories: 4 + 4 + 5 = 13
    const newCats = state.categories.filter(c => c.budgetId === newBudget.id);
    expect(newCats).toHaveLength(13);
  });

  test('switchBudget changes currentBudgetId', () => {
    const { addBudget, switchBudget } = useStore.getState();
    addBudget({
      name: 'Other',
      currency: 'USD',
      currencyPlacement: 'before',
      numberFormat: '1,234.56',
      dateFormat: 'MM/DD/YYYY',
    });
    const newBudgetId = useStore.getState().budgets[1].id;

    switchBudget('budget1');
    expect(useStore.getState().currentBudgetId).toBe('budget1');

    switchBudget(newBudgetId);
    expect(useStore.getState().currentBudgetId).toBe(newBudgetId);
  });

  test('updateBudget modifies budget fields', () => {
    const { updateBudget } = useStore.getState();
    updateBudget('budget1', { name: 'Updated Budget', currency: 'USD' });

    const budget = useStore.getState().budgets[0];
    expect(budget.name).toBe('Updated Budget');
    expect(budget.currency).toBe('USD');
  });

  test('deleteBudget cascades to all related data', () => {
    const { addBudget } = useStore.getState();
    addBudget({
      name: 'To Delete',
      currency: 'USD',
      currencyPlacement: 'before',
      numberFormat: '1,234.56',
      dateFormat: 'MM/DD/YYYY',
    });

    const state = useStore.getState();
    const budgetToDelete = state.budgets[1];
    // Add account to the new budget
    useStore.getState().switchBudget(budgetToDelete.id);
    addTestAccount();

    const { deleteBudget } = useStore.getState();
    deleteBudget(budgetToDelete.id);

    const newState = useStore.getState();
    expect(newState.budgets).toHaveLength(1);
    expect(newState.accounts.filter(a => a.budgetId === budgetToDelete.id)).toHaveLength(0);
    expect(newState.categoryGroups.filter(g => g.budgetId === budgetToDelete.id)).toHaveLength(0);
    expect(newState.categories.filter(c => c.budgetId === budgetToDelete.id)).toHaveLength(0);
  });

  test('deleteBudget sets currentBudgetId to remaining budget', () => {
    const { addBudget } = useStore.getState();
    addBudget({
      name: 'Second',
      currency: 'USD',
      currencyPlacement: 'before',
      numberFormat: '1,234.56',
      dateFormat: 'MM/DD/YYYY',
    });
    const secondId = useStore.getState().budgets[1].id;

    // Current is now secondId (set by addBudget)
    useStore.getState().deleteBudget(secondId);
    expect(useStore.getState().currentBudgetId).toBe('budget1');
  });

  test('deleteBudget is no-op when only one budget exists', () => {
    const { deleteBudget } = useStore.getState();
    deleteBudget('budget1');
    expect(useStore.getState().budgets).toHaveLength(1);
  });
});

// ============= B. ACCOUNT MANAGEMENT =============

describe('Account Management', () => {
  test('addAccount creates account with generated id and budgetId', () => {
    const account = addTestAccount();
    expect(account.id).toBeDefined();
    expect(account.budgetId).toBe('budget1');
    expect(account.name).toBe('Test Checking');
    expect(account.type).toBe('checking');
    expect(account.isActive).toBe(true);
  });

  test('addAccount for loan creates Debt Repayments group and linked category', () => {
    const { addAccount } = useStore.getState();
    addAccount({
      name: 'Car Loan',
      type: 'loan',
      balance: 0,
      isActive: true,
      monthlyPayment: 500,
      interestRate: 5.0,
    });

    const state = useStore.getState();
    const debtGroup = state.categoryGroups.find(g => g.name === 'Debt Repayments');
    expect(debtGroup).toBeDefined();

    const linkedCat = state.categories.find(c => c.name === 'Car Loan Payment');
    expect(linkedCat).toBeDefined();
    expect(linkedCat!.goal).toBe(500);
    expect(linkedCat!.groupId).toBe(debtGroup!.id);

    const loanAccount = state.accounts.find(a => a.name === 'Car Loan');
    expect(loanAccount!.linkedCategoryId).toBe(linkedCat!.id);
    expect(linkedCat!.linkedAccountId).toBe(loanAccount!.id);
  });

  test('addAccount for loan reuses existing Debt Repayments group', () => {
    const { addAccount } = useStore.getState();
    addAccount({ name: 'Loan 1', type: 'loan', balance: 0, isActive: true, monthlyPayment: 200 });
    addAccount({ name: 'Loan 2', type: 'loan', balance: 0, isActive: true, monthlyPayment: 300 });

    const state = useStore.getState();
    const debtGroups = state.categoryGroups.filter(g => g.name === 'Debt Repayments');
    expect(debtGroups).toHaveLength(1);
  });

  test('updateAccount modifies account fields', () => {
    const account = addTestAccount();
    useStore.getState().updateAccount(account.id, { name: 'Updated Name' });
    const updated = useStore.getState().accounts.find(a => a.id === account.id);
    expect(updated!.name).toBe('Updated Name');
  });

  test('deleteAccount cascades transactions', () => {
    const account = addTestAccount();
    addTestTransaction(account.id, 100);
    addTestTransaction(account.id, -50);

    expect(useStore.getState().transactions).toHaveLength(2);

    useStore.getState().deleteAccount(account.id);

    const state = useStore.getState();
    expect(state.accounts).toHaveLength(0);
    expect(state.transactions).toHaveLength(0);
  });

  test('deleteAccount for loan cleans up linked category and assignments', () => {
    const { addAccount } = useStore.getState();
    addAccount({ name: 'Loan', type: 'loan', balance: 0, isActive: true, monthlyPayment: 400 });

    const state = useStore.getState();
    const loanAccount = state.accounts.find(a => a.name === 'Loan')!;
    const linkedCatId = loanAccount.linkedCategoryId!;

    // Assign money to the linked category
    useStore.getState().setCategoryAssignment(currentMonth, linkedCatId, 400);

    useStore.getState().deleteAccount(loanAccount.id);

    const newState = useStore.getState();
    expect(newState.categories.find(c => c.id === linkedCatId)).toBeUndefined();
    // Assignment should be cleaned up
    const assignments = newState.monthlyAssignments['budget1']?.[currentMonth] || {};
    expect(assignments[linkedCatId]).toBeUndefined();
  });

  test('addAccount for non-loan does not create category', () => {
    addTestAccount({ type: 'savings', name: 'Savings' });
    const state = useStore.getState();
    expect(state.categoryGroups.filter(g => g.name === 'Debt Repayments')).toHaveLength(0);
  });
});

// ============= C. TRANSACTION MANAGEMENT =============

describe('Transaction Management', () => {
  test('addTransaction updates account balance', () => {
    const account = addTestAccount({ balance: 0 });
    addTestTransaction(account.id, 500);

    const updatedAccount = useStore.getState().accounts.find(a => a.id === account.id)!;
    expect(updatedAccount.balance).toBe(500);
  });

  test('addTransaction with negative amount decreases balance', () => {
    const account = addTestAccount({ balance: 1000 });
    addTestTransaction(account.id, -200);

    const updatedAccount = useStore.getState().accounts.find(a => a.id === account.id)!;
    expect(updatedAccount.balance).toBe(800);
  });

  test('addTransaction assigns budgetId from current budget', () => {
    const account = addTestAccount();
    const tx = addTestTransaction(account.id, 100);
    expect(tx.budgetId).toBe('budget1');
  });

  test('updateTransaction reverses old amount and applies new', () => {
    const account = addTestAccount({ balance: 1000 });
    const tx = addTestTransaction(account.id, 100);
    // Balance is now 1100

    useStore.getState().updateTransaction(tx.id, { amount: -50 });

    const updatedAccount = useStore.getState().accounts.find(a => a.id === account.id)!;
    // 1000 + 100 (original) → 1100. Then reverse: 1100 - 100 = 1000. Apply new: 1000 + (-50) = 950
    expect(updatedAccount.balance).toBe(950);
  });

  test('deleteTransaction reverses balance', () => {
    const account = addTestAccount({ balance: 1000 });
    const tx = addTestTransaction(account.id, 300);
    // Balance is now 1300

    useStore.getState().deleteTransaction(tx.id);

    const updatedAccount = useStore.getState().accounts.find(a => a.id === account.id)!;
    expect(updatedAccount.balance).toBe(1000);
  });

  test('deleteTransaction detects and removes transfer pair', () => {
    const account1 = addTestAccount({ name: 'Account 1', balance: 1000 });
    const account2 = addTestAccount({ name: 'Account 2', balance: 500 });

    // Simulate a transfer pair
    const { addTransaction } = useStore.getState();
    const memo = 'transfer-123';
    const date = format(new Date(), 'yyyy-MM-dd');

    addTransaction({
      accountId: account1.id,
      date,
      payee: `Transfer to Account 2`,
      amount: -200,
      memo,
      cleared: false,
    });

    addTransaction({
      accountId: account2.id,
      date,
      payee: `Transfer from Account 1`,
      amount: 200,
      memo,
      cleared: false,
    });

    expect(useStore.getState().transactions).toHaveLength(2);

    // Delete one side of transfer
    const txToDelete = useStore.getState().transactions.find(t => t.payee.startsWith('Transfer to'))!;
    useStore.getState().deleteTransaction(txToDelete.id);

    // Both transactions should be removed
    expect(useStore.getState().transactions).toHaveLength(0);

    // Balances should be restored
    const acct1 = useStore.getState().accounts.find(a => a.id === account1.id)!;
    const acct2 = useStore.getState().accounts.find(a => a.id === account2.id)!;
    expect(acct1.balance).toBe(1000);
    expect(acct2.balance).toBe(500);
  });

  test('multiple transactions accumulate balance', () => {
    const account = addTestAccount({ balance: 0 });
    addTestTransaction(account.id, 100);
    addTestTransaction(account.id, 200);
    addTestTransaction(account.id, -50);

    const updatedAccount = useStore.getState().accounts.find(a => a.id === account.id)!;
    expect(updatedAccount.balance).toBe(250);
  });

  test('updateTransaction changing account moves balance', () => {
    const account1 = addTestAccount({ name: 'Acct1', balance: 1000 });
    const account2 = addTestAccount({ name: 'Acct2', balance: 500 });
    const tx = addTestTransaction(account1.id, 100);
    // acct1 = 1100, acct2 = 500

    useStore.getState().updateTransaction(tx.id, { accountId: account2.id, amount: 100 });

    const acct1 = useStore.getState().accounts.find(a => a.id === account1.id)!;
    const acct2 = useStore.getState().accounts.find(a => a.id === account2.id)!;
    // acct1: 1100 - 100 = 1000 (reversed old)
    expect(acct1.balance).toBe(1000);
    // acct2: 500 + 100 = 600 (applied new)
    expect(acct2.balance).toBe(600);
  });

  test('deleteTransaction for non-existent id is no-op', () => {
    const account = addTestAccount();
    addTestTransaction(account.id, 100);
    const txCount = useStore.getState().transactions.length;

    useStore.getState().deleteTransaction('non-existent');
    expect(useStore.getState().transactions).toHaveLength(txCount);
  });
});

// ============= D. CATEGORY & GROUP MANAGEMENT =============

describe('Category & Group Management', () => {
  test('addCategoryGroup creates group with budgetId', () => {
    const group = addTestCategoryGroup('Essentials');
    expect(group.id).toBeDefined();
    expect(group.budgetId).toBe('budget1');
    expect(group.name).toBe('Essentials');
  });

  test('addCategory creates category with budgetId', () => {
    const group = addTestCategoryGroup();
    const category = addTestCategory(group.id, 'Groceries');
    expect(category.id).toBeDefined();
    expect(category.budgetId).toBe('budget1');
    expect(category.groupId).toBe(group.id);
    expect(category.name).toBe('Groceries');
  });

  test('updateCategoryGroup modifies group fields', () => {
    const group = addTestCategoryGroup();
    useStore.getState().updateCategoryGroup(group.id, { name: 'Updated Group' });
    const updated = useStore.getState().categoryGroups.find(g => g.id === group.id)!;
    expect(updated.name).toBe('Updated Group');
  });

  test('deleteCategoryGroup cascades categories', () => {
    const group = addTestCategoryGroup();
    addTestCategory(group.id, 'Cat1');
    addTestCategory(group.id, 'Cat2');
    expect(useStore.getState().categories).toHaveLength(2);

    useStore.getState().deleteCategoryGroup(group.id);

    expect(useStore.getState().categoryGroups.find(g => g.id === group.id)).toBeUndefined();
    expect(useStore.getState().categories.filter(c => c.groupId === group.id)).toHaveLength(0);
  });

  test('setCategoryGoal updates category goal', () => {
    const group = addTestCategoryGroup();
    const cat = addTestCategory(group.id, 'Rent');
    useStore.getState().setCategoryGoal(cat.id, 1500);

    const updated = useStore.getState().categories.find(c => c.id === cat.id)!;
    expect(updated.goal).toBe(1500);
  });

  test('deleteCategory cleans up monthly assignments', () => {
    const group = addTestCategoryGroup();
    const cat = addTestCategory(group.id, 'Test');
    useStore.getState().setCategoryAssignment(currentMonth, cat.id, 500);

    useStore.getState().deleteCategory(cat.id);

    const assignments = useStore.getState().monthlyAssignments['budget1']?.[currentMonth] || {};
    expect(assignments[cat.id]).toBeUndefined();
  });

  test('updateCategory modifies category fields', () => {
    const group = addTestCategoryGroup();
    const cat = addTestCategory(group.id, 'Old Name');
    useStore.getState().updateCategory(cat.id, { name: 'New Name' });
    const updated = useStore.getState().categories.find(c => c.id === cat.id)!;
    expect(updated.name).toBe('New Name');
  });

  test('deleteCategory with linked loan account unlinks it', () => {
    const { addAccount } = useStore.getState();
    addAccount({ name: 'Loan', type: 'loan', balance: 0, isActive: true, monthlyPayment: 300 });

    const state = useStore.getState();
    const loanAcct = state.accounts.find(a => a.name === 'Loan')!;
    const linkedCat = state.categories.find(c => c.linkedAccountId === loanAcct.id)!;

    useStore.getState().deleteCategory(linkedCat.id);

    const updatedAcct = useStore.getState().accounts.find(a => a.id === loanAcct.id)!;
    expect(updatedAcct.linkedCategoryId).toBeUndefined();
  });
});

// ============= E. MONTHLY ASSIGNMENTS & BUDGET MATH =============

describe('Monthly Assignments & Budget Math', () => {
  test('setCategoryAssignment stores assignment for budget/month/category', () => {
    const group = addTestCategoryGroup();
    const cat = addTestCategory(group.id, 'Rent');

    useStore.getState().setCategoryAssignment(currentMonth, cat.id, 1000);

    const assignments = useStore.getState().monthlyAssignments['budget1']?.[currentMonth] || {};
    expect(assignments[cat.id]).toBe(1000);
  });

  test('moveMoney preserves total assignments', () => {
    const group = addTestCategoryGroup();
    const cat1 = addTestCategory(group.id, 'Cat1');
    const cat2 = addTestCategory(group.id, 'Cat2');

    useStore.getState().setCategoryAssignment(currentMonth, cat1.id, 500);
    useStore.getState().setCategoryAssignment(currentMonth, cat2.id, 300);

    useStore.getState().moveMoney(cat1.id, cat2.id, 200, currentMonth);

    const assignments = useStore.getState().monthlyAssignments['budget1']?.[currentMonth]!;
    expect(assignments[cat1.id]).toBe(300);
    expect(assignments[cat2.id]).toBe(500);
    // Total is still 800
    expect(assignments[cat1.id] + assignments[cat2.id]).toBe(800);
  });

  test('getReadyToAssign: account balances minus total assignments', () => {
    addTestAccount({ balance: 5000 });
    const group = addTestCategoryGroup();
    const cat = addTestCategory(group.id, 'Rent');

    useStore.getState().setCategoryAssignment(currentMonth, cat.id, 2000);

    expect(useStore.getState().getReadyToAssign(currentMonth)).toBe(3000);
  });

  test('getReadyToAssign: only counts liquid account types', () => {
    addTestAccount({ type: 'checking', balance: 3000 });
    addTestAccount({ type: 'credit', balance: -500, name: 'Credit Card' });

    // Credit card balance should NOT be included
    expect(useStore.getState().getReadyToAssign(currentMonth)).toBe(3000);
  });

  test('getReadyToAssign: only counts active accounts', () => {
    const account = addTestAccount({ balance: 2000 });
    useStore.getState().updateAccount(account.id, { isActive: false });

    expect(useStore.getState().getReadyToAssign(currentMonth)).toBe(0);
  });

  test('getReadyToAssign: only counts current budget accounts', () => {
    addTestAccount({ balance: 1000 });

    // Create second budget and add account there
    useStore.getState().addBudget({
      name: 'Other',
      currency: 'USD',
      currencyPlacement: 'before',
      numberFormat: '1,234.56',
      dateFormat: 'MM/DD/YYYY',
    });
    addTestAccount({ balance: 9999, name: 'Other Account' });

    // Switch back to original budget
    useStore.getState().switchBudget('budget1');
    expect(useStore.getState().getReadyToAssign(currentMonth)).toBe(1000);
  });

  test('getCategoryActivity: sums transactions by category and month', () => {
    const account = addTestAccount({ balance: 0 });
    const group = addTestCategoryGroup();
    const cat = addTestCategory(group.id, 'Groceries');

    addTestTransaction(account.id, -50, { categoryId: cat.id });
    addTestTransaction(account.id, -30, { categoryId: cat.id });

    expect(useStore.getState().getCategoryActivity(currentMonth, cat.id)).toBe(-80);
  });

  test('getCategoryActivity: filters by current budget', () => {
    const account = addTestAccount({ balance: 0 });
    const group = addTestCategoryGroup();
    const cat = addTestCategory(group.id, 'Food');

    addTestTransaction(account.id, -100, { categoryId: cat.id });

    // Switch to a different budget
    useStore.getState().addBudget({
      name: 'Other',
      currency: 'USD',
      currencyPlacement: 'before',
      numberFormat: '1,234.56',
      dateFormat: 'MM/DD/YYYY',
    });

    // Should return 0 for original category in new budget context
    expect(useStore.getState().getCategoryActivity(currentMonth, cat.id)).toBe(0);
  });

  test('getCategoryAvailable: assigned + activity', () => {
    const account = addTestAccount({ balance: 5000 });
    const group = addTestCategoryGroup();
    const cat = addTestCategory(group.id, 'Groceries');

    useStore.getState().setCategoryAssignment(currentMonth, cat.id, 400);
    addTestTransaction(account.id, -150, { categoryId: cat.id });

    expect(useStore.getState().getCategoryAvailable(currentMonth, cat.id)).toBe(250);
  });

  test('getCategoryAvailable: can be negative', () => {
    const account = addTestAccount({ balance: 5000 });
    const group = addTestCategoryGroup();
    const cat = addTestCategory(group.id, 'Food');

    useStore.getState().setCategoryAssignment(currentMonth, cat.id, 100);
    addTestTransaction(account.id, -200, { categoryId: cat.id });

    expect(useStore.getState().getCategoryAvailable(currentMonth, cat.id)).toBe(-100);
  });

  test('setCategoryAssignment overwrites previous value', () => {
    const group = addTestCategoryGroup();
    const cat = addTestCategory(group.id, 'Test');

    useStore.getState().setCategoryAssignment(currentMonth, cat.id, 100);
    useStore.getState().setCategoryAssignment(currentMonth, cat.id, 250);

    const assignments = useStore.getState().monthlyAssignments['budget1']?.[currentMonth]!;
    expect(assignments[cat.id]).toBe(250);
  });
});

// ============= F. BUDGET TEMPLATES =============

describe('Budget Templates', () => {
  test('addBudgetTemplate creates template', () => {
    useStore.getState().addBudgetTemplate({
      name: 'Monthly',
      isDefault: false,
      goals: { cat1: 500, cat2: 300 },
    });

    const templates = useStore.getState().budgetTemplates;
    expect(templates).toHaveLength(1);
    expect(templates[0].name).toBe('Monthly');
    expect(templates[0].goals).toEqual({ cat1: 500, cat2: 300 });
  });

  test('addBudgetTemplate with isDefault clears other defaults', () => {
    useStore.getState().addBudgetTemplate({ name: 'Template 1', isDefault: true, goals: {} });
    useStore.getState().addBudgetTemplate({ name: 'Template 2', isDefault: true, goals: {} });

    const templates = useStore.getState().budgetTemplates;
    expect(templates[0].isDefault).toBe(false);
    expect(templates[1].isDefault).toBe(true);
  });

  test('updateBudgetTemplate modifies template', () => {
    useStore.getState().addBudgetTemplate({ name: 'Old Name', isDefault: false, goals: {} });
    const id = useStore.getState().budgetTemplates[0].id;

    useStore.getState().updateBudgetTemplate(id, { name: 'New Name' });
    expect(useStore.getState().budgetTemplates[0].name).toBe('New Name');
  });

  test('deleteBudgetTemplate removes template', () => {
    useStore.getState().addBudgetTemplate({ name: 'To Delete', isDefault: false, goals: {} });
    const id = useStore.getState().budgetTemplates[0].id;

    useStore.getState().deleteBudgetTemplate(id);
    expect(useStore.getState().budgetTemplates).toHaveLength(0);
  });

  test('applyBudgetTemplate sets assignments for month', () => {
    const group = addTestCategoryGroup();
    const cat = addTestCategory(group.id, 'Rent');

    useStore.getState().addBudgetTemplate({
      name: 'Test',
      isDefault: false,
      goals: { [cat.id]: 1500 },
    });
    const templateId = useStore.getState().budgetTemplates[0].id;

    useStore.getState().applyBudgetTemplate(templateId, currentMonth);

    const assignments = useStore.getState().monthlyAssignments['budget1']?.[currentMonth]!;
    expect(assignments[cat.id]).toBe(1500);
  });

  test('saveCurrentAsTemplate captures category goals', () => {
    const group = addTestCategoryGroup();
    const cat1 = addTestCategory(group.id, 'Rent', 1500);
    const cat2 = addTestCategory(group.id, 'Food', 400);
    addTestCategory(group.id, 'No Goal');

    useStore.getState().saveCurrentAsTemplate('My Template');

    const template = useStore.getState().budgetTemplates[0];
    expect(template.name).toBe('My Template');
    expect(template.goals[cat1.id]).toBe(1500);
    expect(template.goals[cat2.id]).toBe(400);
    expect(Object.keys(template.goals)).toHaveLength(2); // No Goal excluded
  });

  test('updateBudgetTemplate with isDefault clears other defaults', () => {
    useStore.getState().addBudgetTemplate({ name: 'T1', isDefault: true, goals: {} });
    useStore.getState().addBudgetTemplate({ name: 'T2', isDefault: false, goals: {} });

    const t2Id = useStore.getState().budgetTemplates[1].id;
    useStore.getState().updateBudgetTemplate(t2Id, { isDefault: true });

    const templates = useStore.getState().budgetTemplates;
    expect(templates[0].isDefault).toBe(false);
    expect(templates[1].isDefault).toBe(true);
  });
});

// ============= G. TRACKING ACCOUNTS & NET WORTH =============

describe('Tracking Accounts & Net Worth', () => {
  test('addTrackingAccount creates tracking account', () => {
    useStore.getState().addTrackingAccount({ name: 'House', type: 'asset', balance: 300000 });

    const accounts = useStore.getState().trackingAccounts;
    expect(accounts).toHaveLength(1);
    expect(accounts[0].name).toBe('House');
    expect(accounts[0].type).toBe('asset');
    expect(accounts[0].balance).toBe(300000);
  });

  test('updateTrackingAccount modifies fields', () => {
    useStore.getState().addTrackingAccount({ name: 'Car', type: 'asset', balance: 20000 });
    const id = useStore.getState().trackingAccounts[0].id;

    useStore.getState().updateTrackingAccount(id, { balance: 18000 });
    expect(useStore.getState().trackingAccounts[0].balance).toBe(18000);
  });

  test('deleteTrackingAccount removes account', () => {
    useStore.getState().addTrackingAccount({ name: 'Investment', type: 'asset', balance: 10000 });
    const id = useStore.getState().trackingAccounts[0].id;

    useStore.getState().deleteTrackingAccount(id);
    expect(useStore.getState().trackingAccounts).toHaveLength(0);
  });

  test('getNetWorth includes budget accounts', () => {
    addTestAccount({ balance: 5000 });
    expect(useStore.getState().getNetWorth()).toBe(5000);
  });

  test('getNetWorth includes tracking assets and liabilities', () => {
    addTestAccount({ balance: 5000 });
    useStore.getState().addTrackingAccount({ name: 'House', type: 'asset', balance: 200000 });
    useStore.getState().addTrackingAccount({ name: 'Mortgage', type: 'liability', balance: 150000 });

    // 5000 + 200000 - 150000 = 55000
    expect(useStore.getState().getNetWorth()).toBe(55000);
  });

  test('getNetWorth sums budget accounts + tracking + legacy assets', () => {
    addTestAccount({ balance: 1000 });
    useStore.getState().addTrackingAccount({ name: 'Asset', type: 'asset', balance: 5000 });
    useStore.getState().addAsset({ name: 'Legacy', value: 3000, type: 'other' });

    // 1000 + 5000 + 3000 = 9000
    expect(useStore.getState().getNetWorth()).toBe(9000);
  });
});

// ============= H. MULTI-BUDGET ISOLATION =============

describe('Multi-Budget Isolation', () => {
  test('accounts are scoped to current budget', () => {
    addTestAccount({ name: 'Budget1 Account', balance: 1000 });

    useStore.getState().addBudget({
      name: 'Budget 2',
      currency: 'USD',
      currencyPlacement: 'before',
      numberFormat: '1,234.56',
      dateFormat: 'MM/DD/YYYY',
    });
    addTestAccount({ name: 'Budget2 Account', balance: 2000 });

    const state = useStore.getState();
    const budget2Id = state.budgets[1].id;
    const budget2Accounts = state.accounts.filter(a => a.budgetId === budget2Id);
    expect(budget2Accounts).toHaveLength(1);
    expect(budget2Accounts[0].name).toBe('Budget2 Account');
  });

  test('categories scoped to budget', () => {
    const group = addTestCategoryGroup('Group1');
    addTestCategory(group.id, 'Cat1');

    useStore.getState().addBudget({
      name: 'Budget 2',
      currency: 'USD',
      currencyPlacement: 'before',
      numberFormat: '1,234.56',
      dateFormat: 'MM/DD/YYYY',
    });

    const state = useStore.getState();
    const budget2Cats = state.categories.filter(c => c.budgetId === state.currentBudgetId);
    // Budget 2 gets 13 default categories, not the custom one from budget 1
    expect(budget2Cats.find(c => c.name === 'Cat1')).toBeUndefined();
  });

  test('switching budget changes getReadyToAssign result', () => {
    addTestAccount({ balance: 5000 });

    useStore.getState().addBudget({
      name: 'Budget 2',
      currency: 'USD',
      currencyPlacement: 'before',
      numberFormat: '1,234.56',
      dateFormat: 'MM/DD/YYYY',
    });
    addTestAccount({ balance: 2000, name: 'B2 Account' });

    // In budget2 context
    expect(useStore.getState().getReadyToAssign(currentMonth)).toBe(2000);

    // Switch to budget1
    useStore.getState().switchBudget('budget1');
    expect(useStore.getState().getReadyToAssign(currentMonth)).toBe(5000);
  });

  test('transactions scoped to budget', () => {
    const account = addTestAccount({ balance: 0 });
    addTestTransaction(account.id, 500);

    const state = useStore.getState();
    const budget1Txs = state.transactions.filter(t => t.budgetId === 'budget1');
    expect(budget1Txs).toHaveLength(1);
  });

  test('monthly assignments scoped to budget', () => {
    const group = addTestCategoryGroup();
    const cat = addTestCategory(group.id, 'Test');
    useStore.getState().setCategoryAssignment(currentMonth, cat.id, 500);

    const assignments = useStore.getState().monthlyAssignments;
    expect(assignments['budget1']?.[currentMonth]?.[cat.id]).toBe(500);
    // No other budget should have this assignment
    const otherBudgetKeys = Object.keys(assignments).filter(k => k !== 'budget1');
    otherBudgetKeys.forEach(key => {
      expect(assignments[key]?.[currentMonth]?.[cat.id]).toBeUndefined();
    });
  });
});

// ============= I. EDGE CASES =============

describe('Edge Cases', () => {
  test('updateAccount with non-existent id is no-op', () => {
    const accountsBefore = useStore.getState().accounts.length;
    useStore.getState().updateAccount('non-existent', { name: 'Nope' });
    expect(useStore.getState().accounts.length).toBe(accountsBefore);
  });

  test('updateTransaction with non-existent id is no-op', () => {
    const txBefore = useStore.getState().transactions.length;
    useStore.getState().updateTransaction('non-existent', { amount: 999 });
    expect(useStore.getState().transactions.length).toBe(txBefore);
  });

  test('deleteAccount with non-existent id is no-op', () => {
    addTestAccount();
    const before = useStore.getState().accounts.length;
    useStore.getState().deleteAccount('non-existent');
    expect(useStore.getState().accounts.length).toBe(before);
  });

  test('clearState resets everything', () => {
    addTestAccount();
    addTestCategoryGroup();

    useStore.getState().clearState();

    const state = useStore.getState();
    expect(state.budgets).toHaveLength(1);
    expect(state.budgets[0].id).toBe('budget1');
    expect(state.accounts).toHaveLength(0);
    expect(state.categoryGroups).toHaveLength(0);
    expect(state.categories).toHaveLength(0);
    expect(state.transactions).toHaveLength(0);
  });
});
