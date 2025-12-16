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
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';

interface CreateCategoryGroupDialogProps {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

// Preset category groups
const GROUP_PRESETS = [
  'Housing',
  'Food',
  'Transportation',
  'Insurance',
  'Healthcare',
  'Debt Payments',
  'Savings',
  'Lifestyle',
  'Entertainment',
  'Personal Care',
  'Education',
  'Gifts & Donations',
  'Other'
];

export function CreateCategoryGroupDialog({ trigger, onSuccess }: CreateCategoryGroupDialogProps) {
  const [open, setOpen] = useState(false);
  const { addCategoryGroup } = useStore();

  const [groupName, setGroupName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!groupName.trim()) {
      alert('Please enter a category group name');
      return;
    }

    addCategoryGroup({
      name: groupName
    });

    setGroupName('');
    setOpen(false);
    onSuccess?.();
  };

  const handlePresetClick = (preset: string) => {
    setGroupName(preset);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Plus className="w-4 h-4" /> Category Group
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Category Group</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Group Name */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="groupName" className="text-right">
                Group Name
              </Label>
              <Input
                id="groupName"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="col-span-3"
                placeholder="e.g. Monthly Bills"
                required
              />
            </div>

            {/* Preset Groups */}
            <div className="col-span-4 border-t pt-4">
              <Label className="text-sm font-medium mb-3 block">Common Category Groups</Label>
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-md">
                {GROUP_PRESETS.map((preset, idx) => (
                  <Badge
                    key={idx}
                    variant="outline"
                    className="cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors"
                    onClick={() => handlePresetClick(preset)}
                  >
                    {preset}
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
            <Button type="submit">Create Group</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
