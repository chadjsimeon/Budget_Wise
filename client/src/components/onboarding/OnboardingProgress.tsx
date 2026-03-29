import { useState } from 'react';
import { CheckCircle2, Circle, X } from 'lucide-react';
import { useStore, BUDGET_ACCOUNT_TYPES } from '@/lib/store';
import { cn } from '@/lib/utils';
import { CreateAccountDialog } from '@/components/modals/CreateAccountDialog';

export function OnboardingProgress() {
  const { accounts, transactions, monthlyAssignments, currentBudgetId, currentMonth } = useStore();
  const [dismissed, setDismissed] = useState(false);

  const budgetAccounts = accounts.filter(
    (a) => a.budgetId === currentBudgetId && a.isActive && BUDGET_ACCOUNT_TYPES.includes(a.type)
  );
  const hasAccounts = budgetAccounts.length > 0;

  const monthAssignments = monthlyAssignments[currentBudgetId]?.[currentMonth] || {};
  const hasAssignments = Object.values(monthAssignments).some((v) => v > 0);

  const hasTransactions = transactions.some((t) => t.budgetId === currentBudgetId);

  const allDone = hasAccounts && hasAssignments && hasTransactions;

  if (allDone || dismissed) return null;

  const steps = [
    { label: 'Add your first account', done: hasAccounts },
    { label: 'Assign money to categories', done: hasAssignments },
    { label: 'Record a transaction', done: hasTransactions },
  ];

  const currentStep = steps.findIndex((s) => !s.done);

  return (
    <div className="fixed bottom-6 right-6 z-50 w-64 bg-white rounded-xl shadow-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-slate-900">Getting Started</p>
        <button
          onClick={() => setDismissed(true)}
          className="text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2">
        {steps.map((step, i) => (
          <div
            key={i}
            className={cn(
              'flex items-center gap-2 text-sm',
              step.done
                ? 'text-slate-400 line-through'
                : i === currentStep
                  ? 'text-slate-900 font-medium'
                  : 'text-slate-400'
            )}
          >
            {step.done ? (
              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
            ) : (
              <Circle
                className={cn(
                  'w-4 h-4 shrink-0',
                  i === currentStep ? 'text-blue-500' : 'text-slate-300'
                )}
              />
            )}
            {step.label}
          </div>
        ))}
      </div>

      {currentStep === 0 && (
        <div className="mt-3">
          <CreateAccountDialog
            trigger={
              <button className="w-full text-center text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 py-1.5 px-3 rounded-md transition-colors">
                + Add Account
              </button>
            }
          />
        </div>
      )}

      {currentStep === 2 && (
        <p className="mt-3 text-xs text-slate-500">
          Go to <strong>All Accounts</strong> in the sidebar and record your first transaction.
        </p>
      )}
    </div>
  );
}
