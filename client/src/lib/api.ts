import type { Transaction, Account } from './store';

// API Response types
export interface TransactionResponse {
  transaction: Transaction;
  account: Account;
}

export interface TransactionUpdateResponse {
  transaction: Transaction;
  accounts: Account[];
}

export interface TransactionDeleteResponse {
  accounts: Account[];
  deletedIds: string[];
}

// API Input types
export interface CreateTransactionInput {
  budgetId: string;
  date: string;
  payee: string;
  categoryId?: string;
  accountId: string;
  amount: number;
  memo?: string;
  cleared?: boolean;
}

export interface UpdateTransactionInput {
  date?: string;
  payee?: string;
  categoryId?: string | null;
  accountId?: string;
  amount?: number;
  memo?: string;
  cleared?: boolean;
}

// Error handling
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(
      data.message || `Request failed with status ${response.status}`,
      response.status,
      data
    );
  }
  return response.json();
}

// Transaction API functions
export async function createTransaction(
  data: CreateTransactionInput
): Promise<TransactionResponse> {
  const response = await fetch('/api/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include',
  });
  return handleResponse<TransactionResponse>(response);
}

export async function updateTransaction(
  id: string,
  data: UpdateTransactionInput
): Promise<TransactionUpdateResponse> {
  const response = await fetch(`/api/transactions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include',
  });
  return handleResponse<TransactionUpdateResponse>(response);
}

export async function deleteTransaction(
  id: string
): Promise<TransactionDeleteResponse> {
  const response = await fetch(`/api/transactions/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  return handleResponse<TransactionDeleteResponse>(response);
}
