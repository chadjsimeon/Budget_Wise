import { Link, useLocation } from 'wouter';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { 
  Wallet, 
  CreditCard, 
  Landmark, 
  PieChart, 
  LayoutDashboard, 
  ArrowRightLeft,
  Settings,
  PlusCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CreateAccountDialog } from '@/components/modals/CreateAccountDialog';

export function Sidebar() {
  const [location] = useLocation();
  const accounts = useStore(state => state.accounts);

  const budgetAccounts = accounts.filter(a => ['checking', 'savings'].includes(a.type));
  const loansAndCredit = accounts.filter(a => ['credit', 'loan'].includes(a.type));

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-TT', { style: 'currency', currency: 'TTD' }).format(amount);
  };

  const NavItem = ({ href, icon: Icon, label }: { href: string, icon: any, label: string }) => {
    const isActive = location === href;
    return (
      <Link href={href}>
        <div className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer",
          isActive 
            ? "bg-sidebar-accent text-white" 
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-white"
        )}>
          <Icon className="w-4 h-4" />
          <span>{label}</span>
        </div>
      </Link>
    );
  };

  return (
    <div className="w-64 bg-sidebar text-sidebar-foreground flex flex-col h-screen border-r border-sidebar-border">
      {/* Logo Area */}
      <div className="p-6">
        <div className="flex items-center gap-2 font-bold text-xl text-white">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <span className="text-white text-lg">Z</span>
          </div>
          ZeroBased
        </div>
      </div>

      {/* Main Nav */}
      <div className="px-3 space-y-1">
        <NavItem href="/" icon={LayoutDashboard} label="Budget" />
        <NavItem href="/reports" icon={PieChart} label="Reports" />
        <NavItem href="/transactions" icon={ArrowRightLeft} label="All Accounts" />
      </div>

      {/* Accounts List */}
      <div className="flex-1 overflow-y-auto px-3 py-6 space-y-6">
        {/* Budget Accounts */}
        <div>
          <div className="flex items-center justify-between px-3 mb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">Budget</h3>
            <CreateAccountDialog 
              defaultType="checking"
              trigger={
                <button className="text-sidebar-foreground/50 hover:text-white transition-colors">
                  <PlusCircle className="w-3 h-3" />
                </button>
              }
            />
          </div>
          <div className="space-y-0.5">
            {budgetAccounts.map(account => (
              <Link key={account.id} href={`/accounts/${account.id}`}>
                <div className={cn(
                  "flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors group cursor-pointer",
                  location === `/accounts/${account.id}` ? "bg-sidebar-accent text-white" : "hover:bg-sidebar-accent/50 text-sidebar-foreground/80"
                )}>
                  <div className="flex items-center gap-2 truncate">
                    <Wallet className="w-3 h-3 opacity-70" />
                    <span className="truncate">{account.name}</span>
                  </div>
                  <span className={cn(
                    "text-xs font-medium",
                    account.balance < 0 ? "text-red-400" : "text-emerald-400"
                  )}>
                    {formatCurrency(account.balance)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Loans & Credit */}
        <div>
          <div className="flex items-center justify-between px-3 mb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">Loans & Credit</h3>
            <CreateAccountDialog 
              defaultType="credit"
              trigger={
                <button className="text-sidebar-foreground/50 hover:text-white transition-colors">
                  <PlusCircle className="w-3 h-3" />
                </button>
              }
            />
          </div>
          <div className="space-y-0.5">
            {loansAndCredit.map(account => (
              <Link key={account.id} href={`/accounts/${account.id}`}>
                <div className={cn(
                  "flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors group cursor-pointer",
                  location === `/accounts/${account.id}` ? "bg-sidebar-accent text-white" : "hover:bg-sidebar-accent/50 text-sidebar-foreground/80"
                )}>
                  <div className="flex items-center gap-2 truncate">
                    {account.type === 'loan' ? <Landmark className="w-3 h-3 opacity-70" /> : <CreditCard className="w-3 h-3 opacity-70" />}
                    <span className="truncate">{account.name}</span>
                  </div>
                  <span className={cn(
                    "text-xs font-medium",
                    account.balance < 0 ? "text-red-400" : "text-emerald-400"
                  )}>
                    {formatCurrency(account.balance)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* User / Settings Footer */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-sidebar-accent/50 transition-colors cursor-pointer text-sidebar-foreground/80 hover:text-white">
          <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold text-white">
            JD
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">John Doe</p>
            <p className="text-xs opacity-70 truncate">My Budget</p>
          </div>
          <Settings className="w-4 h-4 opacity-70" />
        </div>
      </div>
    </div>
  );
}
