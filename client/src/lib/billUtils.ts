import { addDays, addWeeks, addMonths, addYears, startOfDay, isBefore, isEqual, isAfter, differenceInDays, parse } from 'date-fns';

export type BillFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
export type BillStatus = 'overdue' | 'due-today' | 'upcoming' | 'future';

export interface BillReminder {
  id: string;
  budgetId: string;
  name: string;
  amount: number;
  frequency: BillFrequency;
  dueDay: number; // 1-31 for monthly/quarterly, 0-6 (Sun-Sat) for weekly/biweekly
  dueDateOverride?: string; // "YYYY-MM-DD" for yearly/quarterly
  categoryId?: string;
  accountId?: string;
  isActive: boolean;
  autoCreateTransaction: boolean;
  reminderDaysBefore: number;
  lastPaidDate?: string; // "YYYY-MM-DD"
  notes?: string;
  createdAt: Date;
}

export function getNextDueDate(reminder: BillReminder, fromDate: Date = new Date()): Date {
  const today = startOfDay(fromDate);

  if (reminder.frequency === 'yearly' || (reminder.frequency === 'quarterly' && reminder.dueDateOverride)) {
    if (reminder.dueDateOverride) {
      const base = parse(reminder.dueDateOverride, 'yyyy-MM-dd', new Date());
      let next = new Date(today.getFullYear(), base.getMonth(), base.getDate());

      if (reminder.frequency === 'quarterly') {
        // Find next quarterly occurrence from the base date
        const baseMonth = base.getMonth();
        for (let i = 0; i < 4; i++) {
          const candidateMonth = (baseMonth + i * 3) % 12;
          const candidateYear = today.getFullYear() + (candidateMonth < baseMonth && i > 0 ? 1 : 0);
          const candidate = new Date(candidateYear, candidateMonth, Math.min(base.getDate(), daysInMonth(candidateYear, candidateMonth)));
          if (!isBefore(candidate, today)) {
            return candidate;
          }
        }
        // All this year passed, start next year
        return new Date(today.getFullYear() + 1, baseMonth, Math.min(base.getDate(), daysInMonth(today.getFullYear() + 1, baseMonth)));
      }

      // Yearly
      if (isBefore(next, today)) {
        next = new Date(today.getFullYear() + 1, base.getMonth(), base.getDate());
      }
      return next;
    }
  }

  if (reminder.frequency === 'monthly' || reminder.frequency === 'quarterly') {
    const dueDay = Math.min(reminder.dueDay, daysInMonth(today.getFullYear(), today.getMonth()));
    let next = new Date(today.getFullYear(), today.getMonth(), dueDay);

    if (isBefore(next, today)) {
      const increment = reminder.frequency === 'quarterly' ? 3 : 1;
      next = addMonths(next, increment);
    }

    // Clamp day for months with fewer days
    const maxDay = daysInMonth(next.getFullYear(), next.getMonth());
    if (reminder.dueDay > maxDay) {
      next.setDate(maxDay);
    }

    return next;
  }

  if (reminder.frequency === 'weekly' || reminder.frequency === 'biweekly') {
    const currentDayOfWeek = today.getDay();
    let daysUntil = reminder.dueDay - currentDayOfWeek;
    if (daysUntil < 0) daysUntil += 7;
    if (daysUntil === 0) return today;

    const next = addDays(today, daysUntil);
    return next;
  }

  return today;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function getBillStatus(reminder: BillReminder, today: Date = new Date()): BillStatus {
  const todayStart = startOfDay(today);
  const nextDue = getNextDueDate(reminder, today);

  // Check if overdue: lastPaidDate is before the previous occurrence
  if (reminder.lastPaidDate) {
    const lastPaid = startOfDay(parse(reminder.lastPaidDate, 'yyyy-MM-dd', new Date()));
    // If last paid is before today and the next due is today or earlier, it's overdue
    if (isEqual(nextDue, todayStart) || isBefore(nextDue, todayStart)) {
      if (isBefore(lastPaid, nextDue)) {
        return 'overdue';
      }
    }
  } else {
    // Never paid - if due date is today or past, it's overdue
    if (isBefore(nextDue, todayStart)) {
      return 'overdue';
    }
  }

  if (isEqual(nextDue, todayStart)) {
    return 'due-today';
  }

  const daysUntilDue = differenceInDays(nextDue, todayStart);
  if (daysUntilDue <= reminder.reminderDaysBefore) {
    return 'upcoming';
  }

  return 'future';
}

export interface UpcomingBill {
  reminder: BillReminder;
  nextDueDate: Date;
  status: BillStatus;
  daysUntilDue: number;
}

export function getUpcomingBills(
  reminders: BillReminder[],
  budgetId: string,
  daysAhead: number = 14,
  today: Date = new Date()
): UpcomingBill[] {
  const todayStart = startOfDay(today);
  const cutoff = addDays(todayStart, daysAhead);

  return reminders
    .filter(r => r.budgetId === budgetId && r.isActive)
    .map(reminder => {
      const nextDueDate = getNextDueDate(reminder, today);
      const status = getBillStatus(reminder, today);
      const daysUntilDue = differenceInDays(nextDueDate, todayStart);
      return { reminder, nextDueDate, status, daysUntilDue };
    })
    .filter(bill => {
      // Include overdue bills regardless of date
      if (bill.status === 'overdue' || bill.status === 'due-today') return true;
      // Include upcoming bills within the window
      return !isAfter(bill.nextDueDate, cutoff);
    })
    .sort((a, b) => {
      // Sort: overdue first, then by date
      const statusOrder: Record<BillStatus, number> = { 'overdue': 0, 'due-today': 1, 'upcoming': 2, 'future': 3 };
      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      if (statusDiff !== 0) return statusDiff;
      return a.nextDueDate.getTime() - b.nextDueDate.getTime();
    });
}
