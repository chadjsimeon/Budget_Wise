import React, { useState } from 'react';
import { useStore } from '@/lib/store';
import { format, addMonths, subMonths, parse } from 'date-fns';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Search,
  Filter,
  MoreHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function BudgetPage() {
  const { 
    currentMonth, 
    setMonth, 
    categoryGroups, 
    categories, 
    monthlyAssignments,
    setCategoryAssignment,
    getCategoryActivity,
    getCategoryAvailable,
    getReadyToAssign
  } = useStore();

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    categoryGroups.reduce((acc, g) => ({ ...acc, [g.id]: true }), {})
  );

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const handlePrevMonth = () => {
    const date = parse(currentMonth, 'yyyy-MM', new Date());
    setMonth(format(subMonths(date, 1), 'yyyy-MM'));
  };

  const handleNextMonth = () => {
    const date = parse(currentMonth, 'yyyy-MM', new Date());
    setMonth(format(addMonths(date, 1), 'yyyy-MM'));
  };

  const readyToAssign = getReadyToAssign(currentMonth);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-TT', { style: 'currency', currency: 'TTD' }).format(amount);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header Month Selector & RTA */}
      <header className="flex-none bg-slate-50 border-b p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white rounded-md shadow-sm border p-1">
            <Button variant="ghost" size="icon" onClick={handlePrevMonth} className="h-8 w-8">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="w-32 text-center font-semibold text-lg">
              {format(parse(currentMonth, 'yyyy-MM', new Date()), 'MMMM yyyy')}
            </span>
            <Button variant="ghost" size="icon" onClick={handleNextMonth} className="h-8 w-8">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-col items-center">
          <div className={cn(
            "text-3xl font-bold tracking-tight px-6 py-2 rounded-lg transition-colors",
            readyToAssign >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
          )}>
            {formatCurrency(readyToAssign)}
          </div>
          <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 mt-1">Ready to Assign</span>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Plus className="w-4 h-4" /> Category Group
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-sm border overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="w-[400px]">CATEGORY</TableHead>
                <TableHead className="text-right w-[150px]">ASSIGNED</TableHead>
                <TableHead className="text-right w-[150px]">ACTIVITY</TableHead>
                <TableHead className="text-right w-[150px]">AVAILABLE</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categoryGroups.map(group => {
                const groupCategories = categories.filter(c => c.groupId === group.id);
                const isExpanded = expandedGroups[group.id];

                return (
                  <React.Fragment key={group.id}>
                    {/* Group Header */}
                    <TableRow 
                      className="bg-slate-50/50 hover:bg-slate-100 cursor-pointer"
                      onClick={() => toggleGroup(group.id)}
                    >
                      <TableCell className="font-semibold text-slate-700 py-3 flex items-center gap-2">
                         <span className={cn("transition-transform duration-200", isExpanded ? "rotate-90" : "")}>
                           <ChevronRight className="w-4 h-4 text-slate-400" />
                         </span>
                         {group.name}
                      </TableCell>
                      <TableCell colSpan={3}></TableCell>
                    </TableRow>

                    {/* Categories */}
                    {isExpanded && groupCategories.map(category => {
                      const assigned = monthlyAssignments[currentMonth]?.[category.id] || 0;
                      const activity = getCategoryActivity(currentMonth, category.id);
                      const available = getCategoryAvailable(currentMonth, category.id);

                      return (
                        <TableRow key={category.id} className="group">
                          <TableCell className="py-2 pl-10 font-medium text-slate-600">
                            {category.name}
                          </TableCell>
                          <TableCell className="text-right p-2">
                            <div className="relative flex items-center justify-end">
                              <Input 
                                type="number"
                                className="w-28 text-right h-8 pr-2 border-transparent bg-transparent hover:bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-1 transition-all"
                                value={assigned === 0 ? '' : assigned}
                                placeholder="0.00"
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setCategoryAssignment(currentMonth, category.id, val);
                                }}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={cn(
                              "text-sm font-medium",
                              activity < 0 ? "text-slate-600" : "text-slate-400"
                            )}>
                              {formatCurrency(activity)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline" className={cn(
                              "font-bold min-w-[80px] justify-end",
                              available < 0 ? "bg-red-50 text-red-600 border-red-200" : 
                              available > 0 ? "bg-green-50 text-green-600 border-green-200" : 
                              "bg-slate-50 text-slate-400 border-slate-200"
                            )}>
                              {formatCurrency(available)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
