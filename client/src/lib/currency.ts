import { useStore, type Budget } from './store';

/**
 * Maps number format patterns to locale strings for Intl.NumberFormat
 */
const numberFormatToLocale: Record<Budget['numberFormat'], string> = {
  '1,234.56': 'en-US',  // Comma thousands separator, period decimal
  '1.234,56': 'de-DE',  // Period thousands separator, comma decimal
  '1 234.56': 'fr-FR',  // Space thousands separator, period decimal
  '1 234,56': 'fr-CA',  // Space thousands separator, comma decimal
};

/**
 * Formats a number as currency based on budget settings
 *
 * @param amount - The numeric amount to format
 * @param budget - The budget object containing currency preferences
 * @returns Formatted currency string (e.g., "$1,234.56" or "1.234,56 €")
 */
export function formatCurrency(amount: number, budget: Budget): string {
  const locale = numberFormatToLocale[budget.numberFormat] || 'en-US';

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: budget.currency,
  }).format(amount);
}

/**
 * React hook that returns a currency formatter function using the current budget's settings
 *
 * @returns A function that formats amounts according to the current budget
 *
 * @example
 * ```tsx
 * const formatCurrency = useCurrencyFormatter();
 * return <div>{formatCurrency(1234.56)}</div>
 * ```
 */
export function useCurrencyFormatter(): (amount: number) => string {
  const { budgets, currentBudgetId } = useStore();
  const currentBudget = budgets.find(b => b.id === currentBudgetId);

  if (!currentBudget) {
    // Fallback to USD with standard formatting if no budget found
    return (amount: number) =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(amount);
  }

  return (amount: number) => formatCurrency(amount, currentBudget);
}
