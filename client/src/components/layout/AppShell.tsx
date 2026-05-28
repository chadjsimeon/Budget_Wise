import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Toaster } from '@/components/ui/toaster';
import { useIsMobile } from '@/hooks/use-mobile';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Menu } from 'lucide-react';

export function AppShell({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isOnline, pendingSync } = useOnlineStatus();

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden font-sans">
      {/* Desktop sidebar */}
      {!isMobile && <Sidebar />}

      {/* Mobile hamburger + sheet */}
      {isMobile && (
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="fixed top-4 left-4 z-50 md:hidden bg-white shadow-md"
            >
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <Sidebar
              className="h-full border-r-0"
              onNavigate={() => setSidebarOpen(false)}
            />
          </SheetContent>
        </Sheet>
      )}

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white dark:bg-neutral-900">
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>

      {/* Connectivity / sync indicator */}
      {(!isOnline || pendingSync > 0) && (
        <div
          className={cn(
            "fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-3 py-1.5 rounded-full shadow-lg text-xs font-medium flex items-center gap-2",
            isOnline
              ? "bg-amber-100 text-amber-800 border border-amber-200"
              : "bg-slate-800 text-white"
          )}
        >
          {isOnline ? (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Syncing {pendingSync} change{pendingSync !== 1 ? 's' : ''}…
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-red-400" />
              Offline{pendingSync > 0 ? ` · ${pendingSync} pending` : ''}
            </>
          )}
        </div>
      )}

      <Toaster />
    </div>
  );
}
