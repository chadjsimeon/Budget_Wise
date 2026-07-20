# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WantNot is a zero-based budgeting application built with React, Express, and TypeScript. It is a **local-first PWA with a backing database**: the client holds state in Zustand (persisted to localStorage) for instant, offline-capable reads/writes, and every mutation is synced to an Express + Drizzle/PostgreSQL backend with Passport session auth. On load the client hydrates from the server (`GET /api/budget-data`), so data is per-user and shared across devices.

## Common Commands

### Development
- `npm run dev` - Start development server (runs Express backend with Vite dev server for client)
- `npm run dev:client` - Run Vite dev server only (client-only, port 5001)

### Build & Production
- `npm run build` - Build both client and server for production (uses script/build.ts)
- `npm start` - Start production server (serves built assets from dist/)

### Database
- `npm run db:generate` - Generate a new migration from `shared/schema.ts` changes into `migrations/`
- `npm run db:migrate` - Apply pending migrations to the local database
- Migrations are also applied automatically at server startup (`server/migrate.ts`). **Never run `drizzle-kit push` against production** — schema changes reach prod only as reviewed migration files, committed and applied by the boot-time migrator.

### Type Checking
- `npm run check` - Run TypeScript type checking across the codebase

### Testing
- `npm test` - Run all tests with Vitest
- `npm test <filename>` - Run specific test file (e.g., `npm test Budget.spec.tsx`)
- `npm test -- --watch` - Run tests in watch mode
- `npm test -- --coverage` - Run tests with coverage report

## Architecture

### Project Structure

```
WantNot/
├── client/           # React frontend
│   └── src/
│       ├── components/
│       │   ├── ui/          # Shadcn/ui components (Radix UI primitives)
│       │   ├── layout/      # AppShell, Sidebar
│       │   └── modals/      # Dialog components for creating entities
│       ├── pages/           # Route pages (Budget, Accounts, Reports, Assets)
│       ├── hooks/           # Custom React hooks
│       └── lib/
│           ├── store.ts     # Zustand state management (main app state)
│           └── queryClient.ts
├── server/           # Express backend
│   ├── index.ts      # Server entry point
│   ├── routes.ts     # API route registration (currently minimal)
│   ├── storage.ts    # IStorage interface and DbStorage (Drizzle/PostgreSQL) implementation
│   ├── vite.ts       # Vite dev server integration
│   └── static.ts     # Static file serving for production
├── shared/           # Code shared between client and server
│   └── schema.ts     # Drizzle ORM schema definitions and Zod validation
└── script/           # Build scripts
```

### State Management Architecture

**Local-first with backend sync**: Zustand (persisted to localStorage via the `zerobased-storage` key) is the immediate source of truth for the UI. Each mutating store action also calls `syncToServer(...)` (`client/src/lib/store.ts`) to push the change to the API. When offline or on failure, ops are queued FIFO in `client/src/lib/syncQueue.ts` (persisted to `bw-sync-queue`) and replayed in order on reconnect. On startup `BudgetDataProvider` fetches `GET /api/budget-data` and hydrates the store, so the server is the source of truth across sessions/devices.

**Backend**: fully active — Express + Passport session auth (`server/auth.ts`, bcrypt passwords in `server/password.ts`), API routes in `server/routes.ts`, data access via `DbStorage` in `server/storage.ts` (Drizzle over PostgreSQL, pool in `server/db.ts`). All routes are scoped to the authenticated user; budget-scoped routes go through `verifyBudgetOwnership`.

**Critical**: When adding a mutating store action, add the matching `syncToServer` call and a server route that validates ownership. Update methods in `server/storage.ts` whitelist their columns — add new editable fields to the relevant `*_UPDATE_COLS` list.

### Data Model

The application supports **multiple budgets** with budget-scoped data:

- **Budget**: Top-level container with currency and formatting settings
  - Currency (e.g., "TTD"), placement (before/after), number format, date format
  - `currentBudgetId` tracks the active budget

- **Accounts** (budget-scoped): Financial accounts (checking, savings, credit, loan)
  - Auto-close feature: Loans automatically mark as inactive when balance reaches ≥ 0
  - Balance calculated from transactions

- **Tracking Accounts** (global): Assets and liabilities tracked outside budget scope
  - Used for net worth calculations (property, vehicles, investments)

- **Categories** (budget-scoped): Organized into CategoryGroups
  - Each category has an optional goal (monthly target)

- **Transactions** (budget-scoped): Financial movements
  - Linked to accounts and optionally to categories
  - Transactions without categoryId are treated as income

- **Monthly Assignments**: Budget allocations per category per month
  - Structure: `monthlyAssignments[budgetId][monthKey][categoryId] = amount`
  - Month keys format: "YYYY-MM"

