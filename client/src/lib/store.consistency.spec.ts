import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/syncQueue', () => ({ syncToServer: vi.fn() }));

import { syncToServer } from '@/lib/syncQueue';
import {
  useStore,
  isBookkeepingEntry,
  BALANCE_ADJUSTMENT_PAYEE,
  type ServerBudgetData,
} from '@/lib/store';

// Places where the local store used to drift from what the server ends up
// holding. Each test pins the local result to the server's behaviour.

const sync = vi.mocked(syncToServer);
const sent = () => sync.mock.calls.map(([method, url, body]) => ({ method, url, body: body as any }));
const store = () => useStore.getState();
const accountById = (id: string) => store().accounts.find(a => a.id === id)!;

function addAccount(name: string, type: 'checking' | 'savings' | 'credit' | 'loan', opening = 0, extra = {}) {
  return store().addAccount({ name, type, balance: 0, isActive: true, ...extra }, opening || undefined);
}

function addCategory(name = 'Groceries') {
  store().addCategoryGroup({ name: `${name} group` });
  const groupId = store().categoryGroups.find(g => g.name === `${name} group`)!.id;
  store().addCategory({ name, groupId });
  return store().categories.find(c => c.name === name)!;
}

describe('store stays consistent with the server', () => {
  beforeEach(() => {
    store().clearState();
    sync.mockClear();
  });

  describe('transfers', () => {
    test('both legs share a transferId and move both balances', () => {
      // Given: two accounts
      const checking = addAccount('Checking', 'checking', 1000);
      const savings = addAccount('Savings', 'savings');
      sync.mockClear();

      // When: money is transferred
      store().addTransfer({ fromAccountId: checking.id, toAccountId: savings.id, date: '2026-11-15', amount: 250 });

      // Then: two linked transactions exist and each is sent with the link
      const legs = store().transactions.filter(t => t.transferId);
      expect(legs).toHaveLength(2);
      expect(new Set(legs.map(t => t.transferId)).size).toBe(1);
      expect(accountById(checking.id).balance).toBe(750);
      expect(accountById(savings.id).balance).toBe(250);
      expect(sent().map(r => r.body.transaction.transferId)).toEqual([legs[0].transferId, legs[0].transferId]);
    });

    test('paying a credit card spends from its payment category', () => {
      // Given: a credit card that owes 400
      const checking = addAccount('Checking', 'checking', 1000);
      const card = addAccount('Visa', 'credit', -400);
      const categoryId = accountById(card.id).linkedCategoryId!;

      // When: 300 is paid to the card
      store().addTransfer({ fromAccountId: checking.id, toAccountId: card.id, date: '2026-11-15', amount: 300 });

      // Then: the category's activity is spending, not income
      expect(store().getCategoryActivity('2026-11', categoryId)).toBe(-300);
      expect(accountById(card.id).balance).toBe(-100);
    });

    test('editing one leg keeps the other in step', () => {
      // Given: a transfer of 250
      const checking = addAccount('Checking', 'checking', 1000);
      const savings = addAccount('Savings', 'savings');
      store().addTransfer({ fromAccountId: checking.id, toAccountId: savings.id, date: '2026-11-15', amount: 250 });
      const outflow = store().transactions.find(t => t.transferId && t.amount < 0)!;
      const inflow = store().transactions.find(t => t.transferId && t.amount > 0)!;
      sync.mockClear();

      // When: the outflow is changed to 400 on another day
      store().updateTransaction(outflow.id, { amount: -400, date: '2026-11-20' });

      // Then: the inflow follows, locally and on the server
      const updatedInflow = store().transactions.find(t => t.id === inflow.id)!;
      expect(updatedInflow).toMatchObject({ amount: 400, date: '2026-11-20' });
      expect(accountById(checking.id).balance).toBe(600);
      expect(accountById(savings.id).balance).toBe(400);
      expect(sent().map(r => r.url)).toEqual([
        `/api/transactions/${outflow.id}`,
        `/api/transactions/${inflow.id}`,
      ]);
      expect(sent()[1].body.updates).toEqual({ amount: 400, date: '2026-11-20' });
    });

    test('deleting one leg removes the pair even if the payees were renamed', () => {
      // Given: a transfer whose payees no longer look like a transfer
      const checking = addAccount('Checking', 'checking', 1000);
      const savings = addAccount('Savings', 'savings');
      store().addTransfer({ fromAccountId: checking.id, toAccountId: savings.id, date: '2026-11-15', amount: 250 });
      const [first, second] = store().transactions.filter(t => t.transferId);
      store().updateTransaction(first.id, { payee: 'Rainy day' });
      store().updateTransaction(second.id, { payee: 'Rainy day' });

      // When: one leg is deleted
      store().deleteTransaction(first.id);

      // Then: both are gone and both balances are restored
      expect(store().transactions.filter(t => t.transferId)).toHaveLength(0);
      expect(accountById(checking.id).balance).toBe(1000);
      expect(accountById(savings.id).balance).toBe(0);
    });

    test('transfers, opening balances and adjustments are not income or spending', () => {
      const checking = addAccount('Checking', 'checking', 1000);
      const savings = addAccount('Savings', 'savings');
      store().addTransfer({ fromAccountId: checking.id, toAccountId: savings.id, date: '2026-11-15', amount: 250 });
      store().updateAccount(savings.id, { balance: 300 });
      store().addTransaction({ accountId: checking.id, date: '2026-11-15', payee: 'Shop', amount: -20, cleared: false });

      const reportable = store().transactions.filter(t => !isBookkeepingEntry(t));

      expect(reportable.map(t => t.payee)).toEqual(['Shop']);
    });
  });

  describe('loans', () => {
    test('deleting an overpayment puts the loan back exactly where it was', () => {
      // Given: a loan owing 1000 with its payment category
      const checking = addAccount('Checking', 'checking', 5000);
      const loan = addAccount('Car', 'loan', -1000, { interestRate: 12, monthlyPayment: 200 });
      const categoryId = accountById(loan.id).linkedCategoryId!;

      // When: it is overpaid
      store().addTransaction({
        accountId: checking.id, date: '2026-11-15', payee: 'Bank', amount: -1500, categoryId, cleared: false,
      });

      // Then: it is closed, and the overpayment is still visible in the balance
      expect(accountById(loan.id).isActive).toBe(false);
      expect(accountById(loan.id).balance).toBeGreaterThan(0);

      // When: that payment is deleted
      const payment = store().transactions.find(t => t.payee === 'Bank')!;
      store().deleteTransaction(payment.id);

      // Then: the loan owes exactly what it did before, and is open again
      expect(accountById(loan.id)).toMatchObject({ balance: -1000, isActive: true });
      expect(accountById(checking.id).balance).toBe(5000);
    });

    test('changing the monthly payment updates the category goal on the server too', () => {
      const loan = addAccount('Car', 'loan', -1000, { interestRate: 12, monthlyPayment: 200 });
      const categoryId = accountById(loan.id).linkedCategoryId!;
      sync.mockClear();

      store().updateAccount(loan.id, { monthlyPayment: 350 });

      expect(store().categories.find(c => c.id === categoryId)!.goal).toBe(350);
      expect(sent()).toEqual([
        { method: 'PATCH', url: `/api/categories/${categoryId}`, body: { budgetId: loan.budgetId, goal: 350 } },
        { method: 'PATCH', url: `/api/accounts/${loan.id}`, body: { budgetId: loan.budgetId, monthlyPayment: 350 } },
      ]);
    });
  });

  describe('editing a balance by hand', () => {
    test('records the difference as a transaction instead of overwriting the balance', () => {
      // Given: a card owing 400
      const card = addAccount('Visa', 'credit', -400);
      sync.mockClear();

      // When: the amount owed is corrected to 550, along with the name
      store().updateAccount(card.id, { name: 'Visa Gold', balance: -550 });

      // Then: an adjustment transaction carries the difference
      const adjustment = store().transactions.find(t => t.payee === BALANCE_ADJUSTMENT_PAYEE)!;
      expect(adjustment).toMatchObject({ accountId: card.id, amount: -150 });
      expect(accountById(card.id)).toMatchObject({ name: 'Visa Gold', balance: -550 });

      // And: the server is never sent a balance
      expect(sent().map(r => `${r.method} ${r.url}`)).toEqual([
        `PATCH /api/accounts/${card.id}`,
        'POST /api/transactions',
      ]);
      expect(sent()[0].body).toEqual({ budgetId: card.budgetId, name: 'Visa Gold' });
    });

    test('an unchanged balance creates nothing', () => {
      const card = addAccount('Visa', 'credit', -400);
      sync.mockClear();

      store().updateAccount(card.id, { balance: -400 });

      expect(store().transactions.filter(t => t.payee === BALANCE_ADJUSTMENT_PAYEE)).toHaveLength(0);
      expect(sent()).toEqual([]);
    });
  });

  describe('deleting things that other things point at', () => {
    test('deleting a category uncategorises its transactions and bill reminders', () => {
      // Given: a category in use
      const checking = addAccount('Checking', 'checking', 1000);
      const category = addCategory();
      store().addTransaction({
        accountId: checking.id, date: '2026-11-15', payee: 'Shop', amount: -20, categoryId: category.id, cleared: false,
      });
      store().addBillReminder({
        name: 'Food box', amount: 50, frequency: 'monthly', dueDay: 1, isActive: true,
        autoCreateTransaction: false, reminderDaysBefore: 3, categoryId: category.id,
      });
      store().setCategoryAssignment('2026-11', category.id, 100);

      // When: it is deleted
      store().deleteCategory(category.id);

      // Then: nothing still points at it
      expect(store().transactions.find(t => t.payee === 'Shop')!.categoryId).toBeUndefined();
      expect(store().billReminders[0].categoryId).toBeUndefined();
      expect(store().monthlyAssignments[store().currentBudgetId]['2026-11']).toEqual({});
    });

    test('deleting a group removes its categories, their assignments and account links', () => {
      // Given: a credit card, whose payment category lives in the debt group
      const card = addAccount('Visa', 'credit');
      const categoryId = accountById(card.id).linkedCategoryId!;
      const groupId = store().categories.find(c => c.id === categoryId)!.groupId;
      store().setCategoryAssignment('2026-11', categoryId, 100);
      sync.mockClear();

      // When: the group is deleted
      store().deleteCategoryGroup(groupId);

      // Then: the category, its assignment and the card's link are all gone
      expect(store().categories.find(c => c.id === categoryId)).toBeUndefined();
      expect(store().monthlyAssignments[store().currentBudgetId]['2026-11']).toEqual({});
      expect(accountById(card.id).linkedCategoryId).toBeUndefined();

      // And: the server is told to unlink the card before the group goes
      expect(sent().map(r => `${r.method} ${r.url}`)).toEqual([
        `PATCH /api/accounts/${card.id}`,
        `DELETE /api/category-groups/${groupId}`,
      ]);
    });

    test('deleting a loan also deletes its payment category on the server', () => {
      const loan = addAccount('Car', 'loan', -1000, { interestRate: 12, monthlyPayment: 200 });
      const categoryId = accountById(loan.id).linkedCategoryId!;
      store().addBillReminder({
        name: 'Car note', amount: 200, frequency: 'monthly', dueDay: 1, isActive: true,
        autoCreateTransaction: false, reminderDaysBefore: 3, accountId: loan.id, categoryId,
      });
      sync.mockClear();

      store().deleteAccount(loan.id);

      expect(store().categories.find(c => c.id === categoryId)).toBeUndefined();
      expect(store().billReminders[0]).toMatchObject({ accountId: undefined, categoryId: undefined });
      expect(sent().map(r => `${r.method} ${r.url}`)).toEqual([
        `DELETE /api/accounts/${loan.id}`,
        `DELETE /api/categories/${categoryId}`,
      ]);
    });

    test('deleting one of two credit cards keeps their shared category', () => {
      const visa = addAccount('Visa', 'credit');
      const amex = addAccount('Amex', 'credit');
      const categoryId = accountById(visa.id).linkedCategoryId!;
      sync.mockClear();

      store().deleteAccount(visa.id);

      expect(store().categories.find(c => c.id === categoryId)).toBeDefined();
      expect(accountById(amex.id).linkedCategoryId).toBe(categoryId);
      expect(sent().map(r => `${r.method} ${r.url}`)).toEqual([`DELETE /api/accounts/${visa.id}`]);
    });
  });

  describe('budget templates', () => {
    test('applying a template leaves other assignments in the month alone', () => {
      // Given: a template covering one category, and another category already assigned
      const rent = addCategory('Rent');
      const fun = addCategory('Fun');
      store().setCategoryGoal(rent.id, 900);
      store().saveCurrentAsTemplate('Basics');
      store().setCategoryAssignment('2026-11', fun.id, 75);
      sync.mockClear();

      // When: the template is applied
      store().applyBudgetTemplate(store().budgetTemplates[0].id, '2026-11');

      // Then: the month has both, and only the template's entry is sent
      expect(store().monthlyAssignments[store().currentBudgetId]['2026-11']).toEqual({ [rent.id]: 900, [fun.id]: 75 });
      expect(sent()[0].body.assignments).toEqual([{ monthKey: '2026-11', categoryId: rent.id, amount: 900 }]);
    });

    test('entries for categories that no longer exist are skipped', () => {
      // Given: a template that still mentions a deleted category
      const rent = addCategory('Rent');
      const gone = addCategory('Gone');
      store().setCategoryGoal(rent.id, 900);
      store().setCategoryGoal(gone.id, 40);
      store().saveCurrentAsTemplate('Basics');
      store().deleteCategory(gone.id);
      sync.mockClear();

      // When: it is applied
      store().applyBudgetTemplate(store().budgetTemplates[0].id, '2026-11');

      // Then: the dead category is not assigned or sent (the server would reject the whole batch)
      expect(store().monthlyAssignments[store().currentBudgetId]['2026-11']).toEqual({ [rent.id]: 900 });
      expect(sent()[0].body.assignments.map((a: any) => a.categoryId)).toEqual([rent.id]);
    });
  });

  describe('loading from the server', () => {
    const budget = (id: string, name: string) => ({
      id, name, createdAt: '2026-01-01T00:00:00.000Z', currency: 'TTD',
      currencyPlacement: 'before' as const, numberFormat: '1,234.56' as const, dateFormat: 'DD/MM/YYYY' as const,
    });
    const snapshot = (): ServerBudgetData => ({
      budgets: [budget('b-first', 'Home'), budget('b-second', 'Business')],
      currentBudgetId: 'b-first',
      accounts: [], trackingAccounts: [], categoryGroups: [], categories: [], transactions: [],
      monthlyAssignments: {}, budgetTemplates: [], billReminders: [],
    });

    test('a reload stays on the budget that was open', () => {
      // Given: the second budget is open
      store().hydrateFromServer(snapshot());
      store().switchBudget('b-second');

      // When: data is loaded again
      store().hydrateFromServer(snapshot());

      // Then: it is still open
      expect(store().currentBudgetId).toBe('b-second');
    });

    test('falls back to the default when the open budget no longer exists', () => {
      store().hydrateFromServer(snapshot());
      store().switchBudget('b-second');

      store().hydrateFromServer({ ...snapshot(), budgets: [budget('b-first', 'Home')] });

      expect(store().currentBudgetId).toBe('b-first');
    });
  });
});
