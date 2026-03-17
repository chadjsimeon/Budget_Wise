import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Toaster } from '@/components/ui/toaster';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';

export function AppShell({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      <Toaster />
    </div>
  );
}
