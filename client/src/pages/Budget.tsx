import React, { useState, useMemo } from 'react';
import { useStore } from '@/lib/store';
import { format, addMonths, subMonths, parse } from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Plus,
  ArrowRightLeft,
  CheckCircle2,
  Pencil,
  Trash2,
  GripVertical
} from 'lucide-react';
import {
  DndContext,
  DragEndEvent,
  useDraggable,
  useDroppable,
  closestCenter
} from '@dnd-kit/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Badge } from "@/components/ui/badge";
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MoveMoneyDialog } from '@/components/modals/MoveMoneyDialog';
import { CreateCategoryDialog } from '@/components/modals/CreateCategoryDialog';
import { CreateCategoryGroupDialog } from '@/components/modals/CreateCategoryGroupDialog';
import { CategoryGroupSection } from '@/components/CategoryGroupSection';

type FilterType = 'all' | 'underfunded' | 'overfunded' | 'available';

export default function BudgetPage() {
  const {
    currentMonth,
    setMonth,
    currentBudgetId,
    categoryGroups: allCategoryGroups,
    categories: allCategories,
    monthlyAssignments,
    setCategoryAssignment,
    setCategoryGoal,
    updateCategory,
    getCategoryActivity,
    getCategoryAvailable,
    getReadyToAssign,
    budgetTemplates,
    saveCurrentAsTemplate,
    applyBudgetTemplate,
    deleteCategoryGroup
  } = useStore();

  const { toast } = useToast();

  // Filter by current budget
  const categoryGroups = allCategoryGroups.filter(g => g.budgetId === currentBudgetId);
  const categories = allCategories.filter(c => c.budgetId === currentBudgetId);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    categoryGroups.reduce((acc, g) => ({ ...acc, [g.id]: true }), {})
  );

  const [filter, setFilter] = useState<FilterType>('all');

  // State for edit dialog
  const [editingGroup, setEditingGroup] = useState<typeof categoryGroups[0] | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // State for delete confirmation
  const [deletingGroup, setDeletingGroup] = useState<typeof categoryGroups[0] | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const handlePrevMonth = () => {
    const date = parse(currentMonth, 'yyyy-MM', new Date());
    const newMonth = format(subMonths(date, 1), 'yyyy-MM');
    setMonth(newMonth);
  };

  const handleNextMonth = () => {
    const date = parse(currentMonth, 'yyyy-MM', new Date());
    const newMonth = format(addMonths(date, 1), 'yyyy-MM');
    setMonth(newMonth);
  };

  const handleSaveTemplate = () => {
    const name = prompt('Enter template name:');
    if (name) {
      const isDefault = confirm('Set as default template for new months?');
      saveCurrentAsTemplate(name, isDefault);
      alert(`Template "${name}" saved!`);
    }
  };

  const handleLoadTemplate = () => {
    if (budgetTemplates.length === 0) {
      alert('No templates saved yet.');
      return;
    }
    const templateOptions = budgetTemplates.map((t, i) => `${i + 1}. ${t.name}${t.isDefault ? ' (Default)' : ''}`).join('\n');
    const choice = prompt(`Select a template:\n${templateOptions}\n\nEnter number:`);
    if (choice) {
      const index = parseInt(choice) - 1;
      if (index >= 0 && index < budgetTemplates.length) {
        applyBudgetTemplate(budgetTemplates[index].id, currentMonth);
        alert(`Template "${budgetTemplates[index].name}" applied to ${format(parse(currentMonth, 'yyyy-MM', new Date()), 'MMMM yyyy')}!`);
      }
    }
  };

  const readyToAssign = getReadyToAssign(currentMonth);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-TT', { style: 'currency', currency: 'TTD' }).format(amount);
  };

  // Auto-assign function: fund categories to their goal amounts
  const handleEditGroup = (group: typeof categoryGroups[0]) => {
    setEditingGroup(group);
    setIsEditDialogOpen(true);
  };

  const handleDeleteGroup = (group: typeof categoryGroups[0]) => {
    setDeletingGroup(group);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteGroup = () => {
    if (deletingGroup) {
      const categoryCount = categories.filter(c => c.groupId === deletingGroup.id).length;
      deleteCategoryGroup(deletingGroup.id);
      toast({
        title: "Category group deleted",
        description: `Deleted "${deletingGroup.name}"${categoryCount > 0 ? ` and ${categoryCount} ${categoryCount === 1 ? 'category' : 'categories'}` : ''}`,
      });
      setDeletingGroup(null);
      setIsDeleteDialogOpen(false);
    }
  };

  const handleAutoAssign = () => {
    let remainingToAssign = readyToAssign;

    if (remainingToAssign <= 0) {
      alert('No money available to assign. Ready to Assign must be positive.');
      return;
    }

    // Step 1: Get overspent categories (available < 0) - highest priority
    const overspentCategories = categories
      .map(cat => ({
        id: cat.id,
        assigned: monthlyAssignments[currentBudgetId]?.[currentMonth]?.[cat.id] || 0,
        available: getCategoryAvailable(currentMonth, cat.id),
        goal: cat.goal || 0
      }))
      .filter(cat => cat.available < 0)
      .sort((a, b) => a.available - b.available); // Most overspent first

    // Step 2: Get underfunded categories (assigned < goal) - second priority
    const underfundedCategories = categories
      .map(cat => ({
        id: cat.id,
        assigned: monthlyAssignments[currentBudgetId]?.[currentMonth]?.[cat.id] || 0,
        available: getCategoryAvailable(currentMonth, cat.id),
        goal: cat.goal || 0
      }))
      .filter(cat => cat.goal && cat.goal > 0 && cat.assigned < cat.goal && cat.available >= 0)
      .sort((a, b) => (a.assigned / a.goal) - (b.assigned / b.goal)); // Least funded percentage first

    let categoriesFunded = 0;

    // First, cover all overspending
    overspentCategories.forEach(cat => {
      if (remainingToAssign <= 0) return;

      const overspentAmount = Math.abs(cat.available);
      const amountToAssign = Math.min(overspentAmount, remainingToAssign);

      const newAssignment = cat.assigned + amountToAssign;
      setCategoryAssignment(currentMonth, cat.id, newAssignment);

      remainingToAssign -= amountToAssign;
      categoriesFunded++;
    });

    // Then, fund underfunded categories toward their goals
    underfundedCategories.forEach(cat => {
      if (remainingToAssign <= 0) return;

      const neededAmount = cat.goal - cat.assigned;
      const amountToAssign = Math.min(neededAmount, remainingToAssign);

      const newAssignment = cat.assigned + amountToAssign;
      setCategoryAssignment(currentMonth, cat.id, newAssignment);

      remainingToAssign -= amountToAssign;
      categoriesFunded++;
    });

    const totalAssigned = readyToAssign - remainingToAssign;
    alert(`Auto-assigned ${formatCurrency(totalAssigned)} to ${categoriesFunded} ${categoriesFunded === 1 ? 'category' : 'categories'} to meet goals.`);
  };

  // Calculate filter counts, month summary, and cost to be me
  const { filterCounts, monthSummary, costToBeMe } = useMemo(() => {
    let underfundedCount = 0;
    let overfundedCount = 0;
    let availableCount = 0;
    let totalAssigned = 0;
    let totalActivity = 0;
    let totalAvailable = 0;
    let totalGoals = 0;

    categories.forEach(cat => {
      const assigned = monthlyAssignments[currentBudgetId]?.[currentMonth]?.[cat.id] || 0;
      const activity = getCategoryActivity(currentMonth, cat.id);
      const available = getCategoryAvailable(currentMonth, cat.id);

      totalAssigned += assigned;
      totalActivity += activity;
      totalAvailable += available;
      if (cat.goal) totalGoals += cat.goal;

      if (available < 0) underfundedCount++;
      if (available > assigned && assigned > 0) overfundedCount++;
      if (available > 0) availableCount++;
    });

    return {
      filterCounts: {
        underfunded: underfundedCount,
        overfunded: overfundedCount,
        available: availableCount
      },
      monthSummary: {
        assigned: totalAssigned,
        activity: totalActivity,
        available: totalAvailable
      },
      costToBeMe: totalGoals
    };
  }, [categories, currentMonth, monthlyAssignments, getCategoryActivity, getCategoryAvailable]);

  // Calculate group subtotals for collapsed display
  const groupSubtotals = useMemo(() => {
    const subtotals: Record<string, {
      goal: number;
      assigned: number;
      activity: number;
      available: number;
    }> = {};

    categoryGroups.forEach(group => {
      const groupCategories = categories.filter(c => c.groupId === group.id);

      let totalGoal = 0;
      let totalAssigned = 0;
      let totalActivity = 0;
      let totalAvailable = 0;

      groupCategories.forEach(cat => {
        totalGoal += cat.goal || 0;
        totalAssigned += monthlyAssignments[currentBudgetId]?.[currentMonth]?.[cat.id] || 0;
        totalActivity += getCategoryActivity(currentMonth, cat.id);
        totalAvailable += getCategoryAvailable(currentMonth, cat.id);
      });

      subtotals[group.id] = {
        goal: totalGoal,
        assigned: totalAssigned,
        activity: totalActivity,
        available: totalAvailable
      };
    });

    return subtotals;
  }, [categoryGroups, categories, currentMonth, monthlyAssignments, currentBudgetId, getCategoryActivity, getCategoryAvailable]);

  // Handle drag and drop for moving categories between groups
  const handleDragEnd = (event: DragEndEvent) => {
    const {active, over} = event;

    if (!over) return; // Dropped outside valid zone

    const categoryId = active.id as string;
    const newGroupId = over.id as string;
    const currentGroupId = active.data.current?.currentGroupId;

    // Prevent no-op moves to same group
    if (newGroupId === currentGroupId) return;

    // Update category's groupId
    updateCategory(categoryId, { groupId: newGroupId });

    // Show success toast
    const newGroup = categoryGroups.find(g => g.id === newGroupId);
    toast({
      title: "Category moved",
      description: `Moved to "${newGroup?.name}"`
    });
  };

  return (
    <div className="flex h-full bg-slate-50">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Centered Header */}
        <header className="flex-none bg-white border-b">
          <div className="px-8 py-6 flex items-center justify-center gap-8">
            {/* Month Selector */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrevMonth}
                className="h-10 w-10 hover:bg-slate-100"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3 min-w-[200px] justify-center">
                <span className="text-2xl font-bold text-slate-900">
                  {format(parse(currentMonth, 'yyyy-MM', new Date()), 'MMM yyyy')}
                </span>
                <Button variant="ghost" size="sm" className="text-slate-500">
                  <span className="text-sm">Enter a note...</span>
                </Button>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNextMonth}
                className="h-10 w-10 hover:bg-slate-100"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>

            {/* Ready to Assign */}
            <div className="flex flex-col items-center gap-1">
              <div className={cn(
                "text-2xl font-bold flex items-center gap-2",
                readyToAssign === 0 ? "text-slate-900" : readyToAssign > 0 ? "text-slate-900" : "text-red-600"
              )}>
                {formatCurrency(readyToAssign)}
                {readyToAssign === 0 && (
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                )}
              </div>
              <span className="text-xs text-slate-500 font-medium">
                {readyToAssign === 0 ? "All Money Assigned" : "Ready to Assign"}
              </span>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="border-t border-slate-200 px-8 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-6">
            <button
              onClick={() => setFilter('all')}
              className={cn(
                "relative py-3 px-1 text-sm font-medium transition-colors border-b-2 -mb-px",
                filter === 'all'
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              )}
            >
              All
            </button>
            <button
              onClick={() => setFilter('underfunded')}
              className={cn(
                "relative py-3 px-1 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-2",
                filter === 'underfunded'
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              )}
            >
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              <span>{filterCounts.underfunded} Overspent</span>
            </button>
            <button
              onClick={() => setFilter('overfunded')}
              className={cn(
                "relative py-3 px-1 text-sm font-medium transition-colors border-b-2 -mb-px",
                filter === 'overfunded'
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              )}
            >
              Underfunded
            </button>
            <button
              onClick={() => setFilter('available')}
              className={cn(
                "relative py-3 px-1 text-sm font-medium transition-colors border-b-2 -mb-px",
                filter === 'available'
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              )}
            >
              Money Available
            </button>
            </div>

            {/* Template Buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveTemplate}
                className="text-xs"
              >
                Save as Template
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadTemplate}
                className="text-xs"
                disabled={budgetTemplates.length === 0}
              >
                Load Template
              </Button>
            </div>
          </div>
        </header>

        {/* Categories Content */}
        <div className="flex-1 overflow-auto bg-white">
          <div className="max-w-5xl mx-auto">
            {/* Table Header */}
            <div className="sticky top-0 bg-slate-50 border-b border-slate-200 grid grid-cols-[1fr_140px_140px_140px_140px] gap-4 px-6 py-3">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Goal</div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Assigned</div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Activity</div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Available</div>
            </div>

            {/* Category Groups */}
            <DndContext onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
            {categoryGroups.map(group => {
              const groupCategories = categories.filter(c => {
                if (c.groupId !== group.id) return false;
                const available = getCategoryAvailable(currentMonth, c.id);
                const assigned = monthlyAssignments[currentBudgetId]?.[currentMonth]?.[c.id] || 0;

                if (filter === 'underfunded') return available < 0;
                if (filter === 'overfunded') return available < assigned;
                if (filter === 'available') return available > 0;
                return true;
              });

              // Show empty groups only when filter is 'all'
              if (groupCategories.length === 0 && filter !== 'all') return null;

              const isExpanded = expandedGroups[group.id] ?? true;
              const subtotals = groupSubtotals[group.id] || { goal: 0, assigned: 0, activity: 0, available: 0 };

              return (
                <CategoryGroupSection
                  key={group.id}
                  group={group}
                  categories={groupCategories}
                  isExpanded={isExpanded}
                  onToggle={() => toggleGroup(group.id)}
                  onEdit={() => handleEditGroup(group)}
                  onDelete={() => handleDeleteGroup(group)}
                  currentMonth={currentMonth}
                  currentBudgetId={currentBudgetId}
                  monthlyAssignments={monthlyAssignments}
                  getCategoryActivity={getCategoryActivity}
                  getCategoryAvailable={getCategoryAvailable}
                  setCategoryAssignment={setCategoryAssignment}
                  setCategoryGoal={setCategoryGoal}
                  formatCurrency={formatCurrency}
                  groupSubtotals={subtotals}
                />
              );
            })}
            </DndContext>

            {/* Add Category Group Button */}
            <div className="p-6">
              <CreateCategoryGroupDialog
                trigger={
                  <Button variant="outline" className="w-full justify-center gap-2 text-slate-600 hover:text-slate-900 border-dashed">
                    <Plus className="w-4 h-4" />
                    Add Category Group
                  </Button>
                }
                onSuccess={() => {
                  toast({
                    title: "Category group created",
                    description: "Successfully created new category group",
                  });
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Month Summary */}
      <div className="w-80 border-l border-slate-200 bg-white flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            {format(parse(currentMonth, 'yyyy-MM', new Date()), 'MMMM')}'s Summary
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </h2>
        </div>

        <div className="flex-1 p-6 space-y-6">
          {/* Left Over from Last Month */}
          <div>
            <div className="text-sm text-slate-500 mb-2">Left Over from Last Month</div>
            <div className="text-2xl font-bold text-slate-900">{formatCurrency(0)}</div>
          </div>

          {/* Assigned in [Month] */}
          <div>
            <div className="text-sm text-slate-500 mb-2">
              Assigned in {format(parse(currentMonth, 'yyyy-MM', new Date()), 'MMMM')}
            </div>
            <div className="text-2xl font-bold text-slate-900">{formatCurrency(monthSummary.assigned)}</div>
          </div>

          {/* Activity */}
          <div>
            <div className="text-sm text-slate-500 mb-2">Activity</div>
            <div className="text-2xl font-bold text-slate-900">{formatCurrency(monthSummary.activity)}</div>
          </div>

          {/* Available */}
          <div>
            <div className="text-sm text-slate-500 mb-2">Available</div>
            <div className={cn(
              "text-2xl font-bold",
              monthSummary.available < 0 ? "text-red-600" : "text-slate-900"
            )}>
              {formatCurrency(monthSummary.available)}
            </div>
          </div>

          {/* Cost to Be Me */}
          <div className="pt-6 border-t border-slate-200">
            <div className="text-sm text-slate-500 mb-2">Cost to Be Me</div>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(costToBeMe)}
            </div>
            <p className="text-xs text-slate-500 mt-1">Total monthly budget goal</p>
          </div>
        </div>

        {/* Auto-Assign Button */}
        <div className="p-6 border-t border-slate-200">
          <Button
            onClick={handleAutoAssign}
            disabled={readyToAssign <= 0}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ⚡ Auto-Assign
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>

      {/* Edit Category Group Dialog */}
      <CreateCategoryGroupDialog
        categoryGroup={editingGroup || undefined}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSuccess={() => {
          toast({
            title: "Category group updated",
            description: `Successfully updated "${editingGroup?.name}"`,
          });
          setEditingGroup(null);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category Group?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingGroup && (
                <>
                  This will permanently delete "{deletingGroup.name}"
                  {categories.filter(c => c.groupId === deletingGroup.id).length > 0 && (
                    <> and all <strong>{categories.filter(c => c.groupId === deletingGroup.id).length}</strong> {categories.filter(c => c.groupId === deletingGroup.id).length === 1 ? 'category' : 'categories'} within it</>
                  )}
                  . This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteGroup}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
