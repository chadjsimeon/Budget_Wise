import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/syncQueue', () => ({ syncToServer: vi.fn() }));

import { syncToServer } from '@/lib/syncQueue';
import { useStore } from '@/lib/store';

// What the store sends to the server, as opposed to what it does locally
// (covered in store.spec.ts).

const sync = vi.mocked(syncToServer);

type SentRequest = { method: string; url: string; body: any };
const sent = (): SentRequest[] =>
  sync.mock.calls.map(([method, url, body]) => ({ method, url, body }));
const lastSent = () => sent()[sent().length - 1];

function addChecking(opening = 1000) {
  return useStore.getState().addAccount(
    { name: 'Checking', type: 'checking', balance: 0, isActive: true },
    opening,
  );
}

function addCategory(name = 'Groceries') {
  const { addCategoryGroup, addCategory } = useStore.getState();
  addCategoryGroup({ name: 'Group' });
  const groupId = useStore.getState().categoryGroups[0].id;
  addCategory({ name, groupId });
  return useStore.getState().categories.find(c => c.name === name)!;
}

describe('store → server payloads', () => {
  beforeEach(() => {
    useStore.getState().clearState();
    sync.mockClear();
  });

  describe('account balances are left to the server', () => {
    test('adding a transaction sends the transaction only, no balance', () => {
      // Given: an account
      const account = addChecking();

      // When: a transaction is added
      useStore.getState().addTransaction({
        accountId: account.id, date: '2026-11-15', payee: 'Shop', amount: -30, cleared: false,
      });

      // Then: the request carries no client-computed balance
      const request = lastSent();
      expect(request.url).toBe('/api/transactions');
      expect(request.body.transaction.amount).toBe(-30);
      expect(request.body).not.toHaveProperty('accountUpdate');
      expect(request.body).not.toHaveProperty('accountUpdates');
    });

    test('editing and deleting a transaction send no balances either', () => {
      const account = addChecking();
      useStore.getState().addTransaction({
        accountId: account.id, date: '2026-11-15', payee: 'Shop', amount: -30, cleared: false,
      });
      const tx = useStore.getState().transactions.find(t => t.payee === 'Shop')!;

      useStore.getState().updateTransaction(tx.id, { amount: -50 });
      expect(lastSent().body).not.toHaveProperty('accountUpdates');
      expect(useStore.getState().accounts[0].balance).toBe(950);

      useStore.getState().deleteTransaction(tx.id);
      expect(lastSent().body).not.toHaveProperty('accountUpdates');
      expect(useStore.getState().accounts[0].balance).toBe(1000);
    });

    test('an edit that does not change the amount leaves the balance alone', () => {
      const account = addChecking();
      useStore.getState().addTransaction({
        accountId: account.id, date: '2026-11-15', payee: 'Shop', amount: -30.1, cleared: false,
      });
      const tx = useStore.getState().transactions.find(t => t.payee === 'Shop')!;
      const before = useStore.getState().accounts[0];

      useStore.getState().updateTransaction(tx.id, { cleared: true });

      // Same object: no float round trip of subtracting and re-adding the amount
      expect(useStore.getState().accounts[0]).toBe(before);
    });
  });

  describe('cleared fields are sent as null', () => {
    test('removing a transaction category', () => {
      // Given: a categorised transaction
      const account = addChecking();
      const category = addCategory();
      useStore.getState().addTransaction({
        accountId: account.id, date: '2026-11-15', payee: 'Shop', amount: -30,
        categoryId: category.id, cleared: false,
      });
      const tx = useStore.getState().transactions.find(t => t.payee === 'Shop')!;

      // When: the category is cleared
      useStore.getState().updateTransaction(tx.id, { categoryId: undefined });

      // Then: the server is told to null it, rather than the key being dropped
      expect(lastSent().body.updates).toEqual({ categoryId: null });
    });

    test('removing optional bill reminder fields', () => {
      useStore.getState().addBillReminder({
        name: 'Rent', amount: 100, frequency: 'monthly', dueDay: 1, isActive: true,
        autoCreateTransaction: false, reminderDaysBefore: 3, notes: 'note',
      });
      const reminder = useStore.getState().billReminders[0];

      useStore.getState().updateBillReminder(reminder.id, { notes: undefined, accountId: undefined });

      expect(lastSent().body).toMatchObject({ notes: null, accountId: null });
    });

    test('a required field that is undefined is not turned into null', () => {
      const account = addChecking();

      useStore.getState().updateAccount(account.id, { name: undefined, interestRate: undefined });

      const { body } = lastSent();
      expect(body.name).toBeUndefined();
      expect(body.interestRate).toBeNull();
    });

    test('deleting a category unlinks its accounts on the server first', () => {
      // Given: a credit card linked to the shared payments category
      const card = useStore.getState().addAccount(
        { name: 'Visa', type: 'credit', balance: 0, isActive: true },
      );
      const categoryId = useStore.getState().accounts.find(a => a.id === card.id)!.linkedCategoryId!;
      sync.mockClear();

      // When: that category is deleted
      useStore.getState().deleteCategory(categoryId);

      // Then: the unlink goes out before the delete
      expect(sent().map(r => `${r.method} ${r.url}`)).toEqual([
        `PATCH /api/accounts/${card.id}`,
        `DELETE /api/categories/${categoryId}`,
      ]);
      expect(sent()[0].body.linkedCategoryId).toBeNull();
    });

    test('changing a loan to another type clears the link on both sides', () => {
      // Given: a loan with its auto-created payment category
      const loan = useStore.getState().addAccount(
        { name: 'Car', type: 'loan', balance: 0, isActive: true, monthlyPayment: 300 },
      );
      const categoryId = useStore.getState().accounts.find(a => a.id === loan.id)!.linkedCategoryId!;
      sync.mockClear();

      // When: it is changed to a different account type
      useStore.getState().updateAccount(loan.id, { type: 'checking' });

      // Then: both the category and the account are unlinked on the server
      expect(sent()).toEqual([
        { method: 'PATCH', url: `/api/categories/${categoryId}`, body: { budgetId: loan.budgetId, linkedAccountId: null } },
        { method: 'PATCH', url: `/api/accounts/${loan.id}`, body: { budgetId: loan.budgetId, type: 'checking', linkedCategoryId: null } },
      ]);
    });
  });
});
