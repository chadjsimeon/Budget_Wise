import { Link, useLocation } from 'wouter';
import { useStore, Account } from '@/lib/store';
import { cn } from '@/lib/utils';
import {
  Wallet,
  CreditCard,
  Landmark,
  PieChart,
  LayoutDashboard,
  ArrowRightLeft,
  Settings,
  PlusCircle,
  Briefcase,
  ChevronDown,
  Building2,
  TrendingUp,
  Trash2,
  Pencil
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CreateAccountDialog } from '@/components/modals/CreateAccountDialog';
import { CreateBudgetDialog } from '@/components/modals/CreateBudgetDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from 'react';

export function Sidebar() {
  const [location] = useLocation();
  const {
    budgets,
    currentBudgetId,
    accounts,
    trackingAccounts,
    switchBudget,
    addBudget,
    deleteBudget
  } = useStore();

  const [budgetToDelete, setBudgetToDelete] = useState<string | null>(null);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [isEditAccountOpen, setIsEditAccountOpen] = useState(false);

  const currentBudget = budgets.find(b => b.id === currentBudgetId);

  // Filter accounts by current budget
  const budgetAccounts = accounts.filter(a =>
    a.budgetId === currentBudgetId &&
    ['checking', 'savings'].includes(a.type) &&
    a.isActive
  );
  const loansAndCredit = accounts.filter(a =>
    a.budgetId === currentBudgetId &&
    ['credit', 'loan'].includes(a.type) &&
    a.isActive
  );
  const closedAccounts = accounts.filter(a =>
    a.budgetId === currentBudgetId &&
    !a.isActive &&
    a.type === 'loan'
  );

  // Tracking accounts (not budget-specific)
  const assetTracking = trackingAccounts.filter(a => a.type === 'asset');
  const liabilityTracking = trackingAccounts.filter(a => a.type === 'liability');
  const hasTrackingAccounts = trackingAccounts.length > 0;

  const [isCreateBudgetOpen, setIsCreateBudgetOpen] = useState(false);

  const handleDeleteBudget = (budgetId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent menu item click from triggering
    setBudgetToDelete(budgetId);
  };

  const confirmDeleteBudget = () => {
    if (budgetToDelete) {
      deleteBudget(budgetToDelete);
      setBudgetToDelete(null);
    }
  };

  const handleEditAccount = (account: Account, e: React.MouseEvent) => {
    e.preventDefault();  // Prevent navigation
    e.stopPropagation();  // Prevent event bubbling
    setEditingAccount(account);
    setIsEditAccountOpen(true);
  };

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
        <div className="flex items-center gap-3 font-bold text-xl text-white">
          <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-lg p-1">
            <img
              src="/tt-coat-of-arms.png"
              alt="Trinidad and Tobago Coat of Arms"
              className="w-full h-full object-contain"
            />
          </div>
          <span className="bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent">Budget Wise</span>
        </div>
      </div>

      {/* Budget Selector */}
      <div className="px-3 mb-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center justify-between px-3 py-2 rounded-md bg-sidebar-accent/30 hover:bg-sidebar-accent/50 transition-colors text-white">
              <span className="text-sm font-medium truncate">{currentBudget?.name || 'Select Budget'}</span>
              <ChevronDown className="w-4 h-4 ml-2 opacity-70" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64">
            {budgets.map((budget) => (
              <DropdownMenuItem
                key={budget.id}
                onClick={() => switchBudget(budget.id)}
                className={cn(
                  "cursor-pointer flex items-center justify-between",
                  budget.id === currentBudgetId && "bg-accent"
                )}
              >
                <div className="flex items-center gap-2 flex-1">
                  <span>{budget.name}</span>
                  {budget.id === currentBudgetId && <span className="text-xs text-muted-foreground">Active</span>}
                </div>
                {budgets.length > 1 && (
                  <button
                    onClick={(e) => handleDeleteBudget(budget.id, e)}
                    className="ml-2 p-1 hover:bg-destructive/10 rounded transition-colors"
                    title="Delete budget"
                  >
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </button>
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setIsCreateBudgetOpen(true)} className="cursor-pointer">
              <PlusCircle className="w-4 h-4 mr-2" />
              Create New Budget
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Create Budget Dialog */}
      <CreateBudgetDialog open={isCreateBudgetOpen} onOpenChange={setIsCreateBudgetOpen} />

      {/* Main Nav */}
      <div className="px-3 space-y-1 mb-4">
        <NavItem href="/" icon={LayoutDashboard} label="Budget" />
        <NavItem href="/reports" icon={PieChart} label="Reports" />
        <NavItem href="/transactions" icon={ArrowRightLeft} label="All Accounts" />
      </div>

      {/* Accounts List */}
      <div className="flex-1 overflow-y-auto px-3 py-6 space-y-6">
        {/* Budget Accounts */}
        <div>
          <div className="flex items-center justify-between px-3 mb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">Accounts</h3>
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
                  <div className="flex items-center gap-2 truncate flex-1">
                    <Wallet className="w-3 h-3 opacity-70" />
                    <span className="truncate">{account.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleEditAccount(account, e)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-sidebar-accent rounded"
                      title="Edit account name"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <span className={cn(
                      "text-xs font-medium",
                      account.balance < 0 ? "text-red-400" : "text-emerald-400"
                    )}>
                      {formatCurrency(account.balance)}
                    </span>
                  </div>
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
                  <div className="flex items-center gap-2 truncate flex-1">
                    {account.type === 'loan' ? <Landmark className="w-3 h-3 opacity-70" /> : <CreditCard className="w-3 h-3 opacity-70" />}
                    <span className="truncate">{account.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleEditAccount(account, e)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-sidebar-accent rounded"
                      title="Edit account name"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <span className={cn(
                      "text-xs font-medium",
                      account.balance < 0 ? "text-red-400" : "text-emerald-400"
                    )}>
                      {formatCurrency(account.balance)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Closed Accounts */}
        {closedAccounts.length > 0 && (
          <div>
            <div className="flex items-center justify-between px-3 mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">Closed Accounts</h3>
            </div>
            <div className="space-y-0.5">
              {closedAccounts.map(account => (
                <Link key={account.id} href={`/accounts/${account.id}`}>
                  <div className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors group cursor-pointer opacity-60",
                    location === `/accounts/${account.id}` ? "bg-sidebar-accent text-white" : "hover:bg-sidebar-accent/50 text-sidebar-foreground/80"
                  )}>
                    <div className="flex items-center gap-2 truncate flex-1">
                      <Landmark className="w-3 h-3 opacity-70" />
                      <span className="truncate">{account.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleEditAccount(account, e)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-sidebar-accent rounded"
                        title="Edit account name"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <span className={cn(
                        "text-xs font-medium",
                        account.balance < 0 ? "text-red-400" : "text-emerald-400"
                      )}>
                        {formatCurrency(account.balance)}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Tracking Accounts - Only show if user has any */}
        {hasTrackingAccounts && (
          <>
            <div className="border-t border-sidebar-border pt-6">
              <div className="px-3 mb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40">Tracking</h3>
              </div>
            </div>

            {/* Asset Tracking */}
            {assetTracking.length > 0 && (
              <div>
                <div className="flex items-center justify-between px-3 mb-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">Assets</h3>
                </div>
                <div className="space-y-0.5">
                  {assetTracking.map(account => (
                    <div key={account.id} className="flex items-center justify-between px-3 py-2 rounded-md text-sm text-sidebar-foreground/80">
                      <div className="flex items-center gap-2 truncate">
                        <TrendingUp className="w-3 h-3 opacity-70" />
                        <span className="truncate">{account.name}</span>
                      </div>
                      <span className="text-xs font-medium text-emerald-400">
                        {formatCurrency(account.balance)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Liability Tracking */}
            {liabilityTracking.length > 0 && (
              <div>
                <div className="flex items-center justify-between px-3 mb-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">Liabilities</h3>
                </div>
                <div className="space-y-0.5">
                  {liabilityTracking.map(account => (
                    <div key={account.id} className="flex items-center justify-between px-3 py-2 rounded-md text-sm text-sidebar-foreground/80">
                      <div className="flex items-center gap-2 truncate">
                        <Building2 className="w-3 h-3 opacity-70" />
                        <span className="truncate">{account.name}</span>
                      </div>
                      <span className="text-xs font-medium text-red-400">
                        {formatCurrency(account.balance)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* User / Settings Footer */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-sidebar-accent/50 transition-colors cursor-pointer text-sidebar-foreground/80 hover:text-white">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-600 to-red-700 flex items-center justify-center text-xs font-bold text-white shadow-md">
            BW
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">Budget Wise</p>
            <p className="text-xs opacity-70 truncate">{currentBudget?.name}</p>
          </div>
          <Settings className="w-4 h-4 opacity-70" />
        </div>
      </div>

      {/* Delete Budget Confirmation Dialog */}
      <AlertDialog open={!!budgetToDelete} onOpenChange={(open) => !open && setBudgetToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Budget</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{budgets.find(b => b.id === budgetToDelete)?.name}"?
              <br /><br />
              <strong className="text-destructive">This action cannot be undone.</strong> All accounts, categories, transactions, and budget data associated with this budget will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteBudget} className="bg-destructive hover:bg-destructive/90">
              Delete Budget
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Account Dialog */}
      <CreateAccountDialog
        account={editingAccount || undefined}
        open={isEditAccountOpen}
        onOpenChange={setIsEditAccountOpen}
        onSuccess={() => setEditingAccount(null)}
      />
    </div>
  );
}
