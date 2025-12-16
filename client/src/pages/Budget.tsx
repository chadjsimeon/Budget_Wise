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
  CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Badge } from "@/components/ui/badge";
import { MoveMoneyDialog } from '@/components/modals/MoveMoneyDialog';
import { CreateCategoryDialog } from '@/components/modals/CreateCategoryDialog';
import { CreateCategoryGroupDialog } from '@/components/modals/CreateCategoryGroupDialog';

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
    getCategoryActivity,
    getCategoryAvailable,
    getReadyToAssign,
    budgetTemplates,
    saveCurrentAsTemplate,
    applyBudgetTemplate
  } = useStore();

  // Filter by current budget
  const categoryGroups = allCategoryGroups.filter(g => g.budgetId === currentBudgetId);
  const categories = allCategories.filter(c => c.budgetId === currentBudgetId);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    categoryGroups.reduce((acc, g) => ({ ...acc, [g.id]: true }), {})
  );

  const [filter, setFilter] = useState<FilterType>('all');

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
        assigned: monthlyAssignments[currentMonth]?.[cat.id] || 0,
        available: getCategoryAvailable(currentMonth, cat.id),
        goal: cat.goal || 0
      }))
      .filter(cat => cat.available < 0)
      .sort((a, b) => a.available - b.available); // Most overspent first

    // Step 2: Get underfunded categories (assigned < goal) - second priority
    const underfundedCategories = categories
      .map(cat => ({
        id: cat.id,
        assigned: monthlyAssignments[currentMonth]?.[cat.id] || 0,
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
      const assigned = monthlyAssignments[currentMonth]?.[cat.id] || 0;
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
            {categoryGroups.map(group => {
              const groupCategories = categories.filter(c => {
                if (c.groupId !== group.id) return false;
                const available = getCategoryAvailable(currentMonth, c.id);
                const assigned = monthlyAssignments[currentMonth]?.[c.id] || 0;

                if (filter === 'underfunded') return available < 0;
                if (filter === 'overfunded') return available < assigned;
                if (filter === 'available') return available > 0;
                return true;
              });

              if (groupCategories.length === 0) return null;

              const isExpanded = expandedGroups[group.id];

              return (
                <div key={group.id} className="border-b border-slate-100">
                  {/* Group Header */}
                  <div className="flex items-center justify-between px-6 py-3 hover:bg-slate-50 transition-colors group/header">
                    <button
                      onClick={() => toggleGroup(group.id)}
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

                  {/* Categories */}
                  {isExpanded && groupCategories.map(category => {
                    const assigned = monthlyAssignments[currentMonth]?.[category.id] || 0;
                    const activity = getCategoryActivity(currentMonth, category.id);
                    const available = getCategoryAvailable(currentMonth, category.id);
                    const goal = category.goal || 0;
                    const isOverspent = available < 0;
                    const isFunded = goal > 0 && assigned >= goal;
                    const isPartiallyFunded = goal > 0 && assigned > 0 && assigned < goal;

                    return (
                      <div
                        key={category.id}
                        className="grid grid-cols-[1fr_140px_140px_140px_140px] gap-4 px-6 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 group"
                      >
                        {/* Category Name */}
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
                  })}
                </div>
              );
            })}

            {/* Add Category Group Button */}
            <div className="p-6">
              <CreateCategoryGroupDialog
                trigger={
                  <Button variant="outline" className="w-full justify-center gap-2 text-slate-600 hover:text-slate-900 border-dashed">
                    <Plus className="w-4 h-4" />
                    Add Category Group
                  </Button>
                }
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
    </div>
  );
}
