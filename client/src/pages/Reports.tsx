import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useStore } from '@/lib/store';

export default function ReportsPage() {
  const { getNetWorth, transactions } = useStore();
  const netWorth = getNetWorth();

  // Simple aggregation for chart (mock logic for prototype)
  const data = [
    { name: 'Rent', amount: 5000 },
    { name: 'Groceries', amount: 3000 },
    { name: 'Utilities', amount: 850 },
    { name: 'Transport', amount: 450 },
    { name: 'Dining', amount: 1200 },
  ];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-TT', { style: 'currency', currency: 'TTD' }).format(amount);
  };

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-bold text-slate-900">Reports</h1>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Net Worth</CardTitle>
            <CardDescription>Total assets minus liabilities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold",
              netWorth >= 0 ? "text-green-600" : "text-red-600"
            )}>
              {formatCurrency(netWorth)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Includes Budget Accounts & Assets</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Income vs Expense</CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">TT$ 4,250.00</div>
            <p className="text-xs text-muted-foreground mt-1">Net Positive Flow</p>
          </CardContent>
        </Card>
      </div>

      <Card className="col-span-2">
        <CardHeader>
          <CardTitle>Spending by Category</CardTitle>
        </CardHeader>
        <CardContent className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip 
                formatter={(value) => [`TT$ ${value}`, 'Amount']}
                cursor={{ fill: 'transparent' }}
              />
              <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper for cn (was missing import in previous file read, added it now)
function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}
