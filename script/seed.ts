import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { randomUUID } from "crypto";
import { createHash } from "crypto";
import {
  users,
  budgets,
  accounts,
  trackingAccounts,
  categoryGroups,
  categories,
  transactions,
  monthlyAssignments,
} from "../shared/schema.js";

// Simple password hashing (in production, use bcrypt or argon2)
function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

// Generate UUID
function uuid(): string {
  return randomUUID();
}

// Date helpers
function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatMonth(date: Date): string {
  return date.toISOString().slice(0, 7);
}

// Random amount with variance
function randomAmount(base: number, variance: number = 0.1): number {
  const factor = 1 + (Math.random() * 2 - 1) * variance;
  return Math.round(base * factor * 100) / 100;
}

// Get random day in month
function randomDayInMonth(year: number, month: number): Date {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const day = Math.floor(Math.random() * daysInMonth) + 1;
  return new Date(year, month, day);
}

// Main seed function
async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL environment variable is required");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  const db = drizzle(client);

  console.log("🌱 Starting database seed...\n");

  // Clear existing data (in reverse order of dependencies)
  console.log("Clearing existing data...");
  await db.delete(monthlyAssignments);
  await db.delete(transactions);
  await db.delete(categories);
  await db.delete(categoryGroups);
  await db.delete(accounts);
  await db.delete(trackingAccounts);
  await db.delete(budgets);
  await db.delete(users);
  console.log("✓ Data cleared\n");

  // ============================================================================
  // USER 1: Marcus Johnson (Lower Income ~$2,400/mo)
  // ============================================================================
  console.log("Creating Marcus Johnson (Lower Income)...");

  const marcusId = uuid();
  await db.insert(users).values({
    id: marcusId,
    username: "marcus.johnson",
    password: hashPassword("marcus2024!"),
  });

  const marcusBudgetId = uuid();
  await db.insert(budgets).values({
    id: marcusBudgetId,
    userId: marcusId,
    name: "Marcus Budget",
    currency: "USD",
    currencyPlacement: "before",
    numberFormat: "1,234.56",
    dateFormat: "MM/DD/YYYY",
  });

  // Marcus's tracking accounts
  await db.insert(trackingAccounts).values({
    id: uuid(),
    userId: marcusId,
    name: "2012 Honda Civic",
    type: "asset",
    balance: "6000.00",
    notes: "Personal vehicle, 140k miles",
  });

  // Marcus's financial accounts
  const marcusCheckingId = uuid();
  const marcusSavingsId = uuid();
  const marcusCreditId = uuid();

  await db.insert(accounts).values([
    {
      id: marcusCheckingId,
      budgetId: marcusBudgetId,
      name: "Chase Checking",
      type: "checking",
      balance: "1250.00",
      isActive: true,
    },
    {
      id: marcusSavingsId,
      budgetId: marcusBudgetId,
      name: "Chase Savings",
      type: "savings",
      balance: "850.00",
      isActive: true,
    },
    {
      id: marcusCreditId,
      budgetId: marcusBudgetId,
      name: "Capital One Card",
      type: "credit",
      balance: "-420.00",
      isActive: true,
    },
  ]);

  // Marcus's category groups and categories
  const marcusHousingGroupId = uuid();
  const marcusTransportGroupId = uuid();
  const marcusFoodGroupId = uuid();
  const marcusBillsGroupId = uuid();
  const marcusSavingsGroupId = uuid();

  await db.insert(categoryGroups).values([
    { id: marcusHousingGroupId, budgetId: marcusBudgetId, name: "Housing" },
    { id: marcusTransportGroupId, budgetId: marcusBudgetId, name: "Transportation" },
    { id: marcusFoodGroupId, budgetId: marcusBudgetId, name: "Food" },
    { id: marcusBillsGroupId, budgetId: marcusBudgetId, name: "Bills & Utilities" },
    { id: marcusSavingsGroupId, budgetId: marcusBudgetId, name: "Savings" },
  ]);

  const marcusCategories: Record<string, { id: string; goal: number }> = {};

  const marcusCategoryData = [
    { group: marcusHousingGroupId, name: "Rent", goal: 950 },
    { group: marcusHousingGroupId, name: "Renters Insurance", goal: 25 },
    { group: marcusTransportGroupId, name: "Gas", goal: 180 },
    { group: marcusTransportGroupId, name: "Car Insurance", goal: 95 },
    { group: marcusTransportGroupId, name: "Car Maintenance", goal: 50 },
    { group: marcusFoodGroupId, name: "Groceries", goal: 280 },
    { group: marcusFoodGroupId, name: "Dining Out", goal: 80 },
    { group: marcusBillsGroupId, name: "Phone", goal: 65 },
    { group: marcusBillsGroupId, name: "Electric", goal: 85 },
    { group: marcusBillsGroupId, name: "Internet", goal: 55 },
    { group: marcusBillsGroupId, name: "Laundry", goal: 30 },
    { group: marcusSavingsGroupId, name: "Emergency Fund", goal: 100 },
  ];

  for (const cat of marcusCategoryData) {
    const catId = uuid();
    marcusCategories[cat.name] = { id: catId, goal: cat.goal };
    await db.insert(categories).values({
      id: catId,
      budgetId: marcusBudgetId,
      groupId: cat.group,
      name: cat.name,
      goal: cat.goal.toString(),
    });
  }

  // Marcus's transactions (Sept 2025 - Feb 2026)
  const marcusTransactions: Array<{
    date: string;
    payee: string;
    categoryName: string | null;
    accountId: string;
    amount: number;
    memo?: string;
  }> = [];

  // Monthly recurring transactions
  const months = [
    { year: 2025, month: 8 },  // September 2025
    { year: 2025, month: 9 },  // October 2025
    { year: 2025, month: 10 }, // November 2025
    { year: 2025, month: 11 }, // December 2025
    { year: 2026, month: 0 },  // January 2026
    { year: 2026, month: 1 },  // February 2026
  ];

  for (const { year, month } of months) {
    // Income - warehouse job (bi-weekly, ~$1,600/month)
    marcusTransactions.push({
      date: formatDate(new Date(year, month, 1)),
      payee: "Amazon Warehouse",
      categoryName: null, // Income
      accountId: marcusCheckingId,
      amount: 820,
      memo: "Paycheck",
    });
    marcusTransactions.push({
      date: formatDate(new Date(year, month, 15)),
      payee: "Amazon Warehouse",
      categoryName: null,
      accountId: marcusCheckingId,
      amount: 820,
      memo: "Paycheck",
    });

    // Uber Eats income (variable, ~$800/month)
    const uberDays = [5, 12, 19, 26];
    for (const day of uberDays) {
      if (day <= new Date(year, month + 1, 0).getDate()) {
        marcusTransactions.push({
          date: formatDate(new Date(year, month, day)),
          payee: "Uber Eats",
          categoryName: null,
          accountId: marcusCheckingId,
          amount: randomAmount(200, 0.15),
          memo: "Weekly earnings",
        });
      }
    }

    // Rent - 1st of month
    marcusTransactions.push({
      date: formatDate(new Date(year, month, 1)),
      payee: "Maple Grove Apartments",
      categoryName: "Rent",
      accountId: marcusCheckingId,
      amount: -950,
    });

    // Utilities
    marcusTransactions.push({
      date: formatDate(randomDayInMonth(year, month)),
      payee: "Duke Energy",
      categoryName: "Electric",
      accountId: marcusCheckingId,
      amount: -randomAmount(85, 0.2),
    });

    marcusTransactions.push({
      date: formatDate(new Date(year, month, 15)),
      payee: "T-Mobile",
      categoryName: "Phone",
      accountId: marcusCheckingId,
      amount: -65,
    });

    marcusTransactions.push({
      date: formatDate(new Date(year, month, 10)),
      payee: "Spectrum Internet",
      categoryName: "Internet",
      accountId: marcusCheckingId,
      amount: -55,
    });

    // Car expenses
    marcusTransactions.push({
      date: formatDate(new Date(year, month, 20)),
      payee: "State Farm",
      categoryName: "Car Insurance",
      accountId: marcusCheckingId,
      amount: -95,
    });

    // Gas (multiple times per month)
    for (let i = 0; i < 4; i++) {
      marcusTransactions.push({
        date: formatDate(randomDayInMonth(year, month)),
        payee: ["Shell", "Speedway", "BP", "Marathon"][i],
        categoryName: "Gas",
        accountId: marcusCheckingId,
        amount: -randomAmount(45, 0.15),
      });
    }

    // Groceries (weekly)
    for (let week = 0; week < 4; week++) {
      const day = Math.min(7 + week * 7, new Date(year, month + 1, 0).getDate());
      marcusTransactions.push({
        date: formatDate(new Date(year, month, day)),
        payee: ["Walmart", "Aldi", "Kroger", "Save-A-Lot"][week % 4],
        categoryName: "Groceries",
        accountId: marcusCheckingId,
        amount: -randomAmount(70, 0.2),
      });
    }

    // Occasional dining out
    if (Math.random() > 0.3) {
      marcusTransactions.push({
        date: formatDate(randomDayInMonth(year, month)),
        payee: ["McDonald's", "Taco Bell", "Wendy's", "Subway"][Math.floor(Math.random() * 4)],
        categoryName: "Dining Out",
        accountId: marcusCreditId,
        amount: -randomAmount(12, 0.3),
      });
    }

    // Laundry
    marcusTransactions.push({
      date: formatDate(randomDayInMonth(year, month)),
      payee: "Coin Laundry",
      categoryName: "Laundry",
      accountId: marcusCheckingId,
      amount: -randomAmount(30, 0.15),
    });

    // Emergency fund contribution (when possible)
    if (Math.random() > 0.4) {
      marcusTransactions.push({
        date: formatDate(new Date(year, month, 28)),
        payee: "Transfer to Savings",
        categoryName: "Emergency Fund",
        accountId: marcusSavingsId,
        amount: randomAmount(100, 0.3),
        memo: "Monthly savings",
      });
    }
  }

  // Insert Marcus's transactions
  for (const tx of marcusTransactions) {
    await db.insert(transactions).values({
      id: uuid(),
      budgetId: marcusBudgetId,
      date: tx.date,
      payee: tx.payee,
      categoryId: tx.categoryName ? marcusCategories[tx.categoryName]?.id : null,
      accountId: tx.accountId,
      amount: tx.amount.toString(),
      memo: tx.memo,
      cleared: true,
    });
  }

  // Marcus's monthly assignments
  for (const { year, month } of months) {
    const monthKey = formatMonth(new Date(year, month, 1));
    for (const [name, { id, goal }] of Object.entries(marcusCategories)) {
      await db.insert(monthlyAssignments).values({
        id: uuid(),
        budgetId: marcusBudgetId,
        monthKey,
        categoryId: id,
        amount: goal.toString(),
      });
    }
  }

  console.log("✓ Marcus Johnson created\n");

  // ============================================================================
  // USER 2: Sarah Chen (Lower Middle Class ~$4,200/mo)
  // ============================================================================
  console.log("Creating Sarah Chen (Lower Middle Class)...");

  const sarahId = uuid();
  await db.insert(users).values({
    id: sarahId,
    username: "sarah.chen",
    password: hashPassword("TeachKids2024!"),
  });

  const sarahBudgetId = uuid();
  await db.insert(budgets).values({
    id: sarahBudgetId,
    userId: sarahId,
    name: "Sarah's Budget",
    currency: "USD",
    currencyPlacement: "before",
    numberFormat: "1,234.56",
    dateFormat: "MM/DD/YYYY",
  });

  // Sarah's tracking accounts
  await db.insert(trackingAccounts).values([
    {
      id: uuid(),
      userId: sarahId,
      name: "2019 Toyota Corolla",
      type: "asset",
      balance: "18000.00",
      notes: "45k miles, excellent condition",
    },
    {
      id: uuid(),
      userId: sarahId,
      name: "Federal Student Loans",
      type: "liability",
      balance: "-28000.00",
      notes: "Teaching loan forgiveness eligible",
    },
  ]);

  // Sarah's financial accounts
  const sarahCheckingId = uuid();
  const sarahSavingsId = uuid();
  const sarahCreditId = uuid();

  await db.insert(accounts).values([
    {
      id: sarahCheckingId,
      budgetId: sarahBudgetId,
      name: "Wells Fargo Checking",
      type: "checking",
      balance: "2840.00",
      isActive: true,
    },
    {
      id: sarahSavingsId,
      budgetId: sarahBudgetId,
      name: "Wells Fargo Savings",
      type: "savings",
      balance: "4200.00",
      isActive: true,
    },
    {
      id: sarahCreditId,
      budgetId: sarahBudgetId,
      name: "Discover Card",
      type: "credit",
      balance: "-680.00",
      isActive: true,
    },
  ]);

  // Sarah's category groups and categories
  const sarahHousingGroupId = uuid();
  const sarahDebtGroupId = uuid();
  const sarahFoodGroupId = uuid();
  const sarahBillsGroupId = uuid();
  const sarahLifestyleGroupId = uuid();
  const sarahSavingsGroupId = uuid();

  await db.insert(categoryGroups).values([
    { id: sarahHousingGroupId, budgetId: sarahBudgetId, name: "Housing" },
    { id: sarahDebtGroupId, budgetId: sarahBudgetId, name: "Debt Payments" },
    { id: sarahFoodGroupId, budgetId: sarahBudgetId, name: "Food" },
    { id: sarahBillsGroupId, budgetId: sarahBudgetId, name: "Bills" },
    { id: sarahLifestyleGroupId, budgetId: sarahBudgetId, name: "Lifestyle" },
    { id: sarahSavingsGroupId, budgetId: sarahBudgetId, name: "Savings & Goals" },
  ]);

  const sarahCategories: Record<string, { id: string; goal: number }> = {};

  const sarahCategoryData = [
    { group: sarahHousingGroupId, name: "Rent", goal: 1100 },
    { group: sarahHousingGroupId, name: "Renters Insurance", goal: 30 },
    { group: sarahDebtGroupId, name: "Student Loans", goal: 350 },
    { group: sarahFoodGroupId, name: "Groceries", goal: 320 },
    { group: sarahFoodGroupId, name: "Dining Out", goal: 150 },
    { group: sarahFoodGroupId, name: "Coffee & Snacks", goal: 60 },
    { group: sarahBillsGroupId, name: "Electric", goal: 75 },
    { group: sarahBillsGroupId, name: "Gas Utility", goal: 45 },
    { group: sarahBillsGroupId, name: "Internet", goal: 65 },
    { group: sarahBillsGroupId, name: "Phone", goal: 45 },
    { group: sarahBillsGroupId, name: "Car Insurance", goal: 110 },
    { group: sarahBillsGroupId, name: "Gas", goal: 120 },
    { group: sarahLifestyleGroupId, name: "Entertainment", goal: 100 },
    { group: sarahLifestyleGroupId, name: "Self-Care", goal: 80 },
    { group: sarahLifestyleGroupId, name: "Clothing", goal: 75 },
    { group: sarahLifestyleGroupId, name: "Subscriptions", goal: 45 },
    { group: sarahSavingsGroupId, name: "Emergency Fund", goal: 200 },
    { group: sarahSavingsGroupId, name: "Vacation Fund", goal: 150 },
    { group: sarahSavingsGroupId, name: "Classroom Supplies", goal: 50 },
  ];

  for (const cat of sarahCategoryData) {
    const catId = uuid();
    sarahCategories[cat.name] = { id: catId, goal: cat.goal };
    await db.insert(categories).values({
      id: catId,
      budgetId: sarahBudgetId,
      groupId: cat.group,
      name: cat.name,
      goal: cat.goal.toString(),
    });
  }

  // Sarah's transactions
  const sarahTransactions: Array<{
    date: string;
    payee: string;
    categoryName: string | null;
    accountId: string;
    amount: number;
    memo?: string;
  }> = [];

  for (const { year, month } of months) {
    // Teaching salary (monthly, ~$4,200 net)
    marcusTransactions.push({
      date: formatDate(new Date(year, month, 1)),
      payee: "Lincoln Elementary School District",
      categoryName: null,
      accountId: sarahCheckingId,
      amount: 2100,
      memo: "Paycheck - 1st half",
    });
    sarahTransactions.push({
      date: formatDate(new Date(year, month, 15)),
      payee: "Lincoln Elementary School District",
      categoryName: null,
      accountId: sarahCheckingId,
      amount: 2100,
      memo: "Paycheck - 2nd half",
    });

    // Rent
    sarahTransactions.push({
      date: formatDate(new Date(year, month, 1)),
      payee: "Oakwood Apartments",
      categoryName: "Rent",
      accountId: sarahCheckingId,
      amount: -1100,
    });

    // Student loans
    sarahTransactions.push({
      date: formatDate(new Date(year, month, 15)),
      payee: "Nelnet Student Loans",
      categoryName: "Student Loans",
      accountId: sarahCheckingId,
      amount: -350,
      memo: "Monthly payment",
    });

    // Utilities
    sarahTransactions.push({
      date: formatDate(randomDayInMonth(year, month)),
      payee: "ComEd",
      categoryName: "Electric",
      accountId: sarahCheckingId,
      amount: -randomAmount(75, 0.15),
    });

    sarahTransactions.push({
      date: formatDate(randomDayInMonth(year, month)),
      payee: "Peoples Gas",
      categoryName: "Gas Utility",
      accountId: sarahCheckingId,
      amount: -randomAmount(45, 0.25),
    });

    sarahTransactions.push({
      date: formatDate(new Date(year, month, 8)),
      payee: "Xfinity",
      categoryName: "Internet",
      accountId: sarahCheckingId,
      amount: -65,
    });

    sarahTransactions.push({
      date: formatDate(new Date(year, month, 12)),
      payee: "Verizon",
      categoryName: "Phone",
      accountId: sarahCheckingId,
      amount: -45,
    });

    // Car expenses
    sarahTransactions.push({
      date: formatDate(new Date(year, month, 5)),
      payee: "Progressive Insurance",
      categoryName: "Car Insurance",
      accountId: sarahCheckingId,
      amount: -110,
    });

    // Gas (2-3 times per month)
    for (let i = 0; i < 3; i++) {
      sarahTransactions.push({
        date: formatDate(randomDayInMonth(year, month)),
        payee: ["Shell", "Costco Gas", "BP"][i],
        categoryName: "Gas",
        accountId: sarahCheckingId,
        amount: -randomAmount(40, 0.15),
      });
    }

    // Groceries
    for (let week = 0; week < 4; week++) {
      const day = Math.min(3 + week * 7, new Date(year, month + 1, 0).getDate());
      sarahTransactions.push({
        date: formatDate(new Date(year, month, day)),
        payee: ["Trader Joe's", "Whole Foods", "Target", "Costco"][week % 4],
        categoryName: "Groceries",
        accountId: sarahCreditId,
        amount: -randomAmount(80, 0.2),
      });
    }

    // Dining out
    for (let i = 0; i < 3; i++) {
      sarahTransactions.push({
        date: formatDate(randomDayInMonth(year, month)),
        payee: ["Chipotle", "Panera Bread", "Local Sushi", "Thai Kitchen", "Pizza Hut"][Math.floor(Math.random() * 5)],
        categoryName: "Dining Out",
        accountId: sarahCreditId,
        amount: -randomAmount(25, 0.3),
      });
    }

    // Coffee
    for (let i = 0; i < 6; i++) {
      sarahTransactions.push({
        date: formatDate(randomDayInMonth(year, month)),
        payee: ["Starbucks", "Dunkin'", "Local Coffee Shop"][Math.floor(Math.random() * 3)],
        categoryName: "Coffee & Snacks",
        accountId: sarahCreditId,
        amount: -randomAmount(7, 0.3),
      });
    }

    // Subscriptions
    sarahTransactions.push({
      date: formatDate(new Date(year, month, 15)),
      payee: "Netflix",
      categoryName: "Subscriptions",
      accountId: sarahCreditId,
      amount: -15.99,
    });
    sarahTransactions.push({
      date: formatDate(new Date(year, month, 20)),
      payee: "Spotify",
      categoryName: "Subscriptions",
      accountId: sarahCreditId,
      amount: -10.99,
    });

    // Entertainment
    if (Math.random() > 0.4) {
      sarahTransactions.push({
        date: formatDate(randomDayInMonth(year, month)),
        payee: ["AMC Theaters", "Bowling Alley", "Mini Golf", "Museum"][Math.floor(Math.random() * 4)],
        categoryName: "Entertainment",
        accountId: sarahCreditId,
        amount: -randomAmount(35, 0.3),
      });
    }

    // Self-care
    if (Math.random() > 0.5) {
      sarahTransactions.push({
        date: formatDate(randomDayInMonth(year, month)),
        payee: ["Hair Salon", "Nail Spa", "Yoga Studio"][Math.floor(Math.random() * 3)],
        categoryName: "Self-Care",
        accountId: sarahCreditId,
        amount: -randomAmount(50, 0.4),
      });
    }

    // Classroom supplies (teachers often pay out of pocket)
    if (Math.random() > 0.6) {
      sarahTransactions.push({
        date: formatDate(randomDayInMonth(year, month)),
        payee: ["Amazon", "Target", "Staples"][Math.floor(Math.random() * 3)],
        categoryName: "Classroom Supplies",
        accountId: sarahCreditId,
        amount: -randomAmount(35, 0.4),
        memo: "Supplies for class",
      });
    }

    // Savings transfers
    sarahTransactions.push({
      date: formatDate(new Date(year, month, 25)),
      payee: "Transfer to Savings",
      categoryName: "Emergency Fund",
      accountId: sarahSavingsId,
      amount: 200,
    });

    sarahTransactions.push({
      date: formatDate(new Date(year, month, 25)),
      payee: "Transfer to Savings",
      categoryName: "Vacation Fund",
      accountId: sarahSavingsId,
      amount: 150,
    });
  }

  // Insert Sarah's transactions
  for (const tx of sarahTransactions) {
    await db.insert(transactions).values({
      id: uuid(),
      budgetId: sarahBudgetId,
      date: tx.date,
      payee: tx.payee,
      categoryId: tx.categoryName ? sarahCategories[tx.categoryName]?.id : null,
      accountId: tx.accountId,
      amount: tx.amount.toString(),
      memo: tx.memo,
      cleared: true,
    });
  }

  // Sarah's monthly assignments
  for (const { year, month } of months) {
    const monthKey = formatMonth(new Date(year, month, 1));
    for (const [name, { id, goal }] of Object.entries(sarahCategories)) {
      await db.insert(monthlyAssignments).values({
        id: uuid(),
        budgetId: sarahBudgetId,
        monthKey,
        categoryId: id,
        amount: goal.toString(),
      });
    }
  }

  console.log("✓ Sarah Chen created\n");

  // ============================================================================
  // USER 3: David Thornton (Upper Middle Class ~$14,000/mo)
  // ============================================================================
  console.log("Creating David Thornton (Upper Middle Class)...");

  const davidId = uuid();
  await db.insert(users).values({
    id: davidId,
    username: "david.thornton",
    password: hashPassword("Thornton$ecure1"),
  });

  const davidBudgetId = uuid();
  await db.insert(budgets).values({
    id: davidBudgetId,
    userId: davidId,
    name: "Thornton Family Budget",
    currency: "USD",
    currencyPlacement: "before",
    numberFormat: "1,234.56",
    dateFormat: "MM/DD/YYYY",
  });

  // David's tracking accounts
  await db.insert(trackingAccounts).values([
    {
      id: uuid(),
      userId: davidId,
      name: "Home - 234 Maple Drive",
      type: "asset",
      balance: "450000.00",
      notes: "4BR/3BA, purchased 2020",
    },
    {
      id: uuid(),
      userId: davidId,
      name: "2023 Tesla Model Y",
      type: "asset",
      balance: "48000.00",
      notes: "Primary vehicle",
    },
    {
      id: uuid(),
      userId: davidId,
      name: "2021 Honda Pilot",
      type: "asset",
      balance: "37000.00",
      notes: "Family SUV",
    },
    {
      id: uuid(),
      userId: davidId,
      name: "Home Mortgage",
      type: "liability",
      balance: "-320000.00",
      notes: "3.25% fixed, 28 years remaining",
    },
  ]);

  // David's financial accounts
  const davidCheckingId = uuid();
  const davidSavingsId = uuid();
  const davidCreditId = uuid();
  const davidCarLoanId = uuid();

  await db.insert(accounts).values([
    {
      id: davidCheckingId,
      budgetId: davidBudgetId,
      name: "Chase Premium Checking",
      type: "checking",
      balance: "12500.00",
      isActive: true,
    },
    {
      id: davidSavingsId,
      budgetId: davidBudgetId,
      name: "Chase Savings",
      type: "savings",
      balance: "35000.00",
      isActive: true,
    },
    {
      id: davidCreditId,
      budgetId: davidBudgetId,
      name: "Chase Sapphire Reserve",
      type: "credit",
      balance: "-2840.00",
      isActive: true,
    },
    {
      id: davidCarLoanId,
      budgetId: davidBudgetId,
      name: "Tesla Loan",
      type: "loan",
      balance: "-18500.00",
      isActive: true,
    },
  ]);

  // David's category groups and categories
  const davidHousingGroupId = uuid();
  const davidKidsGroupId = uuid();
  const davidFoodGroupId = uuid();
  const davidTransportGroupId = uuid();
  const davidLifestyleGroupId = uuid();
  const davidSavingsGroupId = uuid();
  const davidBillsGroupId = uuid();

  await db.insert(categoryGroups).values([
    { id: davidHousingGroupId, budgetId: davidBudgetId, name: "Housing" },
    { id: davidKidsGroupId, budgetId: davidBudgetId, name: "Kids" },
    { id: davidFoodGroupId, budgetId: davidBudgetId, name: "Food" },
    { id: davidTransportGroupId, budgetId: davidBudgetId, name: "Transportation" },
    { id: davidLifestyleGroupId, budgetId: davidBudgetId, name: "Lifestyle" },
    { id: davidSavingsGroupId, budgetId: davidBudgetId, name: "Savings & Investments" },
    { id: davidBillsGroupId, budgetId: davidBudgetId, name: "Bills & Utilities" },
  ]);

  const davidCategories: Record<string, { id: string; goal: number }> = {};

  const davidCategoryData = [
    { group: davidHousingGroupId, name: "Mortgage", goal: 2200 },
    { group: davidHousingGroupId, name: "Property Tax", goal: 450 },
    { group: davidHousingGroupId, name: "Home Insurance", goal: 180 },
    { group: davidHousingGroupId, name: "Home Maintenance", goal: 300 },
    { group: davidHousingGroupId, name: "Lawn & Garden", goal: 150 },
    { group: davidKidsGroupId, name: "After School Activities", goal: 400 },
    { group: davidKidsGroupId, name: "Sports & Lessons", goal: 350 },
    { group: davidKidsGroupId, name: "School Expenses", goal: 150 },
    { group: davidKidsGroupId, name: "Kids Clothing", goal: 200 },
    { group: davidKidsGroupId, name: "529 College Fund", goal: 500 },
    { group: davidFoodGroupId, name: "Groceries", goal: 800 },
    { group: davidFoodGroupId, name: "Dining Out", goal: 500 },
    { group: davidFoodGroupId, name: "Coffee & Snacks", goal: 100 },
    { group: davidTransportGroupId, name: "Tesla Payment", goal: 650 },
    { group: davidTransportGroupId, name: "Car Insurance", goal: 280 },
    { group: davidTransportGroupId, name: "Gas & Charging", goal: 200 },
    { group: davidTransportGroupId, name: "Car Maintenance", goal: 150 },
    { group: davidLifestyleGroupId, name: "Entertainment", goal: 300 },
    { group: davidLifestyleGroupId, name: "Subscriptions", goal: 150 },
    { group: davidLifestyleGroupId, name: "Date Night", goal: 200 },
    { group: davidLifestyleGroupId, name: "Hobbies", goal: 200 },
    { group: davidSavingsGroupId, name: "Emergency Fund", goal: 1000 },
    { group: davidSavingsGroupId, name: "Travel Fund", goal: 600 },
    { group: davidSavingsGroupId, name: "401k Extra", goal: 1500 },
    { group: davidSavingsGroupId, name: "HSA", goal: 300 },
    { group: davidBillsGroupId, name: "Electric", goal: 180 },
    { group: davidBillsGroupId, name: "Gas Utility", goal: 120 },
    { group: davidBillsGroupId, name: "Water & Sewer", goal: 80 },
    { group: davidBillsGroupId, name: "Internet", goal: 90 },
    { group: davidBillsGroupId, name: "Cell Phones", goal: 180 },
    { group: davidBillsGroupId, name: "Life Insurance", goal: 150 },
  ];

  for (const cat of davidCategoryData) {
    const catId = uuid();
    davidCategories[cat.name] = { id: catId, goal: cat.goal };
    await db.insert(categories).values({
      id: catId,
      budgetId: davidBudgetId,
      groupId: cat.group,
      name: cat.name,
      goal: cat.goal.toString(),
    });
  }

  // David's transactions
  const davidTransactions: Array<{
    date: string;
    payee: string;
    categoryName: string | null;
    accountId: string;
    amount: number;
    memo?: string;
  }> = [];

  for (const { year, month } of months) {
    // Engineering Manager salary (bi-monthly, ~$14,000 net total)
    davidTransactions.push({
      date: formatDate(new Date(year, month, 1)),
      payee: "TechCorp Inc.",
      categoryName: null,
      accountId: davidCheckingId,
      amount: 7000,
      memo: "Paycheck - 1st half",
    });
    davidTransactions.push({
      date: formatDate(new Date(year, month, 15)),
      payee: "TechCorp Inc.",
      categoryName: null,
      accountId: davidCheckingId,
      amount: 7000,
      memo: "Paycheck - 2nd half",
    });

    // Mortgage
    davidTransactions.push({
      date: formatDate(new Date(year, month, 1)),
      payee: "Wells Fargo Mortgage",
      categoryName: "Mortgage",
      accountId: davidCheckingId,
      amount: -2200,
    });

    // Property tax (escrow monthly estimate)
    davidTransactions.push({
      date: formatDate(new Date(year, month, 1)),
      payee: "County Tax Assessor",
      categoryName: "Property Tax",
      accountId: davidCheckingId,
      amount: -450,
    });

    // Home insurance
    davidTransactions.push({
      date: formatDate(new Date(year, month, 5)),
      payee: "State Farm Home",
      categoryName: "Home Insurance",
      accountId: davidCheckingId,
      amount: -180,
    });

    // Tesla payment
    davidTransactions.push({
      date: formatDate(new Date(year, month, 10)),
      payee: "Tesla Finance",
      categoryName: "Tesla Payment",
      accountId: davidCarLoanId,
      amount: -650,
    });

    // Car insurance (both vehicles)
    davidTransactions.push({
      date: formatDate(new Date(year, month, 15)),
      payee: "GEICO",
      categoryName: "Car Insurance",
      accountId: davidCheckingId,
      amount: -280,
    });

    // Utilities
    davidTransactions.push({
      date: formatDate(randomDayInMonth(year, month)),
      payee: "Con Edison",
      categoryName: "Electric",
      accountId: davidCheckingId,
      amount: -randomAmount(180, 0.2),
    });

    davidTransactions.push({
      date: formatDate(randomDayInMonth(year, month)),
      payee: "National Grid",
      categoryName: "Gas Utility",
      accountId: davidCheckingId,
      amount: -randomAmount(120, 0.25),
    });

    davidTransactions.push({
      date: formatDate(randomDayInMonth(year, month)),
      payee: "City Water",
      categoryName: "Water & Sewer",
      accountId: davidCheckingId,
      amount: -randomAmount(80, 0.15),
    });

    davidTransactions.push({
      date: formatDate(new Date(year, month, 12)),
      payee: "Verizon Fios",
      categoryName: "Internet",
      accountId: davidCheckingId,
      amount: -90,
    });

    davidTransactions.push({
      date: formatDate(new Date(year, month, 18)),
      payee: "Verizon Wireless",
      categoryName: "Cell Phones",
      accountId: davidCheckingId,
      amount: -180,
    });

    // Life insurance
    davidTransactions.push({
      date: formatDate(new Date(year, month, 20)),
      payee: "Northwestern Mutual",
      categoryName: "Life Insurance",
      accountId: davidCheckingId,
      amount: -150,
    });

    // Groceries (Costco + weekly)
    davidTransactions.push({
      date: formatDate(new Date(year, month, 5)),
      payee: "Costco",
      categoryName: "Groceries",
      accountId: davidCreditId,
      amount: -randomAmount(350, 0.15),
      memo: "Monthly Costco run",
    });

    for (let week = 0; week < 3; week++) {
      const day = Math.min(10 + week * 7, new Date(year, month + 1, 0).getDate());
      davidTransactions.push({
        date: formatDate(new Date(year, month, day)),
        payee: ["Whole Foods", "Wegmans", "Harris Teeter"][week],
        categoryName: "Groceries",
        accountId: davidCreditId,
        amount: -randomAmount(150, 0.2),
      });
    }

    // Dining out (family + date nights)
    for (let i = 0; i < 4; i++) {
      davidTransactions.push({
        date: formatDate(randomDayInMonth(year, month)),
        payee: ["Olive Garden", "Red Lobster", "Cheesecake Factory", "Local Steakhouse", "Sushi Restaurant"][Math.floor(Math.random() * 5)],
        categoryName: "Dining Out",
        accountId: davidCreditId,
        amount: -randomAmount(85, 0.3),
      });
    }

    // Date night
    davidTransactions.push({
      date: formatDate(randomDayInMonth(year, month)),
      payee: ["Upscale Restaurant", "Wine Bar", "Jazz Club"][Math.floor(Math.random() * 3)],
      categoryName: "Date Night",
      accountId: davidCreditId,
      amount: -randomAmount(150, 0.25),
      memo: "Date night with wife",
    });

    // Kids activities
    davidTransactions.push({
      date: formatDate(new Date(year, month, 1)),
      payee: "YMCA After School",
      categoryName: "After School Activities",
      accountId: davidCheckingId,
      amount: -400,
    });

    davidTransactions.push({
      date: formatDate(new Date(year, month, 5)),
      payee: ["Soccer Club", "Piano Teacher", "Swim Team"][month % 3],
      categoryName: "Sports & Lessons",
      accountId: davidCheckingId,
      amount: -randomAmount(175, 0.15),
    });

    davidTransactions.push({
      date: formatDate(new Date(year, month, 5)),
      payee: ["Basketball League", "Art Class", "Tutoring"][month % 3],
      categoryName: "Sports & Lessons",
      accountId: davidCheckingId,
      amount: -randomAmount(175, 0.15),
    });

    // School expenses
    if (Math.random() > 0.5) {
      davidTransactions.push({
        date: formatDate(randomDayInMonth(year, month)),
        payee: ["School Book Fair", "Field Trip", "School Supplies"][Math.floor(Math.random() * 3)],
        categoryName: "School Expenses",
        accountId: davidCreditId,
        amount: -randomAmount(50, 0.4),
      });
    }

    // 529 contribution
    davidTransactions.push({
      date: formatDate(new Date(year, month, 25)),
      payee: "Vanguard 529",
      categoryName: "529 College Fund",
      accountId: davidCheckingId,
      amount: -500,
      memo: "Monthly 529 contribution",
    });

    // Subscriptions
    davidTransactions.push({
      date: formatDate(new Date(year, month, 1)),
      payee: "Netflix",
      categoryName: "Subscriptions",
      accountId: davidCreditId,
      amount: -22.99,
    });
    davidTransactions.push({
      date: formatDate(new Date(year, month, 1)),
      payee: "Disney+",
      categoryName: "Subscriptions",
      accountId: davidCreditId,
      amount: -13.99,
    });
    davidTransactions.push({
      date: formatDate(new Date(year, month, 5)),
      payee: "Spotify Family",
      categoryName: "Subscriptions",
      accountId: davidCreditId,
      amount: -16.99,
    });
    davidTransactions.push({
      date: formatDate(new Date(year, month, 10)),
      payee: "Apple One",
      categoryName: "Subscriptions",
      accountId: davidCreditId,
      amount: -32.95,
    });
    davidTransactions.push({
      date: formatDate(new Date(year, month, 15)),
      payee: "New York Times",
      categoryName: "Subscriptions",
      accountId: davidCreditId,
      amount: -17.00,
    });

    // Entertainment
    davidTransactions.push({
      date: formatDate(randomDayInMonth(year, month)),
      payee: ["AMC Theaters", "Dave & Busters", "Bowling", "Mini Golf"][Math.floor(Math.random() * 4)],
      categoryName: "Entertainment",
      accountId: davidCreditId,
      amount: -randomAmount(120, 0.3),
      memo: "Family outing",
    });

    // Home maintenance
    if (Math.random() > 0.4) {
      davidTransactions.push({
        date: formatDate(randomDayInMonth(year, month)),
        payee: ["Home Depot", "Lowe's", "Local Handyman"][Math.floor(Math.random() * 3)],
        categoryName: "Home Maintenance",
        accountId: davidCreditId,
        amount: -randomAmount(200, 0.5),
      });
    }

    // Lawn service
    davidTransactions.push({
      date: formatDate(new Date(year, month, 15)),
      payee: "Green Lawn Care",
      categoryName: "Lawn & Garden",
      accountId: davidCheckingId,
      amount: -150,
    });

    // Gas/Charging
    for (let i = 0; i < 3; i++) {
      davidTransactions.push({
        date: formatDate(randomDayInMonth(year, month)),
        payee: i === 0 ? "Tesla Supercharger" : ["Shell", "Exxon"][i - 1],
        categoryName: "Gas & Charging",
        accountId: davidCreditId,
        amount: -randomAmount(65, 0.2),
      });
    }

    // Savings transfers
    davidTransactions.push({
      date: formatDate(new Date(year, month, 28)),
      payee: "Transfer to Emergency Fund",
      categoryName: "Emergency Fund",
      accountId: davidSavingsId,
      amount: 1000,
    });

    davidTransactions.push({
      date: formatDate(new Date(year, month, 28)),
      payee: "Transfer to Travel Fund",
      categoryName: "Travel Fund",
      accountId: davidSavingsId,
      amount: 600,
    });

    davidTransactions.push({
      date: formatDate(new Date(year, month, 1)),
      payee: "Fidelity 401k",
      categoryName: "401k Extra",
      accountId: davidCheckingId,
      amount: -1500,
      memo: "Additional 401k contribution",
    });

    davidTransactions.push({
      date: formatDate(new Date(year, month, 1)),
      payee: "HSA Contribution",
      categoryName: "HSA",
      accountId: davidCheckingId,
      amount: -300,
    });
  }

  // Insert David's transactions
  for (const tx of davidTransactions) {
    await db.insert(transactions).values({
      id: uuid(),
      budgetId: davidBudgetId,
      date: tx.date,
      payee: tx.payee,
      categoryId: tx.categoryName ? davidCategories[tx.categoryName]?.id : null,
      accountId: tx.accountId,
      amount: tx.amount.toString(),
      memo: tx.memo,
      cleared: true,
    });
  }

  // David's monthly assignments
  for (const { year, month } of months) {
    const monthKey = formatMonth(new Date(year, month, 1));
    for (const [name, { id, goal }] of Object.entries(davidCategories)) {
      await db.insert(monthlyAssignments).values({
        id: uuid(),
        budgetId: davidBudgetId,
        monthKey,
        categoryId: id,
        amount: goal.toString(),
      });
    }
  }

  console.log("✓ David Thornton created\n");

  // Summary
  console.log("=" .repeat(50));
  console.log("🌱 Database seeding complete!\n");
  console.log("Created users:");
  console.log("  1. marcus.johnson / marcus2024! (Lower Income)");
  console.log("  2. sarah.chen / TeachKids2024! (Lower Middle Class)");
  console.log("  3. david.thornton / Thornton$ecure1 (Upper Middle Class)");
  console.log("\nTime period: September 2025 - February 2026");
  console.log("=" .repeat(50));

  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
