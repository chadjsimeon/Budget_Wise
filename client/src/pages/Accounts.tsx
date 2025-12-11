import React, { useState } from 'react';
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
  MoreHorizontal
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
import { cn } from '@/lib/utils';

export default function AccountsPage() {
  const [match, params] = useRoute('/accounts/:id');
  const accountId = params?.id;
  
  const { accounts, transactions, categories, addTransaction } = useStore();
  
  // If no account ID is selected, maybe redirect or show "All Accounts" (omitted for brevity, assume ID or show all)
  const currentAccount = accounts.find(a => a.id === accountId);
  const accountTransactions = accountId 
    ? transactions.filter(t => t.accountId === accountId)
    : transactions;

  // New Transaction State
  const [isTxOpen, setIsTxOpen] = useState(false);
  const [newTx, setNewTx] = useState({
    date: new Date(),
    payee: '',
    amount: '',
    categoryId: '',
    memo: '',
    type: 'expense' // 'expense' | 'income'
  });

  const handleAddTransaction = () => {
    if (!currentAccount) return;
    
    const amount = parseFloat(newTx.amount);
    const finalAmount = newTx.type === 'expense' ? -Math.abs(amount) : Math.abs(amount);

    addTransaction({
      accountId: currentAccount.id,
      date: format(newTx.date, 'yyyy-MM-dd'),
      payee: newTx.payee,
      amount: finalAmount,
      categoryId: newTx.categoryId || undefined,
      memo: newTx.memo,
      cleared: false
    });

    setIsTxOpen(false);
    setNewTx({ date: new Date(), payee: '', amount: '', categoryId: '', memo: '', type: 'expense' });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-TT', { style: 'currency', currency: 'TTD' }).format(amount);
  };

  if (accountId && !currentAccount) {
    return <div className="p-8">Account not found</div>;
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="border-b px-8 py-6 flex items-center justify-between bg-slate-50/50">
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
                <DialogTitle>Add Transaction</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Type</Label>
                  <div className="flex col-span-3 gap-2">
                    <Button 
                      type="button" 
                      variant={newTx.type === 'expense' ? 'default' : 'outline'}
                      className={cn(newTx.type === 'expense' ? "bg-red-600 hover:bg-red-700" : "")}
                      onClick={() => setNewTx({...newTx, type: 'expense'})}
                    >
                      Outflow
                    </Button>
                    <Button 
                      type="button" 
                      variant={newTx.type === 'income' ? 'default' : 'outline'}
                      className={cn(newTx.type === 'income' ? "bg-green-600 hover:bg-green-700" : "")}
                      onClick={() => setNewTx({...newTx, type: 'income'})}
                    >
                      Inflow
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

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="payee" className="text-right">Payee</Label>
                  <Input 
                    id="payee" 
                    value={newTx.payee} 
                    onChange={(e) => setNewTx({...newTx, payee: e.target.value})}
                    className="col-span-3" 
                  />
                </div>

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
              </div>
              <DialogFooter>
                <Button type="submit" onClick={handleAddTransaction}>Save Transaction</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Date</TableHead>
              <TableHead className="w-[300px]">Payee</TableHead>
              <TableHead className="w-[250px]">Category</TableHead>
              <TableHead>Memo</TableHead>
              <TableHead className="text-right w-[150px]">Outflow</TableHead>
              <TableHead className="text-right w-[150px]">Inflow</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accountTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-slate-500">
                  No transactions found. Start spending!
                </TableCell>
              </TableRow>
            ) : (
              accountTransactions.map(t => {
                const category = categories.find(c => c.id === t.categoryId);
                return (
                  <TableRow key={t.id} className="hover:bg-slate-50">
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
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