- **Budget Templates**: Reusable budget allocation templates
  - Store category goals that can be applied to any month

### Key Behavioral Features

1. **Zero-based Budgeting Logic**:
   - "Ready to Assign" = Total active account balance - Total assigned for month
   - Category Available = Assigned amount + Activity (transactions)
   - Activity is sum of transactions for a category in a given month (negative for spending)

2. **Multi-Budget Support**:
   - Filter all operations by `currentBudgetId`
   - Switching budgets changes the active context
   - Deleting a budget cascades to all related data

3. **Loan Auto-Close**:
   - When transaction brings loan balance to ≥ 0, account is marked `isActive: false`
   - Deleting transactions can reactivate loans if balance goes negative again

4. **Net Worth Calculation**:
   - Sums budget accounts + tracking accounts (asset positive, liability negative) + legacy assets

### Component Patterns

- **UI Components**: Located in `client/src/components/ui/`, based on shadcn/ui (Radix UI + Tailwind CSS)
- **Modal Dialogs**: Create entity dialogs in `client/src/components/modals/`
  - Use controlled `open` and `onOpenChange` props
  - Integrate with Zustand store actions

- **Routing**: Uses Wouter (`wouter` library) in `App.tsx`
  - Routes: `/` (Budget), `/accounts/:id`, `/transactions`, `/reports`, `/assets`

- **Keyboard Shortcuts** (in App.tsx):
  - `T` - Navigate to transactions and trigger new transaction dialog
  - `A` - Open create account dialog

### Styling

- **Tailwind CSS v4** with `@tailwindcss/vite` plugin
- Path aliases configured:
  - `@/` → `client/src/`
  - `@shared/` → `shared/`
  - `@assets/` → `attached_assets/`

### Development Server Configuration

- Development: Express (with Vite middleware) serves on port 5050; `dev:client` runs Vite standalone on 5001
- Production: Express serves static built files from `dist/public/`
- Always use port from `process.env.PORT` (defaults to 5050)

### Database (Active)

- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema**: `shared/schema.ts` — users, budgets, accounts, tracking accounts, category groups, categories, transactions, monthly assignments, budget templates, bill reminders
- **Config**: `drizzle.config.ts` points to `./migrations` and requires `DATABASE_URL` env var
- **Migrations**: versioned SQL in `migrations/`, generated with `npm run db:generate` and applied at server startup via `server/migrate.ts` (`drizzle-orm` `migrate()`). The `0000_baseline.sql` is hand-edited to be idempotent so it adopts databases originally created with `drizzle-kit push`.
- **Storage**: `server/storage.ts` provides the `IStorage` interface and its live `DbStorage` implementation
- **Env vars**: `DATABASE_URL`, `SESSION_SECRET` (required in production), `RESEND_API_KEY` + `EMAIL_FROM` (password reset email), `APP_URL` (reset link base)

### TypeScript Configuration

- `tsconfig.json` includes all three directories: `client/src`, `shared`, `server`
- Module resolution: "bundler"
- Path aliases match Vite configuration
- Strict mode enabled

### Storage Version Management

The Zustand store uses a `STORAGE_VERSION` constant (currently 2) to manage data migrations. Incrementing this version will reset all localStorage data to initial state. This is useful when making breaking changes to the data model.

## Testing

### Testing Stack

- **Test Runner**: Vitest v4.0.16 with jsdom environment
- **Testing Library**: @testing-library/react v16.3.1
- **User Interactions**: @testing-library/user-event
- **Custom Matchers**: @testing-library/jest-dom (provides `toBeInTheDocument()`, `toHaveTextContent()`, etc.)

### Test Configuration

**Vitest Config** (`vite.config.ts`):
```typescript
test: {
  globals: true,              // Auto-import describe, test, expect
  environment: "jsdom",        // DOM simulation for React components
  setupFiles: ["./client/src/test/setup.ts"],
  css: false,                  // Skip CSS processing in tests
}
```

**Test Setup** (`client/src/test/setup.ts`):
- Imports jest-dom matchers for vitest
- Clears localStorage before each test (critical for Zustand persistence)

### Writing Tests

#### File Naming and Location
- Test files use `.spec.tsx` or `.spec.ts` extension
- Place tests next to the components they test (e.g., `Budget.spec.tsx` next to `Budget.tsx`)
- Shared test utilities in `client/src/test/`

#### BDD Format (Preferred)
Use Given/When/Then comments to structure tests:

```typescript
test('opens modal when Add Category Group button is clicked', async () => {
  // Given: The component renders
  const user = userEvent.setup();
  render(<BudgetPage />);

  // When: The Add Category Group button is clicked
  const addButton = screen.getByRole('button', { name: /add category group/i });
  await user.click(addButton);

  // Then: The modal opens with the correct info
  const dialog = await screen.findByRole('dialog');
  expect(dialog).toBeInTheDocument();
});
```

