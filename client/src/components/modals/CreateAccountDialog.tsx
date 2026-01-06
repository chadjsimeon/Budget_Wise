import { useState, useEffect } from 'react';
import { useStore, AccountType, Account } from '@/lib/store';
import { format } from 'date-fns';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle } from 'lucide-react';

interface CreateAccountDialogProps {
  trigger?: React.ReactNode;
  defaultType?: AccountType;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  account?: Account;  // If provided, enter edit mode
  onSuccess?: () => void;  // Optional callback after successful edit
}

export function CreateAccountDialog({ trigger, defaultType, open: controlledOpen, onOpenChange, account, onSuccess }: CreateAccountDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (onOpenChange || (() => {})) : setInternalOpen;

  const addAccount = useStore(state => state.addAccount);
  const updateAccount = useStore(state => state.updateAccount);
  const addTransaction = useStore(state => state.addTransaction);

  // Determine if we're in edit mode
  const isEditMode = !!account;

  const [formData, setFormData] = useState({
    name: '',
    type: defaultType || 'checking',
    balance: '',
    interestRate: '',      // For loans
    monthlyPayment: ''     // For loans
  });

  // Initialize form when editing
  useEffect(() => {
    if (account) {
      setFormData({
        name: account.name,
        type: account.type,
        // For loans/credit, show as positive (amount owed) even though stored as negative
        balance: Math.abs(account.balance).toString(),
        interestRate: account.interestRate?.toString() || '',
        monthlyPayment: account.monthlyPayment?.toString() || ''
      });
    } else if (!open) {
      setFormData({
        name: '',
        type: defaultType || 'checking',
        balance: '',
        interestRate: '',
        monthlyPayment: ''
      });
    }
  }, [account, open, defaultType]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate name
    if (!formData.name.trim()) {
      alert('Account name is required');
      return;
    }

    if (isEditMode && account) {
      // Update existing account
      const balanceAmount = parseFloat(formData.balance) || 0;
      const updates: Partial<Account> = {
        name: formData.name
      };

      // For loans and credit cards, allow editing balance and loan-specific fields
      if (account.type === 'loan' || account.type === 'credit') {
        updates.balance = -Math.abs(balanceAmount); // Store as negative
        if (account.type === 'loan') {
          updates.interestRate = parseFloat(formData.interestRate) || 0;
          updates.monthlyPayment = parseFloat(formData.monthlyPayment) || 0;
        }
      }

      updateAccount(account.id, updates);
      onSuccess?.();
    } else {
      // Create new account
      const balanceAmount = parseFloat(formData.balance) || 0;
      const newAccount: Omit<Account, 'id' | 'budgetId'> = {
        name: formData.name,
        type: formData.type as AccountType,
        // Start with balance 0 - the opening balance transaction will set the correct balance
        balance: 0,
        isActive: true,
        ...(formData.type === 'loan' && {
          interestRate: parseFloat(formData.interestRate) || 0,
          monthlyPayment: parseFloat(formData.monthlyPayment) || 0,
          originalBalance: Math.abs(balanceAmount), // Store as positive for progress calculation
          loanStartDate: format(new Date(), 'yyyy-MM-dd')
        })
      };
      const createdAccount = addAccount(newAccount);

      // Create opening balance transaction if balance is not zero
      if (balanceAmount !== 0) {
        addTransaction({
          accountId: createdAccount.id,
          date: format(new Date(), 'yyyy-MM-dd'),
          payee: 'Opening Balance',
          amount: (formData.type === 'loan' || formData.type === 'credit')
            ? -Math.abs(balanceAmount)
            : balanceAmount,
          memo: `Initial balance for ${formData.name}`,
          cleared: true,
          isOpeningBalance: true
        });
      }
    }

    setOpen(false);
    if (!isEditMode) {
      setFormData({
        name: '',
        type: defaultType || 'checking',
        balance: '',
        interestRate: '',
        monthlyPayment: ''
      });
    }
  };

  const dialogContent = (
    <DialogContent className={((isEditMode && account?.type === 'loan') || (!isEditMode && formData.type === 'loan')) ? "sm:max-w-[550px]" : "sm:max-w-[425px]"}>
      <DialogHeader>
        <DialogTitle>{isEditMode ? 'Edit Account' : 'Add New Account'}</DialogTitle>
        <DialogDescription>
          {isEditMode
            ? account?.type === 'loan'
              ? 'Update loan details including balance, interest rate, and monthly payment.'
              : account?.type === 'credit'
              ? 'Update credit card details. Account type cannot be changed.'
              : 'Update the account name. Account type cannot be changed.'
            : 'Track a new bank account, credit card, or loan.'}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4 py-4">
        <div className="space-y-1">
          <Label htmlFor="name" className="text-sm font-medium">
            Account Nickname
          </Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Chase Sapphire"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="type" className="text-sm font-medium">
            Account Type
          </Label>
          <Select
            value={formData.type}
            onValueChange={(val) => setFormData({ ...formData, type: val as AccountType })}
            disabled={isEditMode}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="checking">Checking</SelectItem>
              <SelectItem value="savings">Savings</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="credit">Credit Card</SelectItem>
              <SelectItem value="loan">Loan / Liability</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {/* Show balance field for new accounts OR when editing loans/credit */}
        {(!isEditMode || (isEditMode && (account?.type === 'loan' || account?.type === 'credit'))) && (
          <div className="space-y-1">
            <Label htmlFor="balance" className="text-sm font-medium">
              {(formData.type === 'loan' || formData.type === 'credit') ? 'Amount Owed' : 'Current Balance'}
            </Label>
            <Input
              id="balance"
              type="number"
              step="0.01"
              value={formData.balance}
              onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
              placeholder="0.00"
              required
            />
          </div>
        )}

        {/* Show loan fields for new loans OR when editing existing loans */}
        {((isEditMode && account?.type === 'loan') || (!isEditMode && formData.type === 'loan')) && (
              <>
                <div className="border-t pt-4 mt-2">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Loan Details</h3>
                </div>

                {/* Show informational notice for new loans only */}
                {!isEditMode && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-900 leading-relaxed">
                      💡 A budget category will be automatically created in the "Debt Repayments" group to help you track this loan's payments.
                    </p>
                  </div>
                )}

                <div className="space-y-1">
                  <Label htmlFor="interestRate" className="text-sm font-medium">
                    Interest Rate (APR)
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="interestRate"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      placeholder="12.00"
                      value={formData.interestRate || ''}
                      onChange={(e) => setFormData({...formData, interestRate: e.target.value})}
                      required
                      className="flex-1"
                    />
                    <span className="text-sm text-slate-500 font-medium min-w-[40px]">%</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="monthlyPayment" className="text-sm font-medium">
                    Monthly Payment
                  </Label>
                  <Input
                    id="monthlyPayment"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="1867.89"
                    value={formData.monthlyPayment || ''}
                    onChange={(e) => setFormData({...formData, monthlyPayment: e.target.value})}
                    required
                  />
                </div>
              </>
        )}
        <DialogFooter className="flex justify-between items-center">
          {isEditMode && account ? (
            account.isActive ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  if (confirm(`Are you sure you want to close "${account.name}"? This will move it to the Closed Accounts section.`)) {
                    updateAccount(account.id, { isActive: false });
                    setOpen(false);
                  }
                }}
              >
                Close Account
              </Button>
            ) : (
              <Button
                type="button"
                variant="default"
                onClick={() => {
                  if (confirm(`Are you sure you want to reopen "${account.name}"?`)) {
                    updateAccount(account.id, { isActive: true });
                    setOpen(false);
                  }
                }}
              >
                Reopen Account
              </Button>
            )
          ) : (
            <div></div>
          )}
          <Button type="submit">{isEditMode ? 'Save Changes' : 'Create Account'}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );

  // In controlled mode (editing), don't use DialogTrigger
  if (isControlled) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        {dialogContent}
      </Dialog>
    );
  }

  // In uncontrolled mode (creating), use DialogTrigger
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <button className="text-sidebar-foreground/50 hover:text-white transition-colors">
            <PlusCircle className="w-3 h-3" />
          </button>
        )}
      </DialogTrigger>
      {dialogContent}
    </Dialog>
  );
}
