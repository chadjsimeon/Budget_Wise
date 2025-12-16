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
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';

interface CreateCategoryDialogProps {
  trigger?: React.ReactNode;
  groupId?: string;
  onSuccess?: () => void;
}

// Preset budget categories
const CATEGORY_PRESETS = [
  { name: 'Rent/Mortgage', group: 'Housing' },
  { name: 'Electric', group: 'Housing' },
  { name: 'Water', group: 'Housing' },
  { name: 'Internet', group: 'Housing' },
  { name: 'Phone', group: 'Housing' },
  { name: 'Groceries', group: 'Food' },
  { name: 'Dining Out', group: 'Food' },
  { name: 'Gas/Fuel', group: 'Transportation' },
  { name: 'Car Payment', group: 'Transportation' },
  { name: 'Car Insurance', group: 'Transportation' },
  { name: 'Public Transit', group: 'Transportation' },
  { name: 'Health Insurance', group: 'Insurance' },
  { name: 'Life Insurance', group: 'Insurance' },
  { name: 'Entertainment', group: 'Lifestyle' },
  { name: 'Subscriptions', group: 'Lifestyle' },
  { name: 'Gym Membership', group: 'Lifestyle' },
  { name: 'Clothing', group: 'Lifestyle' },
  { name: 'Emergency Fund', group: 'Savings' },
  { name: 'Vacation', group: 'Savings' },
  { name: 'Gift Budget', group: 'Other' },
];

export function CreateCategoryDialog({ trigger, groupId, onSuccess }: CreateCategoryDialogProps) {
  const [open, setOpen] = useState(false);
  const { currentBudgetId, categoryGroups: allCategoryGroups, addCategory } = useStore();

  // Filter by current budget
  const categoryGroups = allCategoryGroups.filter(g => g.budgetId === currentBudgetId);

  const [formData, setFormData] = useState({
    name: '',
    groupId: groupId || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.groupId) {
      alert('Please enter a category name and select a group');
      return;
    }

    addCategory({
      name: formData.name,
      groupId: formData.groupId
    });

    setFormData({ name: '', groupId: groupId || '' });
    setOpen(false);
    onSuccess?.();
  };

  const handlePresetClick = (preset: typeof CATEGORY_PRESETS[0]) => {
    setFormData(prev => ({ ...prev, name: preset.name }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Plus className="w-4 h-4" /> Add Category
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add Budget Category</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Category Group Selection */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="group" className="text-right">
                Category Group
              </Label>
              <Select
                value={formData.groupId}
                onValueChange={(val) => setFormData({ ...formData, groupId: val })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select group" />
                </SelectTrigger>
                <SelectContent>
                  {categoryGroups.map(group => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category Name */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Category Name
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="col-span-3"
                placeholder="e.g. Groceries"
                required
              />
            </div>

            {/* Preset Categories */}
            <div className="col-span-4 border-t pt-4">
              <Label className="text-sm font-medium mb-3 block">Common Budget Categories</Label>
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-md">
                {CATEGORY_PRESETS.map((preset, idx) => (
                  <Badge
                    key={idx}
                    variant="outline"
                    className="cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors"
                    onClick={() => handlePresetClick(preset)}
                  >
                    {preset.name}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-2">Click any preset to use it</p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Category</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
