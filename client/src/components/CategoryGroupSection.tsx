import React from 'react';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { ChevronDown, ChevronRight, Pencil, Trash2, Plus, GripVertical, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Badge } from "@/components/ui/badge";
import { CreateCategoryDialog } from '@/components/modals/CreateCategoryDialog';
import { MoveMoneyDialog } from '@/components/modals/MoveMoneyDialog';
import type { CategoryGroup, Category } from '@/lib/store';

interface CategoryGroupSectionProps {
  group: CategoryGroup;
  categories: Category[];
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  currentMonth: string;
  currentBudgetId: string;
  monthlyAssignments: any;
  getCategoryActivity: (month: string, categoryId: string) => number;
  getCategoryAvailable: (month: string, categoryId: string) => number;
  setCategoryAssignment: (month: string, categoryId: string, amount: number) => void;
  setCategoryGoal: (categoryId: string, goal: number) => void;
  formatCurrency: (amount: number) => string;
  groupSubtotals: {
    goal: number;
    assigned: number;
    activity: number;
    available: number;
  };
}

export function CategoryGroupSection({
  group,
  categories,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
  currentMonth,
  currentBudgetId,
  monthlyAssignments,
  getCategoryActivity,
  getCategoryAvailable,
  setCategoryAssignment,
  setCategoryGoal,
  formatCurrency,
  groupSubtotals
}: CategoryGroupSectionProps) {
  // Make group header a drop zone for dragging categories
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: group.id
  });

  return (
    <div className="border-b border-slate-100">
      {/* Group Header */}
      <div
        ref={setDropRef}
        className={cn(
          "flex items-center justify-between px-6 py-3 transition-colors group/header",
          isOver ? "bg-blue-50 border-2 border-blue-500" : "hover:bg-slate-50"
        )}
      >
        <button
          onClick={onToggle}
          className="flex items-center gap-2 flex-1"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400 transition-transform" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400 transition-transform" />
          )}
          <span className="font-semibold text-slate-700 text-sm uppercase tracking-wide">
            {group.name}
          </span>
        </button>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-0 group-hover/header:opacity-100 transition-opacity text-slate-400 hover:text-blue-600"
            onClick={onEdit}
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-0 group-hover/header:opacity-100 transition-opacity text-slate-400 hover:text-red-600"
            onClick={onDelete}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
          <CreateCategoryDialog
            groupId={group.id}
            trigger={
              <Button
                variant="ghost"
                size="sm"
                className="opacity-0 group-hover/header:opacity-100 transition-opacity text-slate-500 hover:text-blue-600"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Category
              </Button>
            }
          />
        </div>
      </div>

      {/* Subtotals when collapsed */}
      {!isExpanded && (
        <div className="grid grid-cols-[1fr_140px_140px_140px_140px] gap-4 px-6 py-3 bg-slate-50 border-b border-slate-200">
          <div className="text-sm font-medium text-slate-500 pl-6">
            Group Total ({categories.length} {categories.length === 1 ? 'category' : 'categories'})
          </div>
          <div className="text-sm font-semibold text-slate-600 text-right">
            {formatCurrency(groupSubtotals.goal)}
          </div>
          <div className="text-sm font-semibold text-slate-600 text-right">
            {formatCurrency(groupSubtotals.assigned)}
          </div>
          <div className="text-sm font-semibold text-slate-600 text-right">
            {formatCurrency(groupSubtotals.activity)}
          </div>
          <div className={cn(
            "text-sm font-semibold text-right",
            groupSubtotals.available < 0 ? "text-red-600" : "text-slate-700"
          )}>
            {formatCurrency(groupSubtotals.available)}
          </div>
        </div>
      )}

      {/* Categories */}
      {isExpanded && categories.map(category => (
        <CategoryRow
          key={category.id}
          category={category}
          groupId={group.id}
          currentMonth={currentMonth}
          currentBudgetId={currentBudgetId}
          monthlyAssignments={monthlyAssignments}
          getCategoryActivity={getCategoryActivity}
          getCategoryAvailable={getCategoryAvailable}
          setCategoryAssignment={setCategoryAssignment}
          setCategoryGoal={setCategoryGoal}
          formatCurrency={formatCurrency}
        />
      ))}
    </div>
  );
}

