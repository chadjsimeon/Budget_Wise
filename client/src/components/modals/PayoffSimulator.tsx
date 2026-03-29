import { useState, useMemo, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { Account } from '@/lib/store';
import {
  calculateAmortization,
  calculateCreditCardMinimumAmortization,
  calcCreditCardMinPayment,
  formatPayoffDate,
  formatTimeRemaining,
  LoanProjection,
} from '@/lib/loanCalculations';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
} from 'recharts';
import { X, AlertCircle } from 'lucide-react';

interface PayoffSimulatorProps {
  account: Account;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formatCurrency: (amount: number) => string;
  onSavePayment?: (newPayment: number) => void;
}

function getInitialPayment(account: Account): number {
  if (account.type === 'credit') {
    return calcCreditCardMinPayment(account.balance);
  }
  return account.monthlyPayment || 0;
}

export function PayoffSimulator({
  account,
  open,
  onOpenChange,
  formatCurrency,
  onSavePayment,
}: PayoffSimulatorProps) {
  const isCreditCard = account.type === 'credit';
  const interestRate = account.interestRate || (isCreditCard ? 25 : 0);

  // Snapshot the opening payment when the modal opens — never moves with typing
  const originalPaymentRef = useRef(getInitialPayment(account));

  const [paymentStr, setPaymentStr] = useState(() =>
    getInitialPayment(account).toFixed(2)
  );
  const [oneTimeExtra, setOneTimeExtra] = useState(0);

  // Reset everything when the dialog opens
  useEffect(() => {
    if (open) {
      const init = getInitialPayment(account);
      originalPaymentRef.current = init;
      setPaymentStr(init.toFixed(2));
      setOneTimeExtra(0);
    }
  }, [open]); // intentionally omitting account — snapshot on open only

  // Parse the raw input string into a number (null if invalid)
  const monthlyPayment = useMemo(() => {
    const val = parseFloat(paymentStr);
    return isNaN(val) || val <= 0 ? null : val;
  }, [paymentStr]);

  // Monthly interest at current balance — used for validation
  const monthlyInterest = useMemo(() => {
    if (!interestRate) return 0;
    return Math.abs(account.balance) * (interestRate / 100) / 12;
  }, [account.balance, interestRate]);

  // "Minimum payment" label in the left panel
  const minimumPaymentLabel = isCreditCard
    ? calcCreditCardMinPayment(account.balance)
    : account.monthlyPayment || 0;

  // Inline validation message (never crashes the UI)
  const paymentError = useMemo(() => {
    const val = parseFloat(paymentStr);
    if (isNaN(val) || val <= 0) return 'Enter a valid payment amount.';
    if (interestRate && val <= monthlyInterest) {
      return `Payment must exceed monthly interest of ${formatCurrency(monthlyInterest)}.`;
    }
    return null;
  }, [paymentStr, monthlyInterest, interestRate, formatCurrency]);

  // SOLID line — user's entered payment
  const projection = useMemo((): LoanProjection | null => {
    if (!interestRate || !monthlyPayment || paymentError) return null;
    try {
      const balance =
        oneTimeExtra > 0 ? account.balance + oneTimeExtra : account.balance;
      return calculateAmortization(balance, interestRate, monthlyPayment, new Date());
    } catch {
      return null;
    }
  }, [account.balance, interestRate, monthlyPayment, oneTimeExtra, paymentError]);

  // DOTTED line — baseline (original payment for loans, minimum-only for CC)
  const baselineProjection = useMemo((): LoanProjection | null => {
    if (!interestRate) return null;
    try {
      if (isCreditCard) {
        return calculateCreditCardMinimumAmortization(account.balance, interestRate);
      }
      const op = originalPaymentRef.current;
      if (!op) return null;
      return calculateAmortization(account.balance, interestRate, op, new Date());
    } catch {
      return null;
    }
  }, [account.balance, interestRate, isCreditCard]);

  // Merge both schedules into a single chart dataset
  const chartData = useMemo(() => {
    const maxLen = Math.max(
      projection?.schedule.length || 0,
      baselineProjection?.schedule.length || 0
    );
    if (maxLen === 0) return [];

    const sampleRate = Math.max(1, Math.floor(maxLen / 24));
    const data: Array<{
      month: number;
      current: number | null;
      baseline: number | null;
      label: string;
    }> = [];

    for (let i = 0; i < maxLen; i++) {
      if (i % sampleRate === 0 || i === maxLen - 1) {
        data.push({
          month: i + 1,
          current: projection?.schedule[i]?.balance ?? null,
          baseline: baselineProjection?.schedule[i]?.balance ?? null,
          label:
            projection?.schedule[i]?.date ||
            baselineProjection?.schedule[i]?.date ||
            `Month ${i + 1}`,
        });
      }
    }
    return data;
  }, [projection, baselineProjection]);

  const handleSavePayment = () => {
    if (onSavePayment && monthlyPayment && !isCreditCard) {
      onSavePayment(monthlyPayment);
    }
    onOpenChange(false);
  };

  const baselineLabel = isCreditCard ? 'Paying Minimums Only' : 'Original Payment';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="text-xl font-semibold">
            {isCreditCard ? 'Credit Card' : 'Loan'} Payoff Simulator
          </DialogTitle>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
        </DialogHeader>

        <div className="grid grid-cols-[200px_1fr] gap-6 py-4">
          {/* ── Left Panel ── */}
          <div className="space-y-6">
            {/* Required Minimum */}
            <div className="text-center py-4 bg-slate-50 rounded-lg">
              <div className="text-2xl font-bold text-slate-700">
                {formatCurrency(minimumPaymentLabel)}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {isCreditCard ? 'Minimum Monthly Payment' : 'Required Minimum Payment'}
              </div>
            </div>

            {/* Monthly Payment Input */}
            <div className="space-y-2">
              <Label htmlFor="monthlyPayment" className="text-sm font-semibold">
                Monthly Payment
              </Label>
              <Input
                id="monthlyPayment"
                type="number"
                step="0.01"
                min={0}
                value={paymentStr}
                onChange={(e) => setPaymentStr(e.target.value)}
                className="text-right font-medium"
              />
              {paymentError ? (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  {paymentError}
                </p>
              ) : (
                <p className="text-xs text-slate-500">
                  {formatCurrency(originalPaymentRef.current)} is your {isCreditCard ? 'minimum' : 'current'} payment.
                </p>
              )}
            </div>

            {/* Payoff Date (only when projection is valid) */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Payoff Date</Label>
              <div className="px-3 py-2 bg-slate-50 rounded-md text-sm font-medium text-slate-700">
                {projection ? formatPayoffDate(projection.payoffDate) : '—'}
              </div>
              {projection && (
                <p className="text-xs text-slate-500">
                  {projection.monthsRemaining} payments remaining.
                </p>
              )}
            </div>

            {/* One-Time Extra Payment */}
            <div className="space-y-2">
              <Label htmlFor="oneTimeExtra" className="text-sm font-semibold">
                One-time extra in {format(new Date(), 'MMM')}
              </Label>
              <Input
                id="oneTimeExtra"
                type="number"
                step="0.01"
                min="0"
                value={oneTimeExtra || ''}
                onChange={(e) => setOneTimeExtra(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="text-right"
              />
              <p className="text-xs text-slate-500">
                Extra one-off payments can have a large impact.
              </p>
            </div>
          </div>

          {/* ── Right Panel ── */}
          <div className="space-y-4">
            {/* Chart */}
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorSimulator" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="#94a3b8"
                    tickFormatter={(v) => formatCurrency(v)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  {/* Dotted baseline — original payment / minimum-only */}
                  {baselineProjection && (
                    <Line
                      type="monotone"
                      dataKey="baseline"
                      stroke="#94a3b8"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      name={baselineLabel}
                      connectNulls
                    />
                  )}
                  {/* Solid current track */}
                  <Area
                    type="monotone"
                    dataKey="current"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#colorSimulator)"
                    name="Your Payment"
                    connectNulls
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-6 text-xs text-slate-500 justify-center">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-6 border-t-2 border-dashed border-slate-400" />
                {baselineLabel}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-6 border-t-2 border-blue-500" />
                Your Payment
              </span>
            </div>

            {/* Summary header */}
            <div className="text-center py-2 bg-slate-50 rounded-lg">
              <p className="text-sm font-medium text-slate-600">
                {monthlyPayment && !paymentError
                  ? `Paying ${formatCurrency(monthlyPayment)} every month`
                  : 'Enter a valid monthly payment to see projections'}
              </p>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="shadow-sm">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-slate-700">
                    {projection ? formatCurrency(projection.totalInterest) : '—'}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Interest Remaining</div>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-slate-700">
                    {projection ? formatTimeRemaining(projection.monthsRemaining) : '—'}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Time Remaining</div>
                </CardContent>
              </Card>
            </div>

            {/* Remaining to Pay */}
            <div className="space-y-3 pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-slate-600">Remaining to Pay</span>
                <span className="text-lg font-bold text-slate-700">
                  {projection ? formatCurrency(projection.totalPaid) : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Principal</span>
                <span className="text-sm font-medium text-slate-700">
                  {formatCurrency(Math.abs(account.balance))}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Interest</span>
                <span className="text-sm font-medium text-slate-700">
                  {projection ? formatCurrency(projection.totalInterest) : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSavePayment} className="bg-blue-600 hover:bg-blue-700">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
