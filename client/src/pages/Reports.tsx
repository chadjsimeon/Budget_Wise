import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, Legend
} from 'recharts';
import { useStore } from '@/lib/store';
import { format, subMonths, addMonths, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, DollarSign, CreditCard, PiggyBank, TrendingUpIcon } from 'lucide-react';
import { useCurrencyFormatter } from '@/lib/currency';

export default function ReportsPage() {
  const {
    currentBudgetId,
    getNetWorth,
    transactions: allTransactions,
    categories: allCategories,
    categoryGroups: allCategoryGroups
  } = useStore();

  // Filter by current budget
  const transactions = allTransactions.filter(t => t.budgetId === currentBudgetId);
  const categories = allCategories.filter(c => c.budgetId === currentBudgetId);
  const categoryGroups = allCategoryGroups.filter(g => g.budgetId === currentBudgetId);

  const [dateRange, setDateRange] = React.useState<'3' | '6' | '12'>('6');
  const [comparisonMode, setComparisonMode] = React.useState<'none' | 'previous' | 'yoy'>('none');
  const netWorth = getNetWorth();
  const formatCurrency = useCurrencyFormatter();

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

  // Calculate comparison period metrics
  const comparisonMetrics = React.useMemo(() => {
    if (comparisonMode === 'none' || monthsData.length === 0) return null;

    let comparisonMonthsData: typeof monthsData = [];
    const monthCount = parseInt(dateRange);

    if (comparisonMode === 'previous') {
      // Previous period: months (monthCount * 2 - 1) to monthCount back
      for (let i = (monthCount * 2) - 1; i >= monthCount; i--) {
        const date = subMonths(new Date(), i);
        comparisonMonthsData.push({
          date,
          monthKey: format(date, 'yyyy-MM'),
          label: format(date, 'MMM yy')
        });
      }
    } else if (comparisonMode === 'yoy') {
      // Year-over-year: same months from previous year
      comparisonMonthsData = monthsData.map(m => {
        const date = subMonths(m.date, 12);
        return {
          date,
          monthKey: format(date, 'yyyy-MM'),
          label: format(date, 'MMM yy')
        };
      });
    }

    const currentMonth = comparisonMonthsData[comparisonMonthsData.length - 1];
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
  }, [comparisonMode, dateRange, monthsData, transactions]);

  // Helper function to calculate percentage change
  const getPercentageChange = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / Math.abs(previous)) * 100;
  };

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

  // Calculate income breakdown for current period
  const incomeBreakdown = React.useMemo(() => {
    const currentMonth = monthsData[monthsData.length - 1];
    const monthStart = startOfMonth(currentMonth.date);
    const monthEnd = endOfMonth(currentMonth.date);

    const incomeTotals: { [key: string]: { name: string; amount: number; color: string } } = {};
    const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#6366f1', '#14b8a6', '#f43f5e'];
    let colorIndex = 0;

    transactions
      .filter(t => {
        const txDate = parseISO(t.date);
        return t.amount > 0 && txDate >= monthStart && txDate <= monthEnd;
      })
      .forEach(t => {
        if (t.categoryId) {
          const category = categories.find(c => c.id === t.categoryId);
          if (category) {
            if (!incomeTotals[t.categoryId]) {
              incomeTotals[t.categoryId] = {
                name: category.name,
                amount: 0,
                color: colors[colorIndex++ % colors.length]
              };
            }
            incomeTotals[t.categoryId].amount += t.amount;
          }
        } else {
          if (!incomeTotals['uncategorized']) {
            incomeTotals['uncategorized'] = {
              name: 'Uncategorized Income',
              amount: 0,
              color: colors[colorIndex++ % colors.length]
            };
          }
          incomeTotals['uncategorized'].amount += t.amount;
        }
      });

    return Object.values(incomeTotals)
      .sort((a, b) => b.amount - a.amount);
  }, [monthsData, transactions, categories]);

  // Calculate spending by category over time (top 5 categories)
  const categorySpendingOverTime = React.useMemo(() => {
    // First, identify top 5 spending categories across entire period
    const categoryTotals: { [key: string]: number } = {};

    transactions
      .filter(t => t.amount < 0 && t.categoryId)
      .forEach(t => {
        categoryTotals[t.categoryId!] = (categoryTotals[t.categoryId!] || 0) + Math.abs(t.amount);
      });

    const topCategoryIds = Object.entries(categoryTotals)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([id]) => id);

    // Get category names
    const categoryNames: { [key: string]: string } = {};
    topCategoryIds.forEach(id => {
      const cat = categories.find(c => c.id === id);
      if (cat) categoryNames[id] = cat.name;
    });

    // Calculate spending per category per month
    return monthsData.map(month => {
      const monthStart = startOfMonth(month.date);
      const monthEnd = endOfMonth(month.date);

      const monthData: any = { month: month.label };

      topCategoryIds.forEach(categoryId => {
        const spent = transactions
          .filter(t => {
            const txDate = parseISO(t.date);
            return t.categoryId === categoryId &&
                   t.amount < 0 &&
                   txDate >= monthStart &&
                   txDate <= monthEnd;
          })
          .reduce((sum, t) => sum + Math.abs(t.amount), 0);

        monthData[categoryNames[categoryId]] = spent;
      });

      return monthData;
    });
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

  // Calculate category group spending trend over time
  const categoryGroupSpendingTrend = React.useMemo(() => {
    return monthsData.map(month => {
      const monthStart = startOfMonth(month.date);
      const monthEnd = endOfMonth(month.date);

      const monthData: any = { month: month.label };

      categoryGroups.forEach(group => {
        const groupCategories = categories.filter(c => c.groupId === group.id);
        const groupSpending = transactions
          .filter(t => {
            const txDate = parseISO(t.date);
            return t.amount < 0 &&
                   txDate >= monthStart &&
                   txDate <= monthEnd &&
                   groupCategories.some(c => c.id === t.categoryId);
          })
          .reduce((sum, t) => sum + Math.abs(t.amount), 0);

        monthData[group.name] = groupSpending;
      });

      return monthData;
    });
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

  // Calculate 3-month forecast using simple moving average
  const forecastData = React.useMemo(() => {
    if (spendingTrends.length < 3) return [];

    const windowSize = Math.min(3, spendingTrends.length);
    const recentTrends = spendingTrends.slice(-windowSize);

    // Calculate averages
    const avgIncome = recentTrends.reduce((sum, t) => sum + t.income, 0) / windowSize;
    const avgExpenses = recentTrends.reduce((sum, t) => sum + t.expenses, 0) / windowSize;

    // Generate forecast for next 3 months
    const forecast = [];
    for (let i = 1; i <= 3; i++) {
      const futureDate = addMonths(new Date(), i);
      forecast.push({
        month: format(futureDate, 'MMM yy'),
        income: null,
        expenses: null,
        net: null,
        incomeForecast: avgIncome,
        expensesForecast: avgExpenses,
        netForecast: avgIncome - avgExpenses
      });
    }

    // Combine historical data with forecast
    return [
      ...spendingTrends.map(t => ({
        ...t,
        incomeForecast: null,
        expensesForecast: null,
        netForecast: null
      })),
      ...forecast
    ];
  }, [spendingTrends]);

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Reports & Analytics</h1>
        <div className="flex gap-3">
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
          <Select value={comparisonMode} onValueChange={(val: 'none' | 'previous' | 'yoy') => setComparisonMode(val)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Comparison</SelectItem>
              <SelectItem value="previous">vs Previous Period</SelectItem>
              <SelectItem value="yoy">vs Year Ago</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-muted-foreground">This month</p>
              {comparisonMetrics && (() => {
                const change = getPercentageChange(currentPeriodMetrics.income, comparisonMetrics.income);
                const isPositive = change > 0;
                return (
                  <span className={cn("text-xs font-medium flex items-center gap-0.5",
                    isPositive ? "text-green-600" : change < 0 ? "text-red-600" : "text-gray-500")}>
                    {isPositive ? <TrendingUp className="h-3 w-3" /> : change < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                    {change > 0 ? '+' : ''}{change.toFixed(1)}%
                  </span>
                );
              })()}
            </div>
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
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-muted-foreground">This month</p>
              {comparisonMetrics && (() => {
                const change = getPercentageChange(currentPeriodMetrics.expenses, comparisonMetrics.expenses);
                const isPositive = change < 0; // Lower expenses is good
                return (
                  <span className={cn("text-xs font-medium flex items-center gap-0.5",
                    isPositive ? "text-green-600" : change > 0 ? "text-red-600" : "text-gray-500")}>
                    {change < 0 ? <TrendingDown className="h-3 w-3" /> : change > 0 ? <TrendingUp className="h-3 w-3" /> : null}
                    {change > 0 ? '+' : ''}{change.toFixed(1)}%
                  </span>
                );
              })()}
            </div>
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
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-muted-foreground">This month</p>
              {comparisonMetrics && (() => {
                const change = getPercentageChange(currentPeriodMetrics.netSavings, comparisonMetrics.netSavings);
                const isPositive = change > 0;
                return (
                  <span className={cn("text-xs font-medium flex items-center gap-0.5",
                    isPositive ? "text-green-600" : change < 0 ? "text-red-600" : "text-gray-500")}>
                    {isPositive ? <TrendingUp className="h-3 w-3" /> : change < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                    {change > 0 ? '+' : ''}{change.toFixed(1)}%
                  </span>
                );
              })()}
            </div>
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
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-muted-foreground">Of income saved</p>
              {comparisonMetrics && (() => {
                const change = currentPeriodMetrics.savingsRate - comparisonMetrics.savingsRate;
                const isPositive = change > 0;
                return (
                  <span className={cn("text-xs font-medium flex items-center gap-0.5",
                    isPositive ? "text-green-600" : change < 0 ? "text-red-600" : "text-gray-500")}>
                    {isPositive ? <TrendingUp className="h-3 w-3" /> : change < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                    {change > 0 ? '+' : ''}{change.toFixed(1)}pp
                  </span>
                );
              })()}
            </div>
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

        {/* 3-Month Forecast */}
        {forecastData.length > 0 && (
          <Card className="col-span-2">
            <CardHeader>
              <CardTitle>3-Month Spending Forecast</CardTitle>
              <CardDescription>Based on {Math.min(3, spendingTrends.length)}-month moving average</CardDescription>
            </CardHeader>
            <CardContent className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={forecastData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value) => value ? formatCurrency(Number(value)) : 'N/A'}
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #e2e8f0' }}
                  />
                  <Legend />
                  {/* Historical lines */}
                  <Line type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} name="Income" connectNulls />
                  <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} name="Expenses" connectNulls />
                  <Line type="monotone" dataKey="net" stroke="#3b82f6" strokeWidth={2} name="Net" strokeDasharray="5 5" connectNulls />
                  {/* Forecast lines */}
                  <Line type="monotone" dataKey="incomeForecast" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" strokeOpacity={0.6} name="Income (Forecast)" connectNulls />
                  <Line type="monotone" dataKey="expensesForecast" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" strokeOpacity={0.6} name="Expenses (Forecast)" connectNulls />
                  <Line type="monotone" dataKey="netForecast" stroke="#3b82f6" strokeWidth={2} strokeDasharray="3 3" strokeOpacity={0.5} name="Net (Forecast)" connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Spending by Category Over Time */}
        {categorySpendingOverTime.length > 0 && Object.keys(categorySpendingOverTime[0]).length > 1 && (
          <Card className="col-span-2">
            <CardHeader>
              <CardTitle>Spending by Category Over Time</CardTitle>
              <CardDescription>Top 5 spending categories tracked month-over-month</CardDescription>
            </CardHeader>
            <CardContent className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={categorySpendingOverTime}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value))}
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #e2e8f0' }}
                  />
                  <Legend />
                  {Object.keys(categorySpendingOverTime[0])
                    .filter(key => key !== 'month')
                    .map((categoryName, idx) => {
                      const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];
                      return (
                        <Line
                          key={categoryName}
                          type="monotone"
                          dataKey={categoryName}
                          stroke={colors[idx % colors.length]}
                          strokeWidth={2}
                          name={categoryName}
                        />
                      );
                    })}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

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

        {/* Income Breakdown Donut Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Income Sources</CardTitle>
            <CardDescription>This month's breakdown</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px]">
            {incomeBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={incomeBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${formatCurrency(entry.amount)}`}
                    fill="#8884d8"
                    dataKey="amount"
                  >
                    {incomeBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No income data available
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

        {/* Category Group Spending Trend */}
        {categoryGroupSpendingTrend.length > 0 && Object.keys(categoryGroupSpendingTrend[0]).length > 1 && (
          <Card className="col-span-2">
            <CardHeader>
              <CardTitle>Category Group Spending Trend</CardTitle>
              <CardDescription>Spending distribution across category groups over time</CardDescription>
            </CardHeader>
            <CardContent className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryGroupSpendingTrend}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value))}
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #e2e8f0' }}
                  />
                  <Legend />
                  {Object.keys(categoryGroupSpendingTrend[0])
                    .filter(key => key !== 'month')
                    .map((groupName, idx) => {
                      const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1', '#14b8a6', '#f43f5e'];
                      return (
                        <Bar
                          key={groupName}
                          dataKey={groupName}
                          stackId="a"
                          fill={colors[idx % colors.length]}
                          name={groupName}
                        />
                      );
                    })}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// Helper for cn (was missing import in previous file read, added it now)
function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}
