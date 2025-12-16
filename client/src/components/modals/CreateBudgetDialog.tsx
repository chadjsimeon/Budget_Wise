import { useState } from 'react';
import { useStore } from '@/lib/store';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CreateBudgetDialogProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

// Currency options
const CURRENCY_OPTIONS = [
  { value: 'TTD', label: 'Trinidad Dollar--TTD' },
  { value: 'USD', label: 'US Dollar--USD' },
  { value: 'EUR', label: 'Euro--EUR' },
  { value: 'GBP', label: 'British Pound--GBP' },
  { value: 'CAD', label: 'Canadian Dollar--CAD' },
  { value: 'AUD', label: 'Australian Dollar--AUD' },
  { value: 'JPY', label: 'Japanese Yen--JPY' },
];

// Currency placement options with examples
const CURRENCY_PLACEMENT_OPTIONS = [
  { value: 'before' as const, label: 'Before amount (TT$123,456.78)' },
  { value: 'after' as const, label: 'After amount (123,456.78 TT$)' },
];

// Number format options
const NUMBER_FORMAT_OPTIONS = [
  { value: '1,234.56' as const, label: '123,456.78' },
  { value: '1.234,56' as const, label: '123.456,78' },
  { value: '1 234.56' as const, label: '123 456.78' },
  { value: '1 234,56' as const, label: '123 456,78' },
];

// Date format options
const DATE_FORMAT_OPTIONS = [
  { value: 'DD/MM/YYYY' as const, label: '30/12/2025' },
  { value: 'MM/DD/YYYY' as const, label: '12/30/2025' },
  { value: 'YYYY-MM-DD' as const, label: '2025-12-30' },
];

export function CreateBudgetDialog({ trigger, open: controlledOpen, onOpenChange }: CreateBudgetDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? onOpenChange! : setInternalOpen;

  const { addBudget } = useStore();

  const [formData, setFormData] = useState({
    name: '',
    currency: 'TTD',
    currencyPlacement: 'before' as const,
    numberFormat: '1,234.56' as const,
    dateFormat: 'DD/MM/YYYY' as const,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('Please enter a plan name');
      return;
    }

    addBudget({
      name: formData.name,
      currency: formData.currency,
      currencyPlacement: formData.currencyPlacement,
      numberFormat: formData.numberFormat,
      dateFormat: formData.dateFormat,
    });

    // Reset form
    setFormData({
      name: '',
      currency: 'TTD',
      currencyPlacement: 'before',
      numberFormat: '1,234.56',
      dateFormat: 'DD/MM/YYYY',
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && (
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-2xl">New Plan</DialogTitle>
          {/* Optional: Add migration link */}
          {/* <button className="text-sm text-blue-600 hover:underline text-left mt-1">
            Migrate a YNAB 4 Plan &gt;
          </button> */}
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 py-4">
            {/* Plan Name */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right font-medium">
                Plan Name
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="col-span-3"
                placeholder="My Budget"
                required
              />
            </div>

            {/* Currency */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="currency" className="text-right font-medium">
                Currency
              </Label>
              <Select
                value={formData.currency}
                onValueChange={(val) => setFormData({ ...formData, currency: val })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Currency Placement */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="currencyPlacement" className="text-right font-medium">
                Currency Placement
              </Label>
              <Select
                value={formData.currencyPlacement}
                onValueChange={(val: 'before' | 'after') => setFormData({ ...formData, currencyPlacement: val })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_PLACEMENT_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Number Format */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="numberFormat" className="text-right font-medium">
                Number Format
              </Label>
              <Select
                value={formData.numberFormat}
                onValueChange={(val: any) => setFormData({ ...formData, numberFormat: val })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NUMBER_FORMAT_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Format */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="dateFormat" className="text-right font-medium">
                Date Format
              </Label>
              <Select
                value={formData.dateFormat}
                onValueChange={(val: any) => setFormData({ ...formData, dateFormat: val })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_FORMAT_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">
              Create Plan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
