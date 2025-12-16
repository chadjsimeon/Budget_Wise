# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Budget-Wise is a zero-based budgeting application built with React, Express, and TypeScript. The application uses a full-stack architecture with client-side state management via Zustand and a prepared backend infrastructure for future API integration.

## Common Commands

### Development
- `npm run dev` - Start development server (runs Express backend with Vite dev server for client)
- `npm run dev:client` - Run Vite dev server only (client-only, port 5000)

### Build & Production
- `npm run build` - Build both client and server for production (uses script/build.ts)
- `npm start` - Start production server (serves built assets from dist/)

### Database
- `npm run db:push` - Push schema changes to PostgreSQL database using Drizzle

### Type Checking
- `npm run check` - Run TypeScript type checking across the codebase

## Architecture

### Project Structure

```
Budget-Wise/
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
│   ├── storage.ts    # Storage interface (IStorage) and MemStorage implementation
│   ├── vite.ts       # Vite dev server integration
│   └── static.ts     # Static file serving for production
├── shared/           # Code shared between client and server
│   └── schema.ts     # Drizzle ORM schema definitions and Zod validation
└── script/           # Build scripts
```

### State Management Architecture

**Current State**: The application uses **Zustand with local persistence** for all state management. All data (budgets, accounts, transactions, categories) is stored in browser localStorage via the `zerobased-storage` key.

**Future Architecture**: The backend infrastructure is prepared for database integration:
- Database schema defined in `shared/schema.ts` using Drizzle ORM
- Storage interface (`IStorage`) defined in `server/storage.ts` with MemStorage implementation
- `server/routes.ts` is the designated location for API endpoints (currently empty)

**Critical**: When adding features, continue using Zustand store patterns. The migration to backend API calls should be done separately.

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

- Development: Vite dev server runs on port 5000, proxied through Express
- Production: Express serves static built files from `dist/public/`
- Always use port from `process.env.PORT` (defaults to 5000)
- The application is configured for Replit deployment (optional Replit plugins in vite.config.ts)

### Database (Prepared but Not Active)

- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema**: `shared/schema.ts` (currently only has `users` table)
- **Config**: `drizzle.config.ts` points to `./migrations` and requires `DATABASE_URL` env var
- **Storage Interface**: `server/storage.ts` provides `IStorage` abstraction
  - Current implementation: `MemStorage` (in-memory)
  - Designed to be swapped with database implementation

### TypeScript Configuration

- `tsconfig.json` includes all three directories: `client/src`, `shared`, `server`
- Module resolution: "bundler"
- Path aliases match Vite configuration
- Strict mode enabled

### Storage Version Management

The Zustand store uses a `STORAGE_VERSION` constant (currently 2) to manage data migrations. Incrementing this version will reset all localStorage data to initial state. This is useful when making breaking changes to the data model.
