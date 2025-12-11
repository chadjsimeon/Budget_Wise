import { Sidebar } from './Sidebar';
import { Toaster } from '@/components/ui/toaster';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full bg-background overflow-hidden font-sans">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white dark:bg-neutral-900">
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
      <Toaster />
    </div>
  );
}
