import { Switch, Route, Redirect, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import BudgetPage from "@/pages/Budget";
import AccountsPage from "@/pages/Accounts";
import ReportsPage from "@/pages/Reports";
import AssetsPage from "@/pages/Assets";
import NotFound from "@/pages/not-found";
import { CreateAccountDialog } from "@/components/modals/CreateAccountDialog";

function App() {
  const [location, setLocation] = useLocation();
  const [showAccountDialog, setShowAccountDialog] = useState(false);
  const [showTransactionShortcut, setShowTransactionShortcut] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if not typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Check for keyboard shortcuts
      if (e.key.toLowerCase() === 't') {
        e.preventDefault();
        setShowTransactionShortcut(true);
        // Navigate to transactions page and trigger the dialog
        if (!location.startsWith('/accounts/') && location !== '/transactions') {
          setLocation('/transactions');
        }
      } else if (e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setShowAccountDialog(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [location, setLocation]);

  return (
    <AppShell>
      <Switch>
        <Route path="/" component={BudgetPage} />
        <Route path="/accounts/:id">
          {(params) => <AccountsPage triggerNewTransaction={showTransactionShortcut} onTransactionTriggered={() => setShowTransactionShortcut(false)} />}
        </Route>
        <Route path="/transactions">
          <AccountsPage triggerNewTransaction={showTransactionShortcut} onTransactionTriggered={() => setShowTransactionShortcut(false)} />
        </Route>
        <Route path="/reports" component={ReportsPage} />
        <Route path="/assets" component={AssetsPage} />
        {/* Fallback to 404 */}
        <Route component={NotFound} />
      </Switch>

      {/* Global Account Dialog (triggered by 'A' key) */}
      <CreateAccountDialog
        open={showAccountDialog}
        onOpenChange={setShowAccountDialog}
      />
    </AppShell>
  );
}

export default App;
