# 📊 Budget-Wise Data Model Documentation

> Comprehensive reference for the Budget-Wise application data model

## Table of Contents
- [Overview](#overview)
- [Architecture](#architecture)
- [Entities](#entities)
  - [Budget](#budget)
  - [Account](#account)
  - [TrackingAccount](#trackingaccount)
  - [CategoryGroup](#categorygroup)
  - [Category](#category)
  - [Transaction](#transaction)
  - [MonthlyAssignments](#monthlyassignments)
  - [BudgetTemplate](#budgettemplate)
  - [Asset (Deprecated)](#asset-deprecated)
- [Relationships](#relationships)
- [Business Logic](#business-logic)
- [Type Definitions](#type-definitions)
- [Storage & Persistence](#storage--persistence)
- [Quick Reference](#quick-reference)

---

## Overview

Budget-Wise is a zero-based budgeting application that supports multiple budgets with flexible currency formatting. The data model is designed around budget-scoped entities that enable users to manage multiple independent budgets while maintaining global resources like tracking accounts and budget templates.

### Key Concepts

- **Zero-Based Budgeting**: Every dollar is assigned a job. The "Ready to Assign" amount must reach zero by allocating all available funds to categories.
- **Multi-Budget Support**: Users can create and manage multiple independent budgets, each with its own accounts, categories, and transactions.
- **Budget Scoping**: Most entities (accounts, categories, transactions) are scoped to a specific budget to ensure data isolation.
- **Flexible Currency**: Each budget can have its own currency, number format, and date format preferences.

---

## Architecture

### Current Implementation
- **State Management**: Zustand with localStorage persistence
- **Storage Key**: `'zerobased-storage'`
- **Storage Version**: 3 (incrementing resets all data for breaking changes)
- **Data Location**: Browser localStorage

### Future Implementation (Prepared)
- **Database**: PostgreSQL via Drizzle ORM
- **Schema Location**: `shared/schema.ts`
- **Storage Interface**: `IStorage` in `server/storage.ts`
- **Current Placeholder**: `MemStorage` (in-memory implementation)

---

## Entities

### Budget

**Purpose**: Top-level container representing a financial budget with its own currency settings and preferences.

**Scope**: Global

**Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | ✅ | Unique identifier (UUID) |
| `name` | `string` | ✅ | User-defined budget name |
| `createdAt` | `Date` | ✅ | Timestamp of budget creation |
| `currency` | `string` | ✅ | ISO currency code (e.g., "USD", "EUR", "TTD") |
| `currencyPlacement` | `'before' \| 'after'` | ✅ | Where to place currency symbol ($100 vs 100$) |
| `numberFormat` | `'1,234.56' \| '1.234,56' \| '1 234.56' \| '1 234,56'` | ✅ | Number formatting style |
| `dateFormat` | `'DD/MM/YYYY' \| 'MM/DD/YYYY' \| 'YYYY-MM-DD'` | ✅ | Date display format |

**Relationships**:
- Has many `Account` (budget-scoped)
- Has many `CategoryGroup` (budget-scoped)
- Has many `Transaction` (budget-scoped)
- Has nested `MonthlyAssignments` structure

**Key Behaviors**:
- At least one budget must exist (cannot delete the last budget)
- Deleting a budget cascades to delete all related accounts, categories, transactions, and assignments
- Current active budget tracked by `currentBudgetId` in app state

**TypeScript Interface**:
```typescript
interface Budget {
  id: string;
  name: string;
  createdAt: Date;
  currency: string;
  currencyPlacement: 'before' | 'after';
  numberFormat: '1,234.56' | '1.234,56' | '1 234.56' | '1 234,56';
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
}
```

---

### Account

**Purpose**: Represents a financial account (checking, savings, credit card, or loan) within a budget.

**Scope**: Budget-scoped (linked to specific budget)

**Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | ✅ | Unique identifier (UUID) |
| `budgetId` | `string` | ✅ | Parent budget reference |
| `name` | `string` | ✅ | User-defined account name |
| `type` | `AccountType` | ✅ | Account type: 'checking', 'savings', 'credit', or 'loan' |
| `balance` | `number` | ✅ | Current account balance (calculated from transactions) |
| `isActive` | `boolean` | ✅ | Whether account is active/visible |

**Relationships**:
- Belongs to one `Budget`
- Has many `Transaction`

**Key Behaviors**:
- **Balance Calculation**: Automatically updated based on transactions
- **Loan Auto-Close**: When a loan transaction brings the balance to ≥ 0, the account is automatically marked as `isActive: false`
- **Loan Re-activation**: Deleting transactions can reactivate a loan if the balance becomes negative again
- **Ready to Assign**: Only active accounts contribute to the "Ready to Assign" calculation

**TypeScript Interface**:
```typescript
type AccountType = 'checking' | 'savings' | 'credit' | 'loan';

interface Account {
  id: string;
  budgetId: string;
  name: string;
  type: AccountType;
  balance: number;
  isActive: boolean;
}
```

---

### TrackingAccount

**Purpose**: Tracks assets and liabilities outside of budget scope for net worth calculations (e.g., property, vehicles, investments).

**Scope**: Global (not budget-scoped)

**Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | ✅ | Unique identifier (UUID) |
| `name` | `string` | ✅ | User-defined account name |
| `type` | `TrackingAccountType` | ✅ | 'asset' or 'liability' |
| `balance` | `number` | ✅ | Current value/balance |
| `notes` | `string` | ❌ | Optional notes or description |

**Relationships**:
- Standalone entity (not linked to budgets)

**Key Behaviors**:
- **Net Worth Contribution**: Assets count positively, liabilities count negatively
- **No Transactions**: Unlike budget accounts, tracking accounts don't have transaction history
- **Manual Updates**: Balance is updated manually by the user

**TypeScript Interface**:
```typescript
type TrackingAccountType = 'asset' | 'liability';

interface TrackingAccount {
  id: string;
  name: string;
  type: TrackingAccountType;
  balance: number;
  notes?: string;
}
```

---

### CategoryGroup

**Purpose**: Organizational container for grouping related spending categories (e.g., "Living Expenses", "Transportation").

**Scope**: Budget-scoped

**Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | ✅ | Unique identifier (UUID) |
| `budgetId` | `string` | ✅ | Parent budget reference |
| `name` | `string` | ✅ | User-defined group name |

**Relationships**:
- Belongs to one `Budget`
- Has many `Category`

**Key Behaviors**:
- **Deletion Cascade**: Deleting a category group deletes all contained categories
- **Drag-and-Drop**: Categories can be moved between groups
- **Subtotals**: Groups display aggregated goal, assigned, activity, and available amounts

**TypeScript Interface**:
```typescript
interface CategoryGroup {
  id: string;
  budgetId: string;
  name: string;
}
```

---

### Category

**Purpose**: Represents a spending category with optional monthly goal/budget (e.g., "Groceries", "Gas").

**Scope**: Budget-scoped

**Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | ✅ | Unique identifier (UUID) |
| `budgetId` | `string` | ✅ | Parent budget reference |
| `groupId` | `string` | ✅ | Parent category group reference |
| `name` | `string` | ✅ | User-defined category name |
| `goal` | `number` | ❌ | Optional monthly budget target/goal |

**Relationships**:
- Belongs to one `Budget`
- Belongs to one `CategoryGroup`
- Has many `Transaction` (optional link)
- Has many `MonthlyAssignments` entries

**Key Behaviors**:
- **Monthly Goal**: Defines the target spending amount for this category
- **Available Calculation**: Available = Assigned + Activity (where Activity is sum of transactions)
- **Activity Tracking**: Sum of transaction amounts for the category in a given month
- **Funding Status**: Categories are marked as funded, partially funded, or unfunded based on assigned vs goal

**TypeScript Interface**:
```typescript
interface Category {
  id: string;
  budgetId: string;
  groupId: string;
  name: string;
  goal?: number;
}
```

---

### Transaction

**Purpose**: Represents a financial movement (income or expense) linked to an account and optionally to a category.

**Scope**: Budget-scoped

**Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | ✅ | Unique identifier (UUID) |
| `budgetId` | `string` | ✅ | Parent budget reference |
| `date` | `string` | ✅ | Transaction date (ISO 8601 format) |
| `payee` | `string` | ✅ | Who the transaction was with |
| `categoryId` | `string` | ❌ | Optional category link (null = income) |
| `accountId` | `string` | ✅ | Account where transaction occurred |
| `amount` | `number` | ✅ | Transaction amount (positive = inflow, negative = outflow) |
| `memo` | `string` | ❌ | Optional notes or description |
| `cleared` | `boolean` | ✅ | Whether transaction has cleared the bank |

**Relationships**:
- Belongs to one `Budget`
- Belongs to one `Account`
- Optionally belongs to one `Category`

**Key Behaviors**:
- **Income Detection**: Transactions without a `categoryId` are treated as income
- **Signed Amounts**: Positive amounts are inflows (income), negative amounts are outflows (expenses)
- **Balance Impact**: Automatically updates the linked account's balance
- **Activity Contribution**: Contributes to category activity when `categoryId` is set
- **Loan Impact**: Can trigger loan auto-close behavior when affecting loan accounts

**TypeScript Interface**:
```typescript
interface Transaction {
  id: string;
  budgetId: string;
  date: string;
  payee: string;
  categoryId?: string;
  accountId: string;
  amount: number;
  memo?: string;
  cleared: boolean;
}
```

---

### MonthlyAssignments

**Purpose**: Stores budget allocations (assignments) for each category in each month, forming the core of zero-based budgeting.

**Scope**: Budget-scoped (nested structure)

**Structure**:
```typescript
{
  [budgetId: string]: {
    [monthKey: string]: {        // Format: "YYYY-MM" (e.g., "2026-01")
      [categoryId: string]: number
    }
  }
}
```

**Example**:
```json
{
  "budget-123": {
    "2026-01": {
      "category-groceries": 500,
      "category-gas": 200,
      "category-rent": 1200
    },
    "2026-02": {
      "category-groceries": 550,
      "category-gas": 180
    }
  }
}
```

**Relationships**:
- Organized by `Budget` → Month → `Category`
- Each entry represents an assignment amount

**Key Behaviors**:
- **Zero-Based Goal**: Total assignments for a month should equal "Ready to Assign" amount
- **Month Isolation**: Each month is independent; assignments don't carry over
- **Dynamic Updates**: Changes immediately affect category "Available" calculations

**TypeScript Interface**:
```typescript
interface MonthlyAssignments {
  [budgetId: string]: {
    [monthKey: string]: {
      [categoryId: string]: number;
    };
  };
}
```

---

### BudgetTemplate

**Purpose**: Reusable template storing category goals that can be applied to any month for quick budget setup.

**Scope**: Global

**Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | ✅ | Unique identifier (UUID) |
| `name` | `string` | ✅ | User-defined template name |
| `isDefault` | `boolean` | ✅ | Whether this is the default template |
| `goals` | `{ [categoryId: string]: number }` | ✅ | Category ID → goal amount mapping |
| `createdAt` | `Date` | ✅ | Timestamp of template creation |

**Relationships**:
- Standalone entity
- References categories by ID in the `goals` object

**Key Behaviors**:
- **Apply to Month**: Can apply template to populate monthly assignments
- **Single Default**: Only one template can be marked as default at a time
- **Category Mapping**: Goals map to category IDs, not names (categories must exist)

**TypeScript Interface**:
```typescript
interface BudgetTemplate {
  id: string;
  name: string;
  isDefault: boolean;
  goals: {
    [categoryId: string]: number;
  };
  createdAt: Date;
}
```

---

### Asset (Deprecated)

**Purpose**: Legacy entity for tracking assets. Being replaced by `TrackingAccount`.

**Scope**: Global

**Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | ✅ | Unique identifier (UUID) |
| `name` | `string` | ✅ | User-defined asset name |
| `value` | `number` | ✅ | Current asset value |
| `type` | `'property' \| 'vehicle' \| 'investment' \| 'other'` | ✅ | Asset category |

**Status**: ⚠️ **Deprecated** - Use `TrackingAccount` instead

**Migration Path**: Convert assets to tracking accounts with `type: 'asset'`

**TypeScript Interface**:
```typescript
interface Asset {
  id: string;
  name: string;
  value: number;
  type: 'property' | 'vehicle' | 'investment' | 'other';
}
```

---

## Relationships

### Entity Relationship Diagram

```
Budget (1)
├── Accounts (many) [budget-scoped]
│   └── Transactions (many)
│       └── Category (0..1) [optional]
├── CategoryGroups (many) [budget-scoped]
│   └── Categories (many)
│       ├── Transactions (many) [via categoryId]
│       └── MonthlyAssignments entries
└── MonthlyAssignments (nested by month/category)

TrackingAccounts (many) [global, standalone]
BudgetTemplates (many) [global, standalone]
Assets (many) [global, legacy]
```

### Cardinality Reference

| Parent | Relationship | Child | Notes |
|--------|--------------|-------|-------|
| Budget | 1 : N | Account | Budget can have many accounts |
| Budget | 1 : N | CategoryGroup | Budget can have many groups |
| Budget | 1 : N | Transaction | Budget can have many transactions |
| CategoryGroup | 1 : N | Category | Group can have many categories |
| Account | 1 : N | Transaction | Account can have many transactions |
| Category | 1 : N | Transaction | Category can have many transactions (optional) |

---

## Business Logic

### Zero-Based Budgeting Formulas

#### Ready to Assign
Amount available to allocate to categories for the current month:
```
Ready to Assign = Σ(Active Account Balances) - Σ(Assigned for Current Month)
```

**Goal**: This should be $0 (all money assigned to categories)

#### Category Available
Amount available to spend in a category:
```
Category Available = Assigned + Activity
```

Where:
- **Assigned**: Amount allocated to the category for the month (from `MonthlyAssignments`)
- **Activity**: Sum of transaction amounts for the category in the month (negative for spending)

#### Category Activity
```
Activity = Σ(Transaction.amount WHERE categoryId = category AND month = currentMonth)
```

**Note**: Activity is typically negative for expense categories (spending)

#### Net Worth
```
Net Worth = Σ(Budget Account Balances) + Σ(TrackingAccount Balances) + Σ(Legacy Asset Values)
```

Where:
- Budget accounts include checking, savings, credit, loans
- TrackingAccount balances: positive for assets, negative for liabilities
- Legacy assets: deprecated but still counted

---

### Special Behaviors

#### Loan Auto-Close
When a transaction is created or modified on a loan account:
```
IF (Account.type === 'loan' AND newBalance >= 0) THEN
  Account.isActive = false
END IF
```

This automatically marks paid-off loans as inactive. Deleting transactions can reactivate the loan if balance becomes negative again.

#### Budget Deletion Cascade
When a budget is deleted:
1. Delete all accounts with matching `budgetId`
2. Delete all category groups with matching `budgetId`
3. Delete all categories with matching `budgetId`
4. Delete all transactions with matching `budgetId`
5. Delete all monthly assignments for the budget

**Protection**: Cannot delete the last remaining budget.

#### Transaction Categorization
```
IF (Transaction.categoryId === null OR Transaction.categoryId === undefined) THEN
  Transaction is treated as INCOME
ELSE
  Transaction is treated as EXPENSE (contributes to category activity)
END IF
```

#### Data Scoping Rules

**Budget-Scoped Entities** (filter by `currentBudgetId`):
- Account
- Category
- CategoryGroup
- Transaction
- MonthlyAssignments (nested by budgetId)

**Global Entities** (not filtered):
- Budget
- TrackingAccount
- BudgetTemplate
- Asset (legacy)

---

## Type Definitions

### Enums and Unions

```typescript
// Account types
type AccountType = 'checking' | 'savings' | 'credit' | 'loan';

// Tracking account types
type TrackingAccountType = 'asset' | 'liability';

// Currency placement
type CurrencyPlacement = 'before' | 'after';

// Number formats
type NumberFormat = '1,234.56' | '1.234,56' | '1 234.56' | '1 234,56';

// Date formats
type DateFormat = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';

// Asset types (deprecated)
type AssetType = 'property' | 'vehicle' | 'investment' | 'other';
```

### Format Examples

#### Number Formats
- `'1,234.56'` → en-US style: 1,234.56 (comma thousands, period decimal)
- `'1.234,56'` → de-DE style: 1.234,56 (period thousands, comma decimal)
- `'1 234.56'` → fr-FR style: 1 234.56 (space thousands, period decimal)
- `'1 234,56'` → fr-CA style: 1 234,56 (space thousands, comma decimal)

#### Currency Placement
- `'before'` → $100.00
- `'after'` → 100.00 TTD

---

## Storage & Persistence

### Current Implementation: Zustand + localStorage

**Storage Key**: `'zerobased-storage'`

**Storage Version**: `3`
- Version tracking enables data migrations
- Incrementing version resets all data (fresh start)

**Persisted State**:
```typescript
{
  budgets: Budget[];
  currentBudgetId: string;
  accounts: Account[];
  trackingAccounts: TrackingAccount[];
  assets: Asset[];
  categoryGroups: CategoryGroup[];
  categories: Category[];
  transactions: Transaction[];
  monthlyAssignments: MonthlyAssignments;
  budgetTemplates: BudgetTemplate[];
  currentMonth: string;
}
```

### Future Implementation: PostgreSQL

**Schema Location**: `shared/schema.ts`

**ORM**: Drizzle ORM with PostgreSQL dialect

**Storage Interface**: `server/storage.ts`
```typescript
interface IStorage {
  // Methods for CRUD operations on each entity
}
```

**Current Placeholder**: `MemStorage` (in-memory implementation)

---

## Quick Reference

### Entity Summary Table

| Entity | Scope | Primary Key | Key Fields | Purpose |
|--------|-------|-------------|------------|---------|
| **Budget** | Global | `id` | `name`, `currency`, `currencyPlacement` | Top-level budget container with currency settings |
| **Account** | Budget | `id`, `budgetId` | `type`, `balance`, `isActive` | Financial accounts (checking, savings, credit, loan) |
| **TrackingAccount** | Global | `id` | `type`, `balance` | Net worth tracking (assets/liabilities) |
| **CategoryGroup** | Budget | `id`, `budgetId` | `name` | Organizational container for categories |
| **Category** | Budget | `id`, `budgetId` | `name`, `goal`, `groupId` | Spending categories with optional monthly goals |
| **Transaction** | Budget | `id`, `budgetId` | `date`, `amount`, `categoryId`, `accountId` | Financial movements (income/expenses) |
| **MonthlyAssignments** | Budget | nested structure | `[budgetId][month][categoryId]` | Budget allocations per category per month |
| **BudgetTemplate** | Global | `id` | `name`, `goals`, `isDefault` | Reusable budget allocation templates |
| **Asset** | Global | `id` | `value`, `type` | ⚠️ **Deprecated** - Legacy asset tracking |

### Common Operations

#### Get Category Available Amount
```typescript
const assigned = monthlyAssignments[budgetId][currentMonth][categoryId] || 0;
const activity = transactions
  .filter(t => t.budgetId === budgetId &&
               t.categoryId === categoryId &&
               t.date.startsWith(currentMonth))
  .reduce((sum, t) => sum + t.amount, 0);
const available = assigned + activity;
```

#### Get Ready to Assign
```typescript
const totalBalance = accounts
  .filter(a => a.budgetId === currentBudgetId && a.isActive)
  .reduce((sum, a) => sum + a.balance, 0);

const totalAssigned = Object.values(monthlyAssignments[currentBudgetId]?.[currentMonth] || {})
  .reduce((sum, amount) => sum + amount, 0);

const readyToAssign = totalBalance - totalAssigned;
```

#### Get Net Worth
```typescript
const budgetAccountsTotal = accounts.reduce((sum, a) => sum + a.balance, 0);
const trackingAccountsTotal = trackingAccounts.reduce((sum, ta) =>
  ta.type === 'asset' ? sum + ta.balance : sum - ta.balance, 0);
const assetsTotal = assets.reduce((sum, a) => sum + a.value, 0);

const netWorth = budgetAccountsTotal + trackingAccountsTotal + assetsTotal;
```

---

## Migration Notes

### Deprecations
- **Asset Entity**: Being replaced by `TrackingAccount` for better flexibility
- Migration path: Convert each `Asset` to a `TrackingAccount` with `type: 'asset'`

### Storage Version Management
When making breaking changes to the data model:
1. Increment `STORAGE_VERSION` constant in `store.ts`
2. All localStorage data will be reset on next app load
3. Document the change in version history

### Database Migration Path
The application is prepared for PostgreSQL migration:
1. Schema defined in `shared/schema.ts`
2. Storage interface in `server/storage.ts`
3. Current `MemStorage` can be swapped with database implementation
4. Zustand state can be populated from API calls instead of localStorage

---

## Additional Resources

- **Source Code**: `client/src/lib/store.ts` - Complete TypeScript interfaces and Zustand state
- **Database Schema**: `shared/schema.ts` - Drizzle ORM schema definitions
- **Storage Interface**: `server/storage.ts` - IStorage abstraction layer

---

*Last Updated: January 2026*
