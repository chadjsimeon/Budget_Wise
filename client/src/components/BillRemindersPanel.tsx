import { useState } from 'react';
import { useStore, type BillReminder } from '@/lib/store';
import { useCurrencyFormatter } from '@/lib/currency';
import { format } from 'date-fns';
import { ChevronDown, ChevronUp, Plus, Check, Pencil, Trash2, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { CreateBillReminderDialog } from '@/components/modals/CreateBillReminderDialog';
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
import type { BillStatus, UpcomingBill } from '@/lib/billUtils';

const statusStyles: Record<BillStatus, string> = {
  'overdue': 'bg-red-50 border-red-200 text-red-800',
  'due-today': 'bg-amber-50 border-amber-200 text-amber-800',
  'upcoming': 'bg-yellow-50 border-yellow-200 text-yellow-800',
  'future': 'bg-slate-50 border-slate-200 text-slate-600',
};

const statusLabels: Record<BillStatus, string> = {
  'overdue': 'Overdue',
  'due-today': 'Due Today',
  'upcoming': 'Upcoming',
  'future': 'Future',
};

export function BillRemindersPanel() {
  const { getUpcomingBills, markBillPaid, deleteBillReminder } = useStore();
  const formatCurrency = useCurrencyFormatter();
  const { toast } = useToast();

  const upcomingBills = getUpcomingBills(14);
  const urgentCount = upcomingBills.filter(b => b.status === 'overdue' || b.status === 'due-today').length;

  const [isExpanded, setIsExpanded] = useState(urgentCount > 0);
  const [editingReminder, setEditingReminder] = useState<BillReminder | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deletingBill, setDeletingBill] = useState<UpcomingBill | null>(null);
  const [confirmPayBill, setConfirmPayBill] = useState<UpcomingBill | null>(null);

  const handleMarkPaid = (bill: UpcomingBill) => {
    if (bill.reminder.autoCreateTransaction && bill.reminder.accountId) {
      markBillPaid(bill.reminder.id);
      toast({ title: "Bill marked as paid", description: `"${bill.reminder.name}" - transaction created` });
    } else {
      setConfirmPayBill(bill);
    }
  };

  const confirmMarkPaid = () => {
    if (confirmPayBill) {
      markBillPaid(confirmPayBill.reminder.id);
      toast({ title: "Bill marked as paid", description: `"${confirmPayBill.reminder.name}" marked as paid` });
      setConfirmPayBill(null);
    }
  };

  const handleEdit = (reminder: BillReminder) => {
    setEditingReminder(reminder);
    setIsEditOpen(true);
  };

  const handleDelete = (bill: UpcomingBill) => {
    setDeletingBill(bill);
  };

  const confirmDelete = () => {
    if (deletingBill) {
      deleteBillReminder(deletingBill.reminder.id);
      toast({ title: "Bill deleted", description: `"${deletingBill.reminder.name}" has been removed` });
      setDeletingBill(null);
    }
  };

  if (upcomingBills.length === 0 && !isExpanded) {
    return (
      <div className="border-b border-slate-200">
        <div className="px-4 md:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Bell className="w-4 h-4" />
            <span>No upcoming bills</span>
          </div>
          <CreateBillReminderDialog
            trigger={
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                <Plus className="w-3 h-3" /> Add Bill
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="border-b border-slate-200">
        {/* Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-4 md:px-6 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-700">Bill Reminders</span>
            {urgentCount > 0 && (
              <Badge variant="destructive" className="text-xs px-1.5 py-0">
                {urgentCount}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">{upcomingBills.length} bill{upcomingBills.length !== 1 ? 's' : ''}</span>
            {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </div>
        </button>

        {/* Body */}
        {isExpanded && (
          <div className="px-4 md:px-6 pb-3 space-y-2">
            {upcomingBills.map((bill) => (
              <div
                key={bill.reminder.id}
                className={cn(
                  "flex items-center justify-between px-3 py-2 rounded-lg border text-sm",
                  statusStyles[bill.status]
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{bill.reminder.name}</span>
                    <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">
                      {statusLabels[bill.status]}
                    </Badge>
                  </div>
                  <div className="text-xs opacity-75 mt-0.5">
                    {format(bill.nextDueDate, 'MMM d, yyyy')}
                    {bill.daysUntilDue > 0 && ` (in ${bill.daysUntilDue} day${bill.daysUntilDue !== 1 ? 's' : ''})`}
                    {bill.daysUntilDue < 0 && ` (${Math.abs(bill.daysUntilDue)} day${Math.abs(bill.daysUntilDue) !== 1 ? 's' : ''} ago)`}
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-2 shrink-0">
                  <span className="font-semibold">{formatCurrency(bill.reminder.amount)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => { e.stopPropagation(); handleMarkPaid(bill); }}
                    title="Mark as paid"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => { e.stopPropagation(); handleEdit(bill.reminder); }}
                    title="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => { e.stopPropagation(); handleDelete(bill); }}
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}

            <CreateBillReminderDialog
              trigger={
                <Button variant="outline" size="sm" className="w-full gap-1 text-xs border-dashed mt-1">
                  <Plus className="w-3 h-3" /> Add Bill
                </Button>
              }
            />
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <CreateBillReminderDialog
        reminder={editingReminder || undefined}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        onSuccess={() => setEditingReminder(null)}
      />

      {/* Confirm Pay Dialog */}
      <AlertDialog open={!!confirmPayBill} onOpenChange={(open) => !open && setConfirmPayBill(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark Bill as Paid?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmPayBill && (
                <>
                  Mark "{confirmPayBill.reminder.name}" ({formatCurrency(confirmPayBill.reminder.amount)}) as paid?
                  {!confirmPayBill.reminder.accountId && " No transaction will be created since no payment account is linked."}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmMarkPaid}>Mark Paid</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingBill} onOpenChange={(open) => !open && setDeletingBill(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Bill Reminder?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingBill && <>This will permanently delete the "{deletingBill.reminder.name}" bill reminder.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