interface CategoryRowProps {
  category: Category;
  groupId: string;
  currentMonth: string;
  currentBudgetId: string;
  monthlyAssignments: any;
  getCategoryActivity: (month: string, categoryId: string) => number;
  getCategoryAvailable: (month: string, categoryId: string) => number;
  setCategoryAssignment: (month: string, categoryId: string, amount: number) => void;
  setCategoryGoal: (categoryId: string, goal: number) => void;
  formatCurrency: (amount: number) => string;
}

function CategoryRow({
  category,
  groupId,
  currentMonth,
  currentBudgetId,
  monthlyAssignments,
  getCategoryActivity,
  getCategoryAvailable,
  setCategoryAssignment,
  setCategoryGoal,
  formatCurrency
}: CategoryRowProps) {
  const assigned = monthlyAssignments[currentBudgetId]?.[currentMonth]?.[category.id] || 0;
  const activity = getCategoryActivity(currentMonth, category.id);
  const available = getCategoryAvailable(currentMonth, category.id);
  const goal = category.goal || 0;
  const isOverspent = available < 0;
  const isFunded = goal > 0 && assigned >= goal;
  const isPartiallyFunded = goal > 0 && assigned > 0 && assigned < goal;

  // Make category row draggable
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: category.id,
    data: { categoryId: category.id, currentGroupId: groupId }
  });

  return (
    <div
      ref={setNodeRef}
      className="grid grid-cols-[1fr_140px_140px_140px_140px] gap-4 px-6 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 group"
      style={{ opacity: isDragging ? 0.5 : 1, cursor: isDragging ? 'grabbing' : 'default' }}
    >
      {/* Category Name */}
      <div className="flex items-center gap-2">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 transition-colors"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <div className="flex flex-col justify-center">
          <div className="font-medium text-slate-700">
            {category.name}
          </div>
          {isOverspent && (
            <div className="text-xs text-red-600 mt-0.5">
              Overspent: {formatCurrency(Math.abs(available))} of {formatCurrency(assigned)}
            </div>
          )}
          {!isOverspent && goal > 0 && (
            <div className={cn(
              "text-xs mt-0.5",
              isFunded ? "text-green-600" : isPartiallyFunded ? "text-orange-500" : "text-slate-400"
            )}>
              {formatCurrency(assigned)} / {formatCurrency(goal)}
              {isFunded && " ✓"}
            </div>
          )}
        </div>
      </div>

      {/* Goal */}
      <div className="flex items-center justify-end">
        <Input
          type="number"
          step="any"
          min="0"
          className="w-full text-right h-9 border-slate-200 hover:border-slate-300 focus:border-blue-500 transition-colors"
          value={goal || ''}
          placeholder="0.00"
          onClick={(e) => (e.target as HTMLInputElement).select()}
          onChange={(e) => {
            const val = parseFloat(e.target.value) || 0;
            const rounded = Math.round(val * 100) / 100;
            setCategoryGoal(category.id, rounded);
          }}
        />
      </div>

      {/* Assigned */}
      <div className="flex items-center justify-end">
        <Input
          type="number"
          step="any"
          min="0"
          className="w-full text-right h-9 border-slate-200 hover:border-slate-300 focus:border-blue-500 transition-colors"
          value={assigned || ''}
          placeholder="0.00"
          onClick={(e) => (e.target as HTMLInputElement).select()}
          onChange={(e) => {
            const val = parseFloat(e.target.value) || 0;
            const rounded = Math.round(val * 100) / 100;
            setCategoryAssignment(currentMonth, category.id, rounded);
          }}
        />
      </div>

      {/* Activity */}
      <div className="flex items-center justify-end">
        <span className="text-sm font-medium text-slate-600">
          {formatCurrency(activity)}
        </span>
      </div>

      {/* Available */}
      <div className="flex items-center justify-end gap-2">
        {available < 0 ? (
          <Badge
            variant="destructive"
            className="bg-red-500 hover:bg-red-600 text-white font-semibold px-3 py-1 rounded-full"
          >
            {formatCurrency(available)}
          </Badge>
        ) : (
          <span className={cn(
            "text-sm font-semibold",
            available > 0 ? "text-slate-700" : "text-slate-400"
          )}>
            {formatCurrency(available)}
          </span>
        )}
        <MoveMoneyDialog
          sourceCategoryId={category.id}
          trigger={
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-blue-600"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
            </Button>
          }
        />
      </div>
    </div>
  );
}
