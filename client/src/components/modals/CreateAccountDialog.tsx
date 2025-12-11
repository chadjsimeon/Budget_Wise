import { useState } from 'react';
import { useStore, AccountType } from '@/lib/store';
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
}

export function CreateAccountDialog({ trigger, defaultType, open: controlledOpen, onOpenChange }: CreateAccountDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? onOpenChange! : setInternalOpen;

  const addAccount = useStore(state => state.addAccount);
  const addTransaction = useStore(state => state.addTransaction);

  const [formData, setFormData] = useState({
    name: '',
    type: defaultType || 'checking',
    balance: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Create the account
    const newAccount = {
      name: formData.name,
      type: formData.type as AccountType,
      balance: parseFloat(formData.balance) || 0
    };
    
    // We need to capture the ID of the new account, but the store action doesn't return it directly currently.
    // However, for a prototype, we can modify the store or just let the store handle the ID generation.
    // The store generates a random ID. 
    
    // Ideally, we want to create an "Initial Balance" transaction for this account so history is accurate.
    // But the current `addAccount` reducer just sets the balance property directly.
    // For this prototype, I'll update the `addAccount` to just add the account object. 
    // Wait, the prompt requirements say "Track multiple account types... Display running balances".
    // I will stick to the store's `addAccount` which sets the initial balance field.
    
    addAccount(newAccount);
    
    setOpen(false);
    setFormData({ name: '', type: defaultType || 'checking', balance: '' });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <button className="text-sidebar-foreground/50 hover:text-white transition-colors">
            <PlusCircle className="w-3 h-3" />
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Account</DialogTitle>
          <DialogDescription>
            Track a new bank account, credit card, or loan.
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
          <DialogFooter>
            <Button type="submit">Create Account</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
