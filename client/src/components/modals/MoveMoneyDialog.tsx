import { useState } from 'react';
import { useStore } from '@/lib/store';
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
import { ArrowRightLeft } from 'lucide-react';

interface MoveMoneyDialogProps {
  sourceCategoryId: string;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function MoveMoneyDialog({ sourceCategoryId, trigger, open: controlledOpen, onOpenChange }: MoveMoneyDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? onOpenChange! : setInternalOpen;

  const { categories, moveMoney, currentMonth, getCategoryAvailable } = useStore();
  const sourceCategory = categories.find(c => c.id === sourceCategoryId);
  const availableAmount = getCategoryAvailable(currentMonth, sourceCategoryId);

  const [amount, setAmount] = useState('');
  const [targetCategoryId, setTargetCategoryId] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCategoryId || !amount) return;

    moveMoney(sourceCategoryId, targetCategoryId, parseFloat(amount), currentMonth);
    setOpen(false);
    setAmount('');
    setTargetCategoryId('');
  };

  if (!sourceCategory) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <ArrowRightLeft className="w-3 h-3" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Move Money</DialogTitle>
          <DialogDescription>
            Move funds from <strong>{sourceCategory.name}</strong> to another category.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="amount" className="text-right">
              Amount
            </Label>
            <div className="col-span-3">
              <Input
                id="amount"
                type="number"
                step="0.01"
                max={availableAmount}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`Max: ${availableAmount.toFixed(2)}`}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="to" className="text-right">
              To
            </Label>
            <Select value={targetCategoryId} onValueChange={setTargetCategoryId} required>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories
                  .filter(c => c.id !== sourceCategoryId)
                  .map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit">Move Funds</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
