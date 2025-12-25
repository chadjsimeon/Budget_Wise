import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Account } from '@/lib/store';
import {
  calculateAmortization,
  formatPayoffDate,
  formatTimeRemaining,
  LoanProjection
} from '@/lib/loanCalculations';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line } from 'recharts';
import { X } from 'lucide-react';

interface PayoffSimulatorProps {
  account: Account;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formatCurrency: (amount: number) => string;
  onSavePayment?: (newPayment: number) => void;
}

export function PayoffSimulator({
  account,
  open,
  onOpenChange,
  formatCurrency,
  onSavePayment
}: PayoffSimulatorProps) {
  const [monthlyPayment, setMonthlyPayment] = useState(account.monthlyPayment || 0);
  const [oneTimeExtra, setOneTimeExtra] = useState<number>(0);

  // Calculate projection with adjusted payment
  const projection = useMemo((): LoanProjection | null => {
    try {
      if (!account.interestRate || !monthlyPayment) {
        return null;
      }

      // Calculate base projection
      const baseProjection = calculateAmortization(
        account.balance,
        account.interestRate,
        monthlyPayment,
        new Date()
      );

      // If there's a one-time extra payment, recalculate
      if (oneTimeExtra > 0) {
        const newBalance = account.balance + oneTimeExtra; // Adding because balance is negative
        return calculateAmortization(
          newBalance,
          account.interestRate,
          monthlyPayment,
          new Date()
        );
      }

      return baseProjection;
    } catch (error) {
      console.error('Error calculating projection:', error);
      return null;
    }
  }, [account.balance, account.interestRate, monthlyPayment, oneTimeExtra]);

  // Calculate original projection (with current payment)
  const originalProjection = useMemo((): LoanProjection | null => {
    try {
      if (!account.interestRate || !account.monthlyPayment) {
        return null;
      }

      return calculateAmortization(
        account.balance,
        account.interestRate,
        account.monthlyPayment,
        new Date()
      );
    } catch (error) {
      return null;
    }
  }, [account.balance, account.interestRate, account.monthlyPayment]);

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!projection) return [];

    const data = [];

    // Sample the schedule to keep chart readable
    const sampleRate = Math.max(1, Math.floor(projection.schedule.length / 20));

    projection.schedule.forEach((row, index) => {
      if (index % sampleRate === 0 || index === projection.schedule.length - 1) {
        data.push({
          month: index + 1,
          current: row.balance,
          original: originalProjection?.schedule[index]?.balance || null,
          label: row.date
        });
      }
    });

    return data;
  }, [projection, originalProjection]);

  const handleSavePayment = () => {
    if (onSavePayment && monthlyPayment !== account.monthlyPayment) {
      onSavePayment(monthlyPayment);
    }
    onOpenChange(false);
  };

  if (!projection) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Loan Payoff Simulator</DialogTitle>
          </DialogHeader>
          <div className="p-8 text-center text-slate-500">
            Unable to calculate payoff simulation.
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="text-xl font-semibold">Loan Payoff Simulator</DialogTitle>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
        </DialogHeader>

        <div className="grid grid-cols-[200px_1fr] gap-6 py-4">
          {/* Left Panel */}
          <div className="space-y-6">
            {/* Required Minimum Payment */}
            <div className="text-center py-4 bg-slate-50 rounded-lg">
              <div className="text-2xl font-bold text-slate-700">
                {formatCurrency(account.monthlyPayment || 0)}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Required Minimum Payment
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
                min={account.monthlyPayment || 0}
                value={monthlyPayment}
                onChange={(e) => setMonthlyPayment(parseFloat(e.target.value) || 0)}
                className="text-right font-medium"
              />
              <p className="text-xs text-slate-500">
                {formatCurrency(account.monthlyPayment || 0)} is your current monthly target.
              </p>
            </div>

            {/* Payoff Date */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Payoff Date</Label>
              <div className="px-3 py-2 bg-slate-50 rounded-md text-sm font-medium text-slate-700">
                {formatPayoffDate(projection.payoffDate)}
              </div>
              <p className="text-xs text-slate-500">
                You have {projection.monthsRemaining} payments remaining on your loan.
              </p>
            </div>

            {/* One Time Extra Payment */}
            <div className="space-y-2">
              <Label htmlFor="oneTimeExtra" className="text-sm font-semibold">
                One time extra in {format(new Date(), 'MMM')}
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
                Extra one-off payments can have a large impact on your loan.
              </p>
            </div>
          </div>

          {/* Right Panel */}
          <div className="space-y-4">
            {/* Chart */}
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorSimulator" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    stroke="#94a3b8"
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="#94a3b8"
                    tickFormatter={(value) => formatCurrency(value)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '12px'
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  {/* Current Track */}
                  <Area
                    type="monotone"
                    dataKey="current"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#colorSimulator)"
                    name="Current Track"
                  />
                  {/* Original track (dashed) */}
                  {originalProjection && (
                    <Line
                      type="monotone"
                      dataKey="original"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      name="Past Balance"
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Metrics Header */}
            <div className="text-center py-2 bg-slate-50 rounded-lg">
              <p className="text-sm font-medium text-slate-600">
                Paying {formatCurrency(monthlyPayment)} every month
              </p>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="shadow-sm">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-slate-700">
                    {formatCurrency(projection.totalInterest)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Interest Remaining
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-slate-700">
                    {formatTimeRemaining(projection.monthsRemaining)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Time Remaining
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Remaining to Pay */}
            <div className="space-y-3 pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-slate-600">Remaining to Pay</span>
                <span className="text-lg font-bold text-slate-700">
                  {formatCurrency(projection.totalPaid)}
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
                  {formatCurrency(projection.totalInterest)}
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
