import React, { useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { useStore } from '@/lib/store';
import { format, parse } from 'date-fns';
import {
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Filter,
  Plus,
  Wallet,
  Calendar as CalendarIcon,
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
  Check,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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

interface AccountsPageProps {
  triggerNewTransaction?: boolean;
  onTransactionTriggered?: () => void;
}

export default function AccountsPage({ triggerNewTransaction, onTransactionTriggered }: AccountsPageProps = {}) {
  const [match, params] = useRoute('/accounts/:id');
  const accountId = params?.id;

  const {
    currentBudgetId,
    accounts: allAccounts,
    transactions: allTransactions,
    categories: allCategories,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    deleteAccount
  } = useStore();

  // Filter by current budget
  const accounts = allAccounts.filter(a => a.budgetId === currentBudgetId);
  const transactions = allTransactions.filter(t => t.budgetId === currentBudgetId);
  const categories = allCategories.filter(c => c.budgetId === currentBudgetId);

  // Sorting State - MUST be declared before useMemo that uses it
  type SortField = 'date' | 'payee' | 'amount';
  type SortDirection = 'asc' | 'desc';
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // If no account ID is selected, maybe redirect or show "All Accounts" (omitted for brevity, assume ID or show all)
  const currentAccount = accounts.find(a => a.id === accountId);
  const baseTransactions = accountId
    ? transactions.filter(t => t.accountId === accountId)
    : transactions;

  // Sort transactions
  const accountTransactions = React.useMemo(() => {
    const sorted = [...baseTransactions];
    sorted.sort((a, b) => {
      let compareResult = 0;

      switch (sortField) {
        case 'date':
          compareResult = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'payee':
          compareResult = a.payee.localeCompare(b.payee);
          break;
        case 'amount':
          compareResult = Math.abs(a.amount) - Math.abs(b.amount);
          break;
      }

      return sortDirection === 'asc' ? compareResult : -compareResult;
    });

    return sorted;
  }, [baseTransactions, sortField, sortDirection]);

  // New Transaction State
  const [isTxOpen, setIsTxOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<string | null>(null);
  const [deletingTxId, setDeletingTxId] = useState<string | null>(null);
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);
  const [newTx, setNewTx] = useState({
    date: new Date(),
    payee: '',
    amount: '',
    categoryId: '',
    memo: '',
    type: 'expense', // 'expense' | 'income' | 'transfer'
    accountId: accountId || '', // Selected account for the transaction
    toAccountId: '' // For transfers only
  });

  // Bulk Selection State
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkEditData, setBulkEditData] = useState({
    categoryId: '',
    cleared: false
  });

  const handleAddTransaction = () => {
    const amount = parseFloat(newTx.amount);

    if (newTx.type === 'transfer') {
      // Handle transfer between accounts
      if (!newTx.accountId || !newTx.toAccountId) {
        alert('Please select both From and To accounts for transfer');
        return;
      }

      const dateStr = format(newTx.date, 'yyyy-MM-dd');
      const transferMemo = newTx.memo || `Transfer to ${accounts.find(a => a.id === newTx.toAccountId)?.name}`;

      // Create outflow transaction in source account
      addTransaction({
        accountId: newTx.accountId,
        date: dateStr,
        payee: `Transfer to ${accounts.find(a => a.id === newTx.toAccountId)?.name}`,
        amount: -Math.abs(amount),
        memo: transferMemo,
        cleared: false
      });

      // Create inflow transaction in destination account
      addTransaction({
        accountId: newTx.toAccountId,
        date: dateStr,
        payee: `Transfer from ${accounts.find(a => a.id === newTx.accountId)?.name}`,
        amount: Math.abs(amount),
        memo: transferMemo,
        cleared: false
      });
    } else {
      // Handle regular income/expense transaction
      const targetAccountId = newTx.accountId || currentAccount?.id;
      if (!targetAccountId) {
        alert('Please select an account');
        return;
      }

      const finalAmount = newTx.type === 'expense' ? -Math.abs(amount) : Math.abs(amount);

      if (editingTx) {
        // Update existing transaction
        updateTransaction(editingTx, {
          date: format(newTx.date, 'yyyy-MM-dd'),
          payee: newTx.payee,
          amount: finalAmount,
          categoryId: newTx.categoryId || undefined,
          memo: newTx.memo,
        });
      } else {
        // Add new transaction
        addTransaction({
          accountId: targetAccountId,
          date: format(newTx.date, 'yyyy-MM-dd'),
          payee: newTx.payee,
          amount: finalAmount,
          categoryId: newTx.categoryId || undefined,
          memo: newTx.memo,
          cleared: false
        });
      }
    }

    setIsTxOpen(false);
    setEditingTx(null);
    setNewTx({
      date: new Date(),
      payee: '',
      amount: '',
      categoryId: '',
      memo: '',
      type: 'expense',
      accountId: accountId || '',
      toAccountId: ''
    });
  };

  const handleEditTransaction = (transaction: any) => {
    setEditingTx(transaction.id);
    setNewTx({
      date: parse(transaction.date, 'yyyy-MM-dd', new Date()),
      payee: transaction.payee,
      amount: Math.abs(transaction.amount).toString(),
      categoryId: transaction.categoryId || '',
      memo: transaction.memo || '',
      type: transaction.amount < 0 ? 'expense' : 'income',
      accountId: transaction.accountId,
      toAccountId: ''
    });
    setIsTxOpen(true);
  };

  const handleDeleteTransaction = (transactionId: string) => {
    setDeletingTxId(transactionId);
  };

  const confirmDeleteTransaction = () => {
    if (deletingTxId) {
      deleteTransaction(deletingTxId);
      setDeletingTxId(null);
    }
  };

  const handleDeleteAccount = (accountId: string) => {
    setDeletingAccountId(accountId);
  };

  const confirmDeleteAccount = () => {
    if (deletingAccountId) {
      deleteAccount(deletingAccountId);
      setDeletingAccountId(null);
      // Redirect to all accounts view after deleting current account
      if (deletingAccountId === accountId) {
        window.location.href = '/transactions';
      }
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-TT', { style: 'currency', currency: 'TTD' }).format(amount);
  };

  // Bulk Selection Handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTxIds(new Set(accountTransactions.map(t => t.id)));
    } else {
      setSelectedTxIds(new Set());
    }
  };

  const handleSelectTransaction = (txId: string, checked: boolean) => {
    const newSelected = new Set(selectedTxIds);
    if (checked) {
      newSelected.add(txId);
    } else {
      newSelected.delete(txId);
    }
    setSelectedTxIds(newSelected);
  };

  const handleBulkDelete = () => {
    if (selectedTxIds.size === 0) return;
    if (confirm(`Delete ${selectedTxIds.size} selected transaction(s)?`)) {
      selectedTxIds.forEach(txId => {
        deleteTransaction(txId);
      });
      setSelectedTxIds(new Set());
    }
  };

  const handleBulkEdit = () => {
    if (selectedTxIds.size === 0) return;

    // Apply bulk edits to all selected transactions
    selectedTxIds.forEach(txId => {
      const updates: any = {};
      if (bulkEditData.categoryId) {
        updates.categoryId = bulkEditData.categoryId;
      }
      updates.cleared = bulkEditData.cleared;

      updateTransaction(txId, updates);
    });

    setSelectedTxIds(new Set());
    setIsBulkEditOpen(false);
    setBulkEditData({ categoryId: '', cleared: false });
  };

  const handleClearSelection = () => {
    setSelectedTxIds(new Set());
  };

  // Sorting Handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field with default desc direction
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4 ml-2 opacity-50" />;
    }
    return sortDirection === 'asc' ?
      <ArrowUp className="w-4 h-4 ml-2" /> :
      <ArrowDown className="w-4 h-4 ml-2" />;
  };

  // Handle keyboard shortcut trigger
  useEffect(() => {
    if (triggerNewTransaction && !isTxOpen) {
      setIsTxOpen(true);
      onTransactionTriggered?.();
    }
  }, [triggerNewTransaction, isTxOpen, onTransactionTriggered]);

  // Set default account when opening dialog
  useEffect(() => {
    if (isTxOpen && !editingTx && !newTx.accountId && accountId) {
      setNewTx(prev => ({ ...prev, accountId }));
    }
  }, [isTxOpen, editingTx, accountId]);

  if (accountId && !currentAccount) {
    return <div className="p-8">Account not found</div>;
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="border-b px-8 py-6 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              {currentAccount ? (
                <>
                  <Wallet className="w-6 h-6 text-blue-600" />
                  {currentAccount.name}
                </>
              ) : "All Accounts"}
            </h1>
            <p className="text-slate-500 mt-1">
              {currentAccount
                ? `Current Balance: ${formatCurrency(currentAccount.balance)}`
                : "View all your transaction history"
              }
            </p>
          </div>
          {currentAccount && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  onClick={() => handleDeleteAccount(currentAccount.id)}
                  className="cursor-pointer text-red-600 focus:text-red-600"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Account
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9 w-64 bg-white" placeholder="Search transactions..." />
          </div>
          <Dialog open={isTxOpen} onOpenChange={setIsTxOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4" /> Add Transaction
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>{editingTx ? 'Edit Transaction' : 'Add Transaction'}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Type</Label>
                  <div className="flex col-span-3 gap-2">
                    <Button
                      type="button"
                      variant={newTx.type === 'expense' ? 'default' : 'outline'}
                      className={cn(newTx.type === 'expense' ? "bg-red-600 hover:bg-red-700" : "", "flex-1")}
                      onClick={() => setNewTx({...newTx, type: 'expense'})}
                    >
                      Outflow
                    </Button>
                    <Button
                      type="button"
                      variant={newTx.type === 'income' ? 'default' : 'outline'}
                      className={cn(newTx.type === 'income' ? "bg-green-600 hover:bg-green-700" : "", "flex-1")}
                      onClick={() => setNewTx({...newTx, type: 'income'})}
                    >
                      Inflow
                    </Button>
                    <Button
                      type="button"
                      variant={newTx.type === 'transfer' ? 'default' : 'outline'}
                      className={cn(newTx.type === 'transfer' ? "bg-blue-600 hover:bg-blue-700" : "", "flex-1")}
                      onClick={() => setNewTx({...newTx, type: 'transfer'})}
                    >
                      Transfer
                    </Button>
                  </div>
                </div>
                
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="date" className="text-right">Date</Label>
                  <div className="col-span-3">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !newTx.date && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {newTx.date ? format(newTx.date, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={newTx.date}
                          onSelect={(date) => date && setNewTx({...newTx, date})}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Account Selector - Show for all transaction types */}
                {newTx.type === 'transfer' ? (
                  <>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="fromAccount" className="text-right">From Account</Label>
                      <Select
                        value={newTx.accountId}
                        onValueChange={(val) => setNewTx({...newTx, accountId: val})}
                      >
                        <SelectTrigger className="col-span-3">
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.filter(a => a.isActive).map(acc => (
                            <SelectItem key={acc.id} value={acc.id}>
                              {acc.name} ({formatCurrency(acc.balance)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="toAccount" className="text-right">To Account</Label>
                      <Select
                        value={newTx.toAccountId}
                        onValueChange={(val) => setNewTx({...newTx, toAccountId: val})}
                      >
                        <SelectTrigger className="col-span-3">
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.filter(a => a.isActive && a.id !== newTx.accountId).map(acc => (
                            <SelectItem key={acc.id} value={acc.id}>
                              {acc.name} ({formatCurrency(acc.balance)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="account" className="text-right">Account</Label>
                    <Select
                      value={newTx.accountId}
                      onValueChange={(val) => setNewTx({...newTx, accountId: val})}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.filter(a => a.isActive).map(acc => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.name} ({formatCurrency(acc.balance)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Payee - Only for non-transfer transactions */}
                {newTx.type !== 'transfer' && (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="payee" className="text-right">Payee</Label>
                    <Input
                      id="payee"
                      value={newTx.payee}
                      onChange={(e) => setNewTx({...newTx, payee: e.target.value})}
                      className="col-span-3"
                    />
                  </div>
                )}

                {/* Category - Only for non-transfer transactions */}
                {newTx.type !== 'transfer' && (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="category" className="text-right">Category</Label>
                    <Select
                      value={newTx.categoryId}
                      onValueChange={(val) => setNewTx({...newTx, categoryId: val})}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="uncategorized">Inflow: Ready to Assign</SelectItem>
                        {categories.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="amount" className="text-right">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={newTx.amount}
                    onChange={(e) => setNewTx({...newTx, amount: e.target.value})}
                    className="col-span-3"
                  />
                </div>

                {/* Memo - Optional for all types */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="memo" className="text-right">Memo</Label>
                  <Input
                    id="memo"
                    value={newTx.memo}
                    onChange={(e) => setNewTx({...newTx, memo: e.target.value})}
                    className="col-span-3"
                    placeholder="Optional notes"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" onClick={handleAddTransaction}>Save Transaction</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Bulk Actions Toolbar */}
      {selectedTxIds.size > 0 && (
        <div className="border-b px-8 py-3 bg-blue-50 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-blue-900">
              {selectedTxIds.size} transaction{selectedTxIds.size > 1 ? 's' : ''} selected
            </span>
            <Button variant="ghost" size="sm" onClick={handleClearSelection} className="h-8 gap-1 text-blue-700 hover:text-blue-900">
              <X className="w-4 h-4" />
              Clear
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={isBulkEditOpen} onOpenChange={setIsBulkEditOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Pencil className="w-4 h-4" />
                  Edit Selected
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit {selectedTxIds.size} Transaction{selectedTxIds.size > 1 ? 's' : ''}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="bulk-category" className="text-right">Category</Label>
                    <Select
                      value={bulkEditData.categoryId}
                      onValueChange={(val) => setBulkEditData({ ...bulkEditData, categoryId: val })}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Leave unchanged" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Leave unchanged</SelectItem>
                        {categories.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="bulk-cleared" className="text-right">Cleared</Label>
                    <div className="col-span-3 flex items-center gap-2">
                      <Checkbox
                        id="bulk-cleared"
                        checked={bulkEditData.cleared}
                        onCheckedChange={(checked) => setBulkEditData({ ...bulkEditData, cleared: checked === true })}
                      />
                      <Label htmlFor="bulk-cleared" className="text-sm font-normal cursor-pointer">
                        Mark as cleared
                      </Label>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsBulkEditOpen(false)}>Cancel</Button>
                  <Button onClick={handleBulkEdit}>Apply Changes</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="destructive" size="sm" onClick={handleBulkDelete} className="gap-2">
              <Trash2 className="w-4 h-4" />
              Delete Selected
            </Button>
          </div>
        </div>
      )}

      {/* Transactions Table */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={accountTransactions.length > 0 && selectedTxIds.size === accountTransactions.length}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead className="w-[120px]">
                <button
                  onClick={() => handleSort('date')}
                  className="flex items-center hover:text-slate-900 font-medium"
                >
                  Date
                  <SortIcon field="date" />
                </button>
              </TableHead>
              <TableHead className="w-[300px]">
                <button
                  onClick={() => handleSort('payee')}
                  className="flex items-center hover:text-slate-900 font-medium"
                >
                  Payee
                  <SortIcon field="payee" />
                </button>
              </TableHead>
              <TableHead className="w-[250px]">Category</TableHead>
              <TableHead>Memo</TableHead>
              <TableHead className="text-right w-[150px]">
                <button
                  onClick={() => handleSort('amount')}
                  className="flex items-center ml-auto hover:text-slate-900 font-medium"
                >
                  Outflow
                  <SortIcon field="amount" />
                </button>
              </TableHead>
              <TableHead className="text-right w-[150px]">Inflow</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accountTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-slate-500">
                  No transactions found. Start spending!
                </TableCell>
              </TableRow>
            ) : (
              accountTransactions.map(t => {
                const category = categories.find(c => c.id === t.categoryId);
                const isSelected = selectedTxIds.has(t.id);
                return (
                  <TableRow key={t.id} className={cn("hover:bg-slate-50", isSelected && "bg-blue-50")}>
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => handleSelectTransaction(t.id, checked === true)}
                      />
                    </TableCell>
                    <TableCell className="font-medium text-slate-600">
                      {format(parse(t.date, 'yyyy-MM-dd', new Date()), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell className="font-semibold text-slate-700">{t.payee}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                        {category ? category.name : (t.amount > 0 ? "Inflow: Ready to Assign" : "Uncategorized")}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm truncate max-w-[200px]">{t.memo}</TableCell>
                    <TableCell className="text-right font-medium text-slate-900">
                      {t.amount < 0 && formatCurrency(Math.abs(t.amount))}
                    </TableCell>
                    <TableCell className="text-right font-medium text-green-600">
                      {t.amount > 0 && formatCurrency(t.amount)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditTransaction(t)} className="cursor-pointer">
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteTransaction(t.id)}
                            className="cursor-pointer text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete Transaction Confirmation Dialog */}
      <AlertDialog open={!!deletingTxId} onOpenChange={(open) => !open && setDeletingTxId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this transaction? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteTransaction} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Account Confirmation Dialog */}
      <AlertDialog open={!!deletingAccountId} onOpenChange={(open) => !open && setDeletingAccountId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this account? All associated transactions will also be deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteAccount} className="bg-red-600 hover:bg-red-700">
              Delete Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
