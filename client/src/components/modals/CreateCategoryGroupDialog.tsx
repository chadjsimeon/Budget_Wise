import { useState, useEffect } from 'react';
import { useStore, CategoryGroup } from '@/lib/store';
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
  categoryGroup?: CategoryGroup;  // If provided, edit mode
  open?: boolean;                  // Controlled state
  onOpenChange?: (open: boolean) => void;
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

export function CreateCategoryGroupDialog({
  trigger,
  categoryGroup,
  open: controlledOpen,
  onOpenChange,
  onSuccess
}: CreateCategoryGroupDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const { addCategoryGroup, updateCategoryGroup } = useStore();

  const [groupName, setGroupName] = useState('');

  // Determine if we're in controlled or uncontrolled mode
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (onOpenChange || (() => {})) : setInternalOpen;

  // Determine if we're in edit mode
  const isEditMode = !!categoryGroup;

  // Initialize groupName from categoryGroup when editing
  useEffect(() => {
    if (categoryGroup) {
      setGroupName(categoryGroup.name);
    } else {
      setGroupName('');
    }
  }, [categoryGroup, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!groupName.trim()) {
      alert('Please enter a category group name');
      return;
    }

    if (isEditMode && categoryGroup) {
      // Update existing category group
      updateCategoryGroup(categoryGroup.id, { name: groupName });
    } else {
      // Create new category group
      addCategoryGroup({ name: groupName });
    }

    setGroupName('');
    setOpen(false);
    onSuccess?.();
  };

  const handlePresetClick = (preset: string) => {
    setGroupName(preset);
  };

  const dialogContent = (
    <DialogContent className="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle>{isEditMode ? 'Edit Category Group' : 'Add Category Group'}</DialogTitle>
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
          <Button type="submit">{isEditMode ? 'Save Changes' : 'Create Group'}</Button>
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
          <Button variant="outline" size="sm" className="gap-2">
            <Plus className="w-4 h-4" /> Category Group
          </Button>
        )}
      </DialogTrigger>
      {dialogContent}
    </Dialog>
  );
}
