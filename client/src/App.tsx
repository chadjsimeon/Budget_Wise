import { Switch, Route, Redirect } from "wouter";
import { AppShell } from "@/components/layout/AppShell";
import BudgetPage from "@/pages/Budget";
import AccountsPage from "@/pages/Accounts";
import ReportsPage from "@/pages/Reports";
import NotFound from "@/pages/not-found";

function App() {
  return (
    <AppShell>
      <Switch>
        <Route path="/" component={BudgetPage} />
        <Route path="/accounts/:id" component={AccountsPage} />
        <Route path="/transactions" component={AccountsPage} />
        <Route path="/reports" component={ReportsPage} />
        {/* Fallback to 404 */}
        <Route component={NotFound} />
      </Switch>
    </AppShell>
  );
}

export default App;
