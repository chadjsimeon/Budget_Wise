import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, Legend
} from 'recharts';
import { useStore } from '@/lib/store';
import { format, subMonths, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, DollarSign, CreditCard, PiggyBank, TrendingUpIcon } from 'lucide-react';

export default function ReportsPage() {
  const {
    currentBudgetId,
    getNetWorth,
    transactions: allTransactions,
    categories: allCategories,
    categoryGroups: allCategoryGroups,
    budgetAssignments
  } = useStore();

  // Filter by current budget
  const transactions = allTransactions.filter(t => t.budgetId === currentBudgetId);
  const categories = allCategories.filter(c => c.budgetId === currentBudgetId);
  const categoryGroups = allCategoryGroups.filter(g => g.budgetId === currentBudgetId);

  const [dateRange, setDateRange] = React.useState<'3' | '6' | '12'>('6');
  const netWorth = getNetWorth();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-TT', { style: 'currency', currency: 'TTD' }).format(amount);
  };

  // Get months for the selected date range
  const monthsData = React.useMemo(() => {
    const months = [];
    const monthCount = parseInt(dateRange);
    for (let i = monthCount - 1; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      months.push({
        date,
        monthKey: format(date, 'yyyy-MM'),
        label: format(date, 'MMM yy')
      });
    }
    return months;
  }, [dateRange]);

  // Calculate spending trends over time
  const spendingTrends = React.useMemo(() => {
    return monthsData.map(month => {
      const monthStart = startOfMonth(month.date);
      const monthEnd = endOfMonth(month.date);

      const monthTransactions = transactions.filter(t => {
        const txDate = parseISO(t.date);
        return txDate >= monthStart && txDate <= monthEnd;
      });

      const income = monthTransactions
        .filter(t => t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0);

      const expenses = Math.abs(monthTransactions
        .filter(t => t.amount < 0)
        .reduce((sum, t) => sum + t.amount, 0));

      return {
        month: month.label,
        income,
        expenses,
        net: income - expenses
      };
    });
  }, [monthsData, transactions]);

  // Calculate current period metrics
  const currentPeriodMetrics = React.useMemo(() => {
    const currentMonth = monthsData[monthsData.length - 1];
    const monthStart = startOfMonth(currentMonth.date);
    const monthEnd = endOfMonth(currentMonth.date);

    const monthTransactions = transactions.filter(t => {
      const txDate = parseISO(t.date);
      return txDate >= monthStart && txDate <= monthEnd;
    });

    const income = monthTransactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);

    const expenses = Math.abs(monthTransactions
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + t.amount, 0));

    const netSavings = income - expenses;
    const savingsRate = income > 0 ? (netSavings / income) * 100 : 0;

    return { income, expenses, netSavings, savingsRate };
  }, [monthsData, transactions]);

  // Calculate spending by category for current period
  const spendingByCategory = React.useMemo(() => {
    const currentMonth = monthsData[monthsData.length - 1];
    const monthStart = startOfMonth(currentMonth.date);
    const monthEnd = endOfMonth(currentMonth.date);

    const categoryTotals: { [key: string]: { name: string; amount: number; color: string } } = {};
    const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1', '#14b8a6', '#f43f5e'];
    let colorIndex = 0;

    transactions
      .filter(t => {
        const txDate = parseISO(t.date);
        return t.amount < 0 && txDate >= monthStart && txDate <= monthEnd;
      })
      .forEach(t => {
        if (t.categoryId) {
          const category = categories.find(c => c.id === t.categoryId);
          if (category) {
            if (!categoryTotals[t.categoryId]) {
              categoryTotals[t.categoryId] = {
                name: category.name,
                amount: 0,
                color: colors[colorIndex++ % colors.length]
              };
            }
            categoryTotals[t.categoryId].amount += Math.abs(t.amount);
          }
        } else {
          if (!categoryTotals['uncategorized']) {
            categoryTotals['uncategorized'] = {
              name: 'Uncategorized',
              amount: 0,
              color: colors[colorIndex++ % colors.length]
            };
          }
          categoryTotals['uncategorized'].amount += Math.abs(t.amount);
        }
      });

    return Object.values(categoryTotals)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);
  }, [monthsData, transactions, categories]);

  // Calculate category group spending vs budget
  const categoryGroupBudgetVsActual = React.useMemo(() => {
    const currentMonth = monthsData[monthsData.length - 1];
    const monthStart = startOfMonth(currentMonth.date);
    const monthEnd = endOfMonth(currentMonth.date);
    const monthKey = currentMonth.monthKey;

    return categoryGroups.map(group => {
      const groupCategories = categories.filter(c => c.groupId === group.id);

      // Calculate total budget (goals) for this group
      const totalGoal = groupCategories.reduce((sum, cat) => sum + (cat.goal || 0), 0);

      // Calculate total spending for this group
      const totalSpent = transactions
        .filter(t => {
          const txDate = parseISO(t.date);
          return t.amount < 0 &&
                 txDate >= monthStart &&
                 txDate <= monthEnd &&
                 groupCategories.some(c => c.id === t.categoryId);
        })
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

      const percentage = totalGoal > 0 ? (totalSpent / totalGoal) * 100 : 0;

      return {
        name: group.name,
        budget: totalGoal,
        actual: totalSpent,
        percentage: Math.min(percentage, 100)
      };
    }).filter(g => g.budget > 0);
  }, [monthsData, categoryGroups, categories, transactions]);

  // Calculate month-over-month comparison
  const monthComparison = React.useMemo(() => {
    return monthsData.slice(-6).map(month => {
      const monthStart = startOfMonth(month.date);
      const monthEnd = endOfMonth(month.date);

      const monthTransactions = transactions.filter(t => {
        const txDate = parseISO(t.date);
        return txDate >= monthStart && txDate <= monthEnd;
      });

      const income = monthTransactions
        .filter(t => t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0);

      const expenses = Math.abs(monthTransactions
        .filter(t => t.amount < 0)
        .reduce((sum, t) => sum + t.amount, 0));

      return {
        month: month.label,
        income,
        expenses,
        savings: income - expenses
      };
    });
  }, [monthsData, transactions]);

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Reports & Analytics</h1>
        <Select value={dateRange} onValueChange={(val: '3' | '6' | '12') => setDateRange(val)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3">Last 3 months</SelectItem>
            <SelectItem value="6">Last 6 months</SelectItem>
            <SelectItem value="12">Last 12 months</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Income</CardTitle>
            <TrendingUpIcon className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(currentPeriodMetrics.income)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <CreditCard className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(currentPeriodMetrics.expenses)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Savings</CardTitle>
            <PiggyBank className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold",
              currentPeriodMetrics.netSavings >= 0 ? "text-green-600" : "text-red-600"
            )}>
              {formatCurrency(currentPeriodMetrics.netSavings)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Savings Rate</CardTitle>
            {currentPeriodMetrics.savingsRate >= 0 ?
              <TrendingUp className="h-4 w-4 text-green-600" /> :
              <TrendingDown className="h-4 w-4 text-red-600" />
            }
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold",
              currentPeriodMetrics.savingsRate >= 0 ? "text-green-600" : "text-red-600"
            )}>
              {currentPeriodMetrics.savingsRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">Of income saved</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Worth</CardTitle>
            <DollarSign className="h-4 w-4 text-slate-600" />
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold",
              netWorth >= 0 ? "text-green-600" : "text-red-600"
            )}>
              {formatCurrency(netWorth)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Current total</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Spending Trends Over Time */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Income vs Expenses Trend</CardTitle>
            <CardDescription>Track your cash flow over time</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={spendingTrends}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value))}
                  contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #e2e8f0' }}
                />
                <Legend />
                <Line type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} name="Income" />
                <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} name="Expenses" />
                <Line type="monotone" dataKey="net" stroke="#3b82f6" strokeWidth={2} name="Net" strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category Spending Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Top Spending Categories</CardTitle>
            <CardDescription>This month's breakdown</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px]">
            {spendingByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={spendingByCategory}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${formatCurrency(entry.amount)}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="amount"
                  >
                    {spendingByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No spending data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Budget vs Actual by Category Group */}
        <Card>
          <CardHeader>
            <CardTitle>Budget vs Actual</CardTitle>
            <CardDescription>Category group performance this month</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px]">
            {categoryGroupBudgetVsActual.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryGroupBudgetVsActual} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" width={100} />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value))}
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #e2e8f0' }}
                  />
                  <Legend />
                  <Bar dataKey="budget" fill="#94a3b8" name="Budget" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="actual" fill="#3b82f6" name="Actual" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No budget data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Month-over-Month Comparison Table */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Month-over-Month Comparison</CardTitle>
            <CardDescription>Last 6 months financial summary</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Month</th>
                    <th className="text-right py-3 px-4 font-medium">Income</th>
                    <th className="text-right py-3 px-4 font-medium">Expenses</th>
                    <th className="text-right py-3 px-4 font-medium">Net Savings</th>
                    <th className="text-right py-3 px-4 font-medium">Savings Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {monthComparison.map((month, idx) => {
                    const savingsRate = month.income > 0 ? (month.savings / month.income) * 100 : 0;
                    return (
                      <tr key={idx} className="border-b hover:bg-slate-50">
                        <td className="py-3 px-4 font-medium">{month.month}</td>
                        <td className="text-right py-3 px-4 text-green-600">{formatCurrency(month.income)}</td>
                        <td className="text-right py-3 px-4 text-red-600">{formatCurrency(month.expenses)}</td>
                        <td className={cn(
                          "text-right py-3 px-4 font-medium",
                          month.savings >= 0 ? "text-green-600" : "text-red-600"
                        )}>
                          {formatCurrency(month.savings)}
                        </td>
                        <td className={cn(
                          "text-right py-3 px-4",
                          savingsRate >= 0 ? "text-green-600" : "text-red-600"
                        )}>
                          {savingsRate.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Helper for cn (was missing import in previous file read, added it now)
function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}
