import { format, addMonths } from 'date-fns';

export interface AmortizationRow {
  month: number;
  date: string;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
}

export interface LoanProjection {
  payoffDate: Date;
  monthsRemaining: number;
  totalInterest: number;
  totalPaid: number;
  schedule: AmortizationRow[];
}

/**
 * Calculate amortization schedule for a loan
 * @param currentBalance - Current loan balance (positive number)
 * @param annualRate - Annual interest rate as percentage (e.g., 12.0 for 12%)
 * @param monthlyPayment - Monthly payment amount
 * @param startDate - Start date for calculations (defaults to today)
 * @returns Loan projection with schedule and totals
 */
export function calculateAmortization(
  currentBalance: number,
  annualRate: number,
  monthlyPayment: number,
  startDate: Date = new Date()
): LoanProjection {
  const monthlyRate = (annualRate / 100) / 12;
  let remainingBalance = Math.abs(currentBalance);
  const schedule: AmortizationRow[] = [];
  let month = 1;
  let totalInterest = 0;

  while (remainingBalance > 0.01 && month <= 600) { // Cap at 50 years
    const interestPayment = remainingBalance * monthlyRate;
    const principalPayment = Math.min(
      monthlyPayment - interestPayment,
      remainingBalance
    );

    if (principalPayment <= 0) {
      // Payment doesn't cover interest - loan will never be paid off
      throw new Error('Monthly payment must be greater than monthly interest');
    }

    remainingBalance -= principalPayment;
    totalInterest += interestPayment;

    schedule.push({
      month,
      date: format(addMonths(startDate, month - 1), 'MMM dd, yyyy'),
      payment: principalPayment + interestPayment,
      principal: principalPayment,
      interest: interestPayment,
      balance: Math.max(remainingBalance, 0)
    });

    month++;
  }

  const payoffDate = addMonths(startDate, schedule.length);

  return {
    payoffDate,
    monthsRemaining: schedule.length,
    totalInterest,
    totalPaid: Math.abs(currentBalance) + totalInterest,
    schedule
  };
}

/**
 * Calculate original schedule (from loan start)
 * @param originalBalance - Original loan amount
 * @param annualRate - Annual interest rate as percentage
 * @param monthlyPayment - Monthly payment amount
 * @param startDate - Loan start date
 * @returns Array of amortization rows
 */
export function calculateOriginalSchedule(
  originalBalance: number,
  annualRate: number,
  monthlyPayment: number,
  startDate: Date
): AmortizationRow[] {
  const projection = calculateAmortization(
    originalBalance,
    annualRate,
    monthlyPayment,
    startDate
  );
  return projection.schedule;
}

/**
 * Get loan progress percentage
 * @param currentBalance - Current loan balance
 * @param originalBalance - Original loan amount
 * @returns Progress percentage (0-100)
 */
export function getLoanProgress(
  currentBalance: number,
  originalBalance: number
): number {
  if (!originalBalance || originalBalance === 0) return 0;
  const paid = originalBalance - Math.abs(currentBalance);
  return (paid / originalBalance) * 100;
}

/**
 * Format payoff date as readable string
 * @param date - Payoff date
 * @returns Formatted date string (e.g., "Nov 2030")
 */
export function formatPayoffDate(date: Date): string {
  return format(date, 'MMM yyyy');
}

/**
 * Calculate months and years remaining
 * @param monthsRemaining - Number of months
 * @returns Formatted string (e.g., "4 yrs, 11 mos")
 */
export function formatTimeRemaining(monthsRemaining: number): string {
  const years = Math.floor(monthsRemaining / 12);
  const months = monthsRemaining % 12;

  if (years === 0) {
    return `${months} ${months === 1 ? 'mo' : 'mos'}`;
  } else if (months === 0) {
    return `${years} ${years === 1 ? 'yr' : 'yrs'}`;
  } else {
    return `${years} ${years === 1 ? 'yr' : 'yrs'}, ${months} ${months === 1 ? 'mo' : 'mos'}`;
  }
}

/**
 * Calculate minimum payment required to cover interest
 * @param balance - Current loan balance
 * @param annualRate - Annual interest rate as percentage
 * @returns Minimum monthly payment needed
 */
export function calculateMinimumInterestPayment(
  balance: number,
  annualRate: number
): number {
  const monthlyRate = (annualRate / 100) / 12;
  return Math.abs(balance) * monthlyRate;
}

// ─── Single-payment breakdown ────────────────────────────────────────────────

export interface LoanPaymentBreakdown {
  interest: number;   // cost of borrowing this month (always ≥ 0)
  principal: number;  // amount that reduces the balance (0 if payment ≤ interest)
}

/**
 * Split one loan payment into its interest and principal components.
 * @param balanceAbs   Absolute value of the current loan balance (positive number).
 * @param annualRate   Annual interest rate as a percentage (e.g. 12.0 for 12 %).
 * @param paymentAmount Absolute value of the payment being made.
 */
export function calculatePaymentBreakdown(
  balanceAbs: number,
  annualRate: number,
  paymentAmount: number
): LoanPaymentBreakdown {
  const interest = balanceAbs * (annualRate / 100) / 12;
  const principal = Math.max(paymentAmount - interest, 0);
  return { interest, principal };
}

// Credit card minimum payment rules
export const CC_MIN_RATE = 0.02;  // 2% of outstanding balance
export const CC_MIN_FIXED = 25;   // TTD $25 floor

/**
 * Calculate credit card minimum monthly payment
 * Rule: max(2% of balance, TTD $25)
 */
export function calcCreditCardMinPayment(balance: number): number {
  const abs = Math.abs(balance);
  if (abs <= 0) return 0;
  return Math.max(abs * CC_MIN_RATE, CC_MIN_FIXED);
}

/**
 * Project credit card payoff paying only the minimum each month.
 * The minimum recalculates each month as the balance falls.
 */
export function calculateCreditCardMinimumAmortization(
  currentBalance: number,
  annualRate: number,
  startDate: Date = new Date()
): LoanProjection {
  const monthlyRate = (annualRate / 100) / 12;
  let remaining = Math.abs(currentBalance);
  const schedule: AmortizationRow[] = [];
  let month = 1;
  let totalInterest = 0;

  while (remaining > 0.01 && month <= 600) {
    const interest = remaining * monthlyRate;
    // Minimum payment for this month (recalculated on current balance)
    const minPayment = Math.max(remaining * CC_MIN_RATE, CC_MIN_FIXED);
    // Cap at balance + interest so we never overpay
    const payment = Math.min(minPayment, remaining + interest);
    const principal = Math.max(payment - interest, 0);

    if (principal <= 0) break; // Interest eating entire minimum – stop

    remaining = Math.max(remaining - principal, 0);
    totalInterest += interest;

    schedule.push({
      month,
      date: format(addMonths(startDate, month - 1), 'MMM dd, yyyy'),
      payment,
      principal,
      interest,
      balance: remaining,
    });

    month++;
  }

  const payoffDate = addMonths(startDate, schedule.length);
  return {
    payoffDate,
    monthsRemaining: schedule.length,
    totalInterest,
    totalPaid: Math.abs(currentBalance) + totalInterest,
    schedule,
  };
}
