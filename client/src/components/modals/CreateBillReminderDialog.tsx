import { useState, useEffect } from 'react';
import { useStore, type BillReminder, type BillFrequency } from '@/lib/store';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

interface CreateBillReminderDialogProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  reminder?: BillReminder;
  onSuccess?: () => void;
}

export function CreateBillReminderDialog({ trigger, open: controlledOpen, onOpenChange, reminder, onSuccess }: CreateBillReminderDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (onOpenChange || (() => {})) : setInternalOpen;

  const { toast } = useToast();
  const addBillReminder = useStore(state => state.addBillReminder);
  const updateBillReminder = useStore(state => state.updateBillReminder);
  const currentBudgetId = useStore(state => state.currentBudgetId);
  const accounts = useStore(state => state.accounts).filter(a => a.budgetId === currentBudgetId && a.isActive);
  const categories = useStore(state => state.categories).filter(c => c.budgetId === currentBudgetId);
  const categoryGroups = useStore(state => state.categoryGroups).filter(g => g.budgetId === currentBudgetId);

  const isEditMode = !!reminder;

  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    frequency: 'monthly' as BillFrequency,
    dueDay: '1',
    dueDateOverride: '',
    categoryId: '',
    accountId: '',
    autoCreateTransaction: false,
    reminderDaysBefore: '3',
    notes: '',
  });

  useEffect(() => {
    if (reminder) {
      setFormData({
        name: reminder.name,
        amount: reminder.amount.toString(),
        frequency: reminder.frequency,
        dueDay: reminder.dueDay.toString(),
        dueDateOverride: reminder.dueDateOverride || '',
        categoryId: reminder.categoryId || '',
        accountId: reminder.accountId || '',
        autoCreateTransaction: reminder.autoCreateTransaction,
        reminderDaysBefore: reminder.reminderDaysBefore.toString(),
        notes: reminder.notes || '',
      });
    } else if (!open) {
      setFormData({
        name: '',
        amount: '',
        frequency: 'monthly',
        dueDay: '1',
        dueDateOverride: '',
        categoryId: '',
        accountId: '',
        autoCreateTransaction: false,
        reminderDaysBefore: '3',
        notes: '',
      });
    }
  }, [reminder, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast({ title: "Missing name", description: "Bill name is required", variant: "destructive" });
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Invalid amount", description: "Amount must be a positive number", variant: "destructive" });
      return;
    }

    const data = {
      name: formData.name.trim(),
      amount,
      frequency: formData.frequency,
      dueDay: parseInt(formData.dueDay) || 1,
      dueDateOverride: formData.dueDateOverride || undefined,
      categoryId: formData.categoryId || undefined,
      accountId: formData.accountId || undefined,
      isActive: true,
      autoCreateTransaction: formData.autoCreateTransaction,
      reminderDaysBefore: parseInt(formData.reminderDaysBefore) || 3,
      notes: formData.notes || undefined,
    };

    if (isEditMode && reminder) {
      updateBillReminder(reminder.id, data);
      toast({ title: "Bill updated", description: `"${data.name}" has been updated` });
      onSuccess?.();
    } else {
      addBillReminder(data);
      toast({ title: "Bill added", description: `"${data.name}" has been added` });
    }

    setOpen(false);
  };

  const showDueDay = formData.frequency === 'monthly' || formData.frequency === 'quarterly';
  const showDayOfWeek = formData.frequency === 'weekly' || formData.frequency === 'biweekly';
  const showDateOverride = formData.frequency === 'yearly' || formData.frequency === 'quarterly';

  const dialogContent = (
    <DialogContent className="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle>{isEditMode ? 'Edit Bill Reminder' : 'Add Bill Reminder'}</DialogTitle>
        <DialogDescription>
          {isEditMode ? 'Update bill reminder details.' : 'Set up a recurring bill reminder.'}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
        <div className="space-y-1">
          <Label htmlFor="bill-name">Bill Name</Label>
          <Input
            id="bill-name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Electric Bill"
            required
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="bill-amount">Amount</Label>
          <Input
            id="bill-amount"
            type="number"
            step="0.01"
            min="0"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            placeholder="0.00"
            required
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="bill-frequency">Frequency</Label>
          <Select
            value={formData.frequency}
            onValueChange={(val) => setFormData({ ...formData, frequency: val as BillFrequency })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="biweekly">Biweekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {showDueDay && (
          <div className="space-y-1">
            <Label htmlFor="bill-dueday">Due Day of Month</Label>
            <Input
              id="bill-dueday"
              type="number"
              min="1"
              max="31"
              value={formData.dueDay}
              onChange={(e) => setFormData({ ...formData, dueDay: e.target.value })}
            />
          </div>
        )}

        {showDayOfWeek && (
          <div className="space-y-1">
            <Label htmlFor="bill-dayofweek">Day of Week</Label>
            <Select
              value={formData.dueDay}
              onValueChange={(val) => setFormData({ ...formData, dueDay: val })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Sunday</SelectItem>
                <SelectItem value="1">Monday</SelectItem>
                <SelectItem value="2">Tuesday</SelectItem>
                <SelectItem value="3">Wednesday</SelectItem>
                <SelectItem value="4">Thursday</SelectItem>
                <SelectItem value="5">Friday</SelectItem>
                <SelectItem value="6">Saturday</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {showDateOverride && (
          <div className="space-y-1">
            <Label htmlFor="bill-date-override">
              {formData.frequency === 'yearly' ? 'Annual Due Date' : 'First Due Date'}
            </Label>
            <Input
              id="bill-date-override"
              type="date"
              value={formData.dueDateOverride}
              onChange={(e) => setFormData({ ...formData, dueDateOverride: e.target.value })}
            />
          </div>
        )}

        <div className="space-y-1">
          <Label htmlFor="bill-category">Category (optional)</Label>
          <Select
            value={formData.categoryId}
            onValueChange={(val) => setFormData({ ...formData, categoryId: val === '__none__' ? '' : val })}
          >
            <SelectTrigger>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {categoryGroups.map(group => {
                const groupCats = categories.filter(c => c.groupId === group.id);
                if (groupCats.length === 0) return null;
                return groupCats.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {group.name} / {cat.name}
                  </SelectItem>
                ));
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="bill-account">Payment Account (optional)</Label>
          <Select
            value={formData.accountId}
            onValueChange={(val) => setFormData({ ...formData, accountId: val === '__none__' ? '' : val })}
          >
            <SelectTrigger>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {accounts.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="bill-auto-create" className="text-sm font-normal cursor-pointer">
            Auto-create transaction when marked paid
          </Label>
          <Switch
            id="bill-auto-create"
            checked={formData.autoCreateTransaction}
            onCheckedChange={(checked) => setFormData({ ...formData, autoCreateTransaction: checked })}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="bill-reminder-days">Reminder Days Before</Label>
          <Input
            id="bill-reminder-days"
            type="number"
            min="0"
            max="30"
            value={formData.reminderDaysBefore}
            onChange={(e) => setFormData({ ...formData, reminderDaysBefore: e.target.value })}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="bill-notes">Notes (optional)</Label>
          <Textarea
            id="bill-notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Any additional notes..."
            rows={2}
          />
        </div>

        <DialogFooter>
          <Button type="submit">{isEditMode ? 'Save Changes' : 'Add Bill'}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );

  if (isControlled) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        {dialogContent}
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button variant="outline" size="sm">Add Bill</Button>}
      </DialogTrigger>
      {dialogContent}
    </Dialog>
  );
}
