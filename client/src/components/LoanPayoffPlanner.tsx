import { useState, useMemo } from 'react';
import { Account, Transaction } from '@/lib/store';
import {
  calculateAmortization,
  calculateOriginalSchedule,
  getLoanProgress,
  formatPayoffDate,
  formatTimeRemaining,
  LoanProjection
} from '@/lib/loanCalculations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { Calculator } from 'lucide-react';

interface LoanPayoffPlannerProps {
  account: Account;
  transactions: Transaction[];
  formatCurrency: (amount: number) => string;
}

interface MetricCardProps {
  value: string | number;
  label: string;
  className?: string;
}

function MetricCard({ value, label, className = '' }: MetricCardProps) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-6">
        <div className={`text-2xl font-bold text-slate-700 ${className}`}>
          {value}
        </div>
        <div className="text-sm text-slate-500 mt-1">
          {label}
        </div>
      </CardContent>
    </Card>
  );
}

export function LoanPayoffPlanner({ account, transactions, formatCurrency }: LoanPayoffPlannerProps) {
  const [showSimulator, setShowSimulator] = useState(false);

  // Calculate loan projection
  const projection = useMemo((): LoanProjection | null => {
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
      console.error('Error calculating amortization:', error);
      return null;
    }
  }, [account.balance, account.interestRate, account.monthlyPayment]);

  // Calculate original schedule
  const originalSchedule = useMemo(() => {
    try {
      if (!account.originalBalance || !account.interestRate || !account.monthlyPayment || !account.loanStartDate) {
        return [];
      }

      return calculateOriginalSchedule(
        account.originalBalance,
        account.interestRate,
        account.monthlyPayment,
        new Date(account.loanStartDate)
      );
    } catch (error) {
      console.error('Error calculating original schedule:', error);
      return [];
    }
  }, [account.originalBalance, account.interestRate, account.monthlyPayment, account.loanStartDate]);

  // Calculate progress percentage
  const progress = useMemo(() => {
    if (account.originalBalance) {
      return getLoanProgress(account.balance, account.originalBalance);
    }
    return 0;
  }, [account.balance, account.originalBalance]);

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!projection) return [];

    const data = [];
    const currentMonth = 0; // We start from today

    // Add current balance point
    data.push({
      month: currentMonth,
      current: Math.abs(account.balance),
      original: null,
      label: 'Now'
    });

    // Add future projections (sample every 6 months to keep chart readable)
    const sampleRate = Math.max(1, Math.floor(projection.schedule.length / 20));
    projection.schedule.forEach((row, index) => {
      if (index % sampleRate === 0 || index === projection.schedule.length - 1) {
        data.push({
          month: index + 1,
          current: row.balance,
          original: originalSchedule[index]?.balance || null,
          label: row.date
        });
      }
    });

    return data;
  }, [projection, originalSchedule, account.balance]);

  if (!projection) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p>Unable to calculate loan payoff schedule.</p>
        <p className="text-sm mt-2">Please ensure interest rate and monthly payment are set.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Metrics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          value={formatCurrency(Math.abs(account.balance))}
          label="Remaining Balance"
        />
        <MetricCard
          value={`${account.interestRate || 0}%`}
          label="Interest Rate"
        />
        <MetricCard
          value={formatCurrency(account.monthlyPayment || 0)}
          label="Minimum Payment"
        />
        <MetricCard
          value={formatPayoffDate(projection.payoffDate)}
          label="Payoff Date"
        />
      </div>

      {/* Loan Progress Section */}
      <Accordion type="single" collapsible defaultValue="progress">
        <AccordionItem value="progress">
          <AccordionTrigger className="text-lg font-semibold">
            Your Loan's Progress
          </AccordionTrigger>
          <AccordionContent>
            <Card className="shadow-sm">
              <CardContent className="p-6">
                {/* Progress Header */}
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <div className="text-sm text-slate-500 mb-1">Balance Remaining</div>
                    <div className="text-2xl font-bold">
                      {formatCurrency(Math.abs(account.balance))} ({progress.toFixed(1)}%)
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSimulator(true)}
                    className="flex items-center gap-2"
                  >
                    <Calculator className="w-4 h-4" />
                    Open Payoff Simulator
                  </Button>
                </div>

                {/* Chart */}
                <div className="h-[300px] mb-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorCurrent" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 12 }}
                        stroke="#94a3b8"
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        stroke="#94a3b8"
                        tickFormatter={(value) => formatCurrency(value)}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#fff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          fontSize: '14px'
                        }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      {/* Current Track (blue area with line) */}
                      <Area
                        type="monotone"
                        dataKey="current"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fill="url(#colorCurrent)"
                        name="Current Track"
                      />
                      {/* Original Payment Schedule (gray dashed line) */}
                      {originalSchedule.length > 0 && (
                        <Line
                          type="monotone"
                          dataKey="original"
                          stroke="#9ca3af"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          dot={false}
                          name="Original Payment Schedule"
                        />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Timeline Message */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-slate-700">
                    Your monthly target of <span className="font-semibold">{formatCurrency(account.monthlyPayment || 0)}</span> keeps you on track to pay off this loan in{' '}
                    <span className="font-semibold text-blue-600">{formatTimeRemaining(projection.monthsRemaining)}</span>
                  </p>
                </div>

                {/* Additional Metrics */}
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="text-sm text-slate-500">Total Interest</div>
                    <div className="text-xl font-semibold text-slate-700 mt-1">
                      {formatCurrency(projection.totalInterest)}
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="text-sm text-slate-500">Total Paid</div>
                    <div className="text-xl font-semibold text-slate-700 mt-1">
                      {formatCurrency(projection.totalPaid)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Transaction History (Collapsible) */}
      <Accordion type="single" collapsible>
        <AccordionItem value="transactions">
          <AccordionTrigger className="text-lg font-semibold">
            Payment History ({transactions.length} transactions)
          </AccordionTrigger>
          <AccordionContent>
            <Card className="shadow-sm">
              <CardContent className="p-6">
                {transactions.length === 0 ? (
                  <p className="text-slate-500 text-center py-4">No transactions yet</p>
                ) : (
                  <div className="space-y-2">
                    {transactions.slice(0, 10).map((tx) => (
                      <div key={tx.id} className="flex justify-between items-center py-2 border-b last:border-0">
                        <div>
                          <div className="font-medium text-slate-700">{tx.payee}</div>
                          <div className="text-sm text-slate-500">{tx.date}</div>
                        </div>
                        <div className={`font-semibold ${tx.amount >= 0 ? 'text-green-600' : 'text-slate-700'}`}>
                          {formatCurrency(tx.amount)}
                        </div>
                      </div>
                    ))}
                    {transactions.length > 10 && (
                      <p className="text-sm text-slate-500 text-center pt-2">
                        And {transactions.length - 10} more transactions...
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Payoff Simulator Modal - Placeholder for now */}
      {showSimulator && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl mx-4">
            <CardHeader>
              <CardTitle>Payoff Simulator</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-500">Payoff simulator coming soon...</p>
              <Button onClick={() => setShowSimulator(false)} className="mt-4">
                Close
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
