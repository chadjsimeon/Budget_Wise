import { useState, useEffect } from 'react';
import { useStore, AccountType, Account } from '@/lib/store';
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

  // Determine if we're in edit mode
  const isEditMode = !!account;

  const [formData, setFormData] = useState({
    name: '',
    type: defaultType || 'checking',
    balance: ''
  });

  // Initialize form when editing
  useEffect(() => {
    if (account) {
      setFormData({
        name: account.name,
        type: account.type,
        balance: account.balance.toString()
      });
    } else if (!open) {
      setFormData({
        name: '',
        type: defaultType || 'checking',
        balance: ''
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
      // Update existing account - only name can change
      updateAccount(account.id, { name: formData.name });
      onSuccess?.();
    } else {
      // Create new account
      const newAccount = {
        name: formData.name,
        type: formData.type as AccountType,
        balance: parseFloat(formData.balance) || 0
      };
      addAccount(newAccount);
    }

    setOpen(false);
    if (!isEditMode) {
      setFormData({ name: '', type: defaultType || 'checking', balance: '' });
    }
  };

  const dialogContent = (
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>{isEditMode ? 'Edit Account' : 'Add New Account'}</DialogTitle>
        <DialogDescription>
          {isEditMode
            ? 'Update the account name. Account type cannot be changed.'
            : 'Track a new bank account, credit card, or loan.'}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="grid gap-4 py-4">
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="name" className="text-right">
            Nickname
          </Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="col-span-3"
            placeholder="e.g. Chase Sapphire"
            required
          />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="type" className="text-right">
            Type
          </Label>
          <Select
            value={formData.type}
            onValueChange={(val) => setFormData({ ...formData, type: val as AccountType })}
            disabled={isEditMode}
          >
            <SelectTrigger className="col-span-3">
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
        {!isEditMode && (
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="balance" className="text-right">
              Balance
            </Label>
            <Input
              id="balance"
              type="number"
              step="0.01"
              value={formData.balance}
              onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
              className="col-span-3"
              placeholder="0.00"
              required
            />
          </div>
        )}
        <DialogFooter>
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
