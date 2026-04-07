import { useState, useMemo } from 'react';
import { Account, Transaction } from '@/lib/store';
import {
  calcCreditCardMinPayment,
  calculateCreditCardMinimumAmortization,
  formatPayoffDate,
  formatTimeRemaining,
} from '@/lib/loanCalculations';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Calculator, AlertTriangle } from 'lucide-react';
import { PayoffSimulator } from '@/components/modals/PayoffSimulator';

interface CreditCardPlannerProps {
  account: Account;
  transactions: Transaction[];
  formatCurrency: (amount: number) => string;
}

interface MetricCardProps {
  value: string;
  label: string;
  highlight?: boolean;
  sublabel?: string;
}

function MetricCard({ value, label, highlight = false, sublabel }: MetricCardProps) {
  return (
    <Card className={highlight ? 'shadow-sm border-amber-200 bg-amber-50' : 'shadow-sm'}>
      <CardContent className="p-5">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          {label}
        </div>
        <div className={highlight ? 'text-4xl font-bold text-amber-700' : 'text-2xl font-bold text-slate-800'}>
          {value}
        </div>
        {sublabel && (
          <div className="text-xs text-slate-500 mt-1">{sublabel}</div>
        )}
      </CardContent>
    </Card>
  );
}

export function CreditCardPlanner({ account, transactions, formatCurrency }: CreditCardPlannerProps) {
  const [showSimulator, setShowSimulator] = useState(false);

  const interestRate = account.interestRate || 25;
  const balance = Math.abs(account.balance);
  const minPayment = calcCreditCardMinPayment(account.balance, interestRate);

  // Full minimum-payment-only trajectory
  const minimumProjection = useMemo(() => {
    if (!balance) return null;
    try {
      return calculateCreditCardMinimumAmortization(account.balance, interestRate);
    } catch {
      return null;
    }
  }, [account.balance, interestRate, balance]);

  // Chart data — balance over time paying minimums only
  const chartData = useMemo(() => {
    if (!minimumProjection) return [];
    const len = minimumProjection.schedule.length;
    const sampleRate = Math.max(1, Math.floor(len / 20));
    return minimumProjection.schedule
      .filter((_, i) => i % sampleRate === 0 || i === len - 1)
      .map((row) => ({
        balance: row.balance,
        label: row.date,
      }));
  }, [minimumProjection]);

  return (
    <div className="space-y-8 p-2">
      {/* 2×2 Metrics Grid */}
      <div className="grid grid-cols-2 gap-4">
        <MetricCard value={formatCurrency(balance)} label="Balance Owing" />
        <MetricCard value={`${interestRate}%`} label="Interest Rate (APR)" />
        <MetricCard value={formatCurrency(minPayment)} label="Minimum Monthly Payment" />
        <MetricCard
          value={minimumProjection ? formatPayoffDate(minimumProjection.payoffDate) : '—'}
          label="Payoff at Minimums"
          highlight
          sublabel={minimumProjection ? `${formatTimeRemaining(minimumProjection.monthsRemaining)} from now` : undefined}
        />
      </div>

      {/* Minimum-payment warning */}
      {minimumProjection && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-4">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 leading-relaxed">
            Paying only the minimum of{' '}
            <strong>{formatCurrency(minPayment)}/mo</strong> will take{' '}
            <strong>{formatTimeRemaining(minimumProjection.monthsRemaining)}</strong> to pay off
            and cost{' '}
            <strong>{formatCurrency(minimumProjection.totalInterest)}</strong> in total interest.{' '}
            Use the simulator below to see how paying more accelerates your payoff.
          </p>
        </div>
      )}

      {/* Progress chart */}
      <Accordion type="single" collapsible defaultValue="progress">
        <AccordionItem value="progress">
          <AccordionTrigger className="text-base font-semibold">
            Repayment Outlook
          </AccordionTrigger>
          <AccordionContent>
            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Paying minimums only
                    </div>
                    <div className="text-2xl font-bold text-slate-800">
                      {minimumProjection
                        ? formatTimeRemaining(minimumProjection.monthsRemaining)
                        : '—'}{' '}
                      to pay off
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSimulator(true)}
                    className="flex items-center gap-2 shrink-0"
                  >
                    <Calculator className="w-4 h-4" />
                    Open Payoff Simulator
                  </Button>
                </div>

                {chartData.length > 0 && (
                  <div className="h-[260px] mb-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={chartData}
                        margin={{ top: 8, right: 16, left: 16, bottom: 8 }}
                      >
                        <defs>
                          <linearGradient id="colorCC" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11 }}
                          stroke="#94a3b8"
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          stroke="#94a3b8"
                          tickLine={false}
                          width={90}
                          tickFormatter={(v) => formatCurrency(v)}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#fff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            fontSize: '13px',
                          }}
                          formatter={(value: number) => [formatCurrency(value), 'Balance']}
                        />
                        <Area
                          type="monotone"
                          dataKey="balance"
                          stroke="#f59e0b"
                          strokeWidth={2}
                          fill="url(#colorCC)"
                          name="Balance"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {minimumProjection && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 rounded-lg p-4">
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                        Total Interest
                      </div>
                      <div className="text-xl font-bold text-red-600">
                        {formatCurrency(minimumProjection.totalInterest)}
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                        Total Paid
                      </div>
                      <div className="text-xl font-bold text-slate-800">
                        {formatCurrency(minimumProjection.totalPaid)}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Transaction history */}
      <Accordion type="single" collapsible>
        <AccordionItem value="transactions">
          <AccordionTrigger className="text-base font-semibold">
            Transaction History ({transactions.length})
          </AccordionTrigger>
          <AccordionContent>
            <Card className="shadow-sm">
              <CardContent className="p-6">
                {transactions.length === 0 ? (
                  <p className="text-slate-500 text-center py-4">No transactions yet</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {transactions.slice(0, 10).map((tx) => (
                      <div
                        key={tx.id}
                        className="flex justify-between items-center py-3"
                      >
                        <div>
                          <div className="font-medium text-slate-700">{tx.payee}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{tx.date}</div>
                        </div>
                        <div
                          className={`font-semibold ${
                            tx.amount >= 0 ? 'text-green-600' : 'text-slate-700'
                          }`}
                        >
                          {formatCurrency(tx.amount)}
                        </div>
                      </div>
                    ))}
                    {transactions.length > 10 && (
                      <p className="text-sm text-slate-500 text-center pt-3">
                        And {transactions.length - 10} more transactions…
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Payoff Simulator */}
      <PayoffSimulator
        account={account}
        open={showSimulator}
        onOpenChange={setShowSimulator}
        formatCurrency={formatCurrency}
      />
    </div>
  );
}