#### Testing Patterns

**1. Component Rendering**
```typescript
import { render, screen } from '@testing-library/react';
import MyComponent from './MyComponent';

test('renders component', () => {
  render(<MyComponent />);
  expect(screen.getByText(/expected text/i)).toBeInTheDocument();
});
```

**2. User Interactions**
```typescript
import userEvent from '@testing-library/user-event';

test('handles user interaction', async () => {
  const user = userEvent.setup();
  render(<MyComponent />);

  const button = screen.getByRole('button', { name: /click me/i });
  await user.click(button);

  expect(screen.getByText(/success/i)).toBeInTheDocument();
});
```

**3. Async Elements (Radix UI Dialogs, Portals)**
Use `findBy*` queries (async) for elements that appear after user interaction:

```typescript
// Dialog renders via portal asynchronously
const dialog = await screen.findByRole('dialog');
expect(dialog).toBeInTheDocument();
```

**4. Query Priorities** (from Testing Library best practices)
1. `getByRole` - Accessible queries (preferred)
2. `getByLabelText` - Forms and labels
3. `getByPlaceholderText` - Input placeholders
4. `getByText` - Non-interactive text
5. `getByTestId` - Last resort

### Testing Zustand Store

**Strategy**: Use the REAL store with localStorage clearing

**Why**:
- Zustand with persist middleware is tightly coupled to localStorage
- Mocking the entire store is complex and fragile
- Real store provides more realistic testing
- `localStorage.clear()` in `beforeEach` ensures test isolation

**Store State**: The store auto-initializes with default state:
- `currentBudgetId: 'budget1'`
- `budgets: [{ id: 'budget1', name: 'My Budget', ... }]`
- `categoryGroups: []`, `categories: []`, `transactions: []`
- `currentMonth: format(new Date(), 'yyyy-MM')`

**Pre-populating State** (if needed):
```typescript
import { useStore } from '@/lib/store';

beforeEach(() => {
  const { addCategoryGroup } = useStore.getState();
  addCategoryGroup({ name: 'Test Group' });
});
```

### Key Testing Considerations

1. **localStorage Persistence**: Always cleared in `beforeEach` hook to prevent test pollution

2. **Radix UI Dialogs**:
   - Render asynchronously via portals
   - Use `await screen.findByRole('dialog')` instead of `getByRole`
   - Dialog content renders outside the component tree

3. **Date Dependencies**:
   - Components use current date for `currentMonth`
   - Tests should accept dynamic dates or mock date-fns if specific dates are required

4. **Toast Notifications**:
   - Use module-level state, don't need special setup
   - Can verify toast content in DOM after actions

5. **Helper Functions**:
   - Extract repeated assertions into helper functions for readability
   - Example: `verifyAddCategoryGroupModal()` function for modal assertions

### Common Test Scenarios

**Testing Modal Dialogs**:
```typescript
test('opens and verifies modal content', async () => {
  const user = userEvent.setup();
  render(<Component />);

  // Open modal
  await user.click(screen.getByRole('button', { name: /open modal/i }));

  // Wait for portal render
  const dialog = await screen.findByRole('dialog');

  // Verify content
  expect(screen.getByRole('heading', { name: /modal title/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
});
```

**Testing Form Inputs**:
```typescript
test('handles form submission', async () => {
  const user = userEvent.setup();
  render(<FormComponent />);

  const input = screen.getByPlaceholderText(/enter name/i);
  await user.type(input, 'Test Name');

  expect(input).toHaveValue('Test Name');

  await user.click(screen.getByRole('button', { name: /submit/i }));

  // Verify submission result
  expect(screen.getByText(/success/i)).toBeInTheDocument();
});
```

**Testing Store Integration**:
```typescript
test('updates store on user action', async () => {
  const user = userEvent.setup();
  render(<Component />);

  await user.click(screen.getByRole('button', { name: /add item/i }));

  const { items } = useStore.getState();
  expect(items).toHaveLength(1);
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test Budget.spec.tsx

# Watch mode (re-run on file changes)
npm test -- --watch

# Run with coverage
npm test -- --coverage

# Run tests matching pattern
npm test -- --grep "Category Group"
```

### Troubleshooting

**Issue**: `Cannot find package 'jsdom'`
- **Solution**: Install jsdom: `npm install --save-dev jsdom`

**Issue**: `toBeInTheDocument is not a function`
- **Solution**: Ensure `@testing-library/jest-dom/vitest` is imported in setup file

**Issue**: Dialog/Modal not found
- **Solution**: Use async `findByRole` instead of sync `getByRole` for portal-rendered elements

**Issue**: Tests fail due to previous test state
- **Solution**: Verify `localStorage.clear()` is in `beforeEach` hook in setup file
